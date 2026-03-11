/**
 * Client wrapper for `/api/ai-agent` and `/api/ai-agent-user`.
 * Handles streaming chat, client-side tool execution and memory utilities.
 * @version 5.0.0
 */

import { createLogger } from "../../core/logger.js";
import { executeTool } from "./modules/tool-executor.js";

const log = createLogger("AIAgentService");

const AGENT_ENDPOINT = "/api/ai-agent";
const USER_ENDPOINT = "/api/ai-agent-user";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const USER_ID_HEADER = "x-jules-user-id";
const USER_ID_STORAGE_KEY = "jules:user-id";
const MAX_HISTORY = 20;
const REQUEST_TIMEOUT_MS = 25000;
const STREAM_IDLE_TIMEOUT_MS = 12000;
let runtimeUserId = "";
let runtimeConversationHistory = [];
let runtimeProfileState = createProfileState();
let runtimeProfileRecovery = null;

// ─── User ID & History ──────────────────────────────────────────────────────────

function normalizeUserId(raw) {
  const value = String(raw || "").trim();
  if (!value || value === "anonymous") return "";
  if (!/^[A-Za-z0-9_-]{3,120}$/.test(value)) return "";
  return value;
}

function normalizeProfileStatus(raw) {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  return [
    "identified",
    "anonymous",
    "recovery-pending",
    "conflict",
    "disconnected",
  ].includes(value)
    ? value
    : "anonymous";
}

function createProfileState(overrides = {}) {
  const userId = normalizeUserId(overrides.userId);
  const name = String(overrides.name || "").trim();
  const status = normalizeProfileStatus(
    overrides.status ||
      (name ? "identified" : userId ? "anonymous" : "disconnected"),
  );
  const label =
    String(overrides.label || "").trim() ||
    (status === "identified"
      ? `Profil: ${name}`
      : status === "recovery-pending"
        ? `Profil gefunden: ${name}`
        : status === "conflict"
          ? `Profil unklar: ${name}`
          : status === "disconnected"
            ? "Kein aktives Profil"
            : "Profil: neu");

  return {
    userId,
    name,
    status,
    label,
  };
}

function normalizeRecoveryState(raw) {
  const status = String(raw?.status || "")
    .trim()
    .toLowerCase();
  if (!["needs_confirmation", "conflict"].includes(status)) return null;

  return {
    status,
    name: String(raw?.name || "").trim(),
    candidateUserId: normalizeUserId(raw?.candidateUserId),
  };
}

function setProfileState(nextState = {}) {
  runtimeProfileState = createProfileState({
    ...runtimeProfileState,
    ...nextState,
  });
  return getProfileState();
}

function setRecoveryState(nextRecovery = null) {
  runtimeProfileRecovery = normalizeRecoveryState(nextRecovery);
  return getProfileState();
}

function resetProfileState({ clearUserId = false } = {}) {
  if (clearUserId) {
    runtimeProfileState = createProfileState({
      userId: "",
      name: "",
      status: "disconnected",
    });
  } else {
    runtimeProfileState = createProfileState({
      userId: getUserId(),
      name: "",
      status: getUserId() ? "anonymous" : "disconnected",
    });
  }
  runtimeProfileRecovery = null;
  return getProfileState();
}

function getProfileState() {
  return {
    ...runtimeProfileState,
    recovery: runtimeProfileRecovery ? { ...runtimeProfileRecovery } : null,
  };
}

function syncProfileStateFromPayload(payload = {}) {
  const userId = normalizeUserId(payload?.userId) || getUserId();
  if (userId) {
    setProfileState({ userId });
  } else {
    resetProfileState({ clearUserId: true });
  }

  if (payload?.profile) {
    setProfileState(payload.profile);
  } else if (userId) {
    setProfileState({
      userId,
      status: runtimeProfileState.name ? "identified" : "anonymous",
    });
  }

  if (payload?.recovery) {
    setRecoveryState(payload.recovery);
    if (runtimeProfileRecovery?.status === "needs_confirmation") {
      setProfileState({
        userId,
        name: runtimeProfileRecovery.name,
        status: "recovery-pending",
      });
    } else if (runtimeProfileRecovery?.status === "conflict") {
      setProfileState({
        userId,
        name: runtimeProfileRecovery.name,
        status: "conflict",
      });
    }
  } else {
    setRecoveryState(null);
  }

  return getProfileState();
}

function persistUserId(id) {
  const value = normalizeUserId(id);
  if (!value) {
    clearPersistedUserId();
    return "";
  }
  runtimeUserId = value;
  setProfileState({
    userId: value,
    status: runtimeProfileState.name ? runtimeProfileState.status : "anonymous",
  });
  const storage = getUserIdStorage();
  if (storage?.setItem) {
    try {
      storage.setItem(USER_ID_STORAGE_KEY, value);
    } catch {
      /* ignore storage failures */
    }
  }
  return value;
}

function getUserId() {
  if (!runtimeUserId) {
    runtimeUserId = loadPersistedUserId();
    if (runtimeUserId) {
      setProfileState({
        userId: runtimeUserId,
        status: runtimeProfileState.name
          ? runtimeProfileState.status
          : "anonymous",
      });
    }
  }
  return normalizeUserId(runtimeUserId);
}

function getUserIdStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function loadPersistedUserId() {
  const storage = getUserIdStorage();
  if (!storage?.getItem) return "";

  try {
    return normalizeUserId(storage.getItem(USER_ID_STORAGE_KEY));
  } catch {
    return "";
  }
}

function clearPersistedUserId() {
  runtimeUserId = "";
  resetProfileState({ clearUserId: true });
  const storage = getUserIdStorage();
  if (!storage?.removeItem) return;

  try {
    storage.removeItem(USER_ID_STORAGE_KEY);
  } catch {
    /* ignore storage failures */
  }
}

function syncUserIdFromResponse(response) {
  const headerValue = normalizeUserId(response?.headers?.get?.(USER_ID_HEADER));
  if (headerValue) persistUserId(headerValue);
}

function getHistory() {
  return runtimeConversationHistory.slice(-MAX_HISTORY);
}

function saveHistory(history) {
  runtimeConversationHistory = Array.isArray(history)
    ? history.slice(-MAX_HISTORY)
    : [];
}

function addToHistory(role, content) {
  const history = getHistory();
  history.push({ role, content, timestamp: Date.now() });
  saveHistory(history);
}

function isAbortLikeError(error) {
  return (
    error?.name === "AbortError" ||
    error?.name === "TimeoutError" ||
    error?.code === 20
  );
}

function abortControllerWithReason(controller, reason) {
  if (!controller || controller.signal.aborted) return;
  controller.__julesAbortReason = reason;
  try {
    controller.abort(reason);
  } catch {
    controller.abort();
  }
}

function getAbortReason(service, controller) {
  return (
    (service && service._activeController === controller
      ? service._activeAbortReason
      : null) ||
    controller?.__julesAbortReason ||
    "aborted"
  );
}

function createAbortTimer(controller, timeoutMs, reason) {
  if (!(timeoutMs > 0)) return () => {};

  const timeoutId = setTimeout(() => {
    abortControllerWithReason(controller, reason);
  }, timeoutMs);

  return () => clearTimeout(timeoutId);
}

function createStreamIdleGuard(controller, idleTimeoutMs) {
  if (!(idleTimeoutMs > 0)) {
    return {
      touch() {},
      stop() {},
    };
  }

  let timeoutId = null;
  const touch = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      abortControllerWithReason(controller, "stream-idle");
    }, idleTimeoutMs);
  };

  const stop = () => {
    if (!timeoutId) return;
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  touch();
  return { touch, stop };
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

function createToolCallKey(toolCall) {
  return `${String(toolCall?.name || "").trim()}:${stableSerialize(toolCall?.arguments || {})}`;
}

function getAbortResultText(reason) {
  switch (reason) {
    case "request-timeout":
    case "stream-idle":
      return "Die Antwort dauert zu lange. Bitte versuche es erneut.";
    case "history-cleared":
    case "destroyed":
    case "cancelled":
      return "";
    default:
      return "Die Anfrage wurde abgebrochen. Bitte versuche es erneut.";
  }
}

// ─── SSE Stream Parser ──────────────────────────────────────────────────────────

function processSSEEventBlock(eventBlock, callbacks, finalMessageRef) {
  if (!eventBlock.trim()) return;

  let eventType = "";
  const dataLines = [];

  for (const rawLine of eventBlock.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  const eventData = dataLines.join("\n").trim();
  if (!eventType || !eventData || eventData === "[DONE]") return;

  let data;
  try {
    data = JSON.parse(eventData);
  } catch {
    return;
  }

  switch (eventType) {
    case "identity":
      if (data.userId) {
        persistUserId(data.userId);
      }
      break;
    case "token":
      callbacks.onToken?.(data.text || "");
      break;
    case "tool":
      callbacks.onTool?.(data);
      break;
    case "status":
      callbacks.onStatus?.(data.phase || "");
      break;
    case "message":
      finalMessageRef.current = data;
      callbacks.onMessage?.(data);
      break;
    case "error":
      callbacks.onError?.(data);
      break;
    default:
      break;
  }
}

async function parseSSEStream(response, callbacks = {}, options = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const finalMessageRef = { current: null };
  const idleGuard = options.idleGuard || null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      idleGuard?.touch();

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const event of events) {
        processSSEEventBlock(event, callbacks, finalMessageRef);
      }
    }

    buffer += decoder.decode();
    processSSEEventBlock(buffer, callbacks, finalMessageRef);
  } finally {
    idleGuard?.stop?.();
    reader.releaseLock();
  }

  return finalMessageRef.current;
}

// ─── Core API Call ──────────────────────────────────────────────────────────────

const mkResult = (text, extra = {}) => ({
  text,
  toolCalls: [],
  hasMemory: false,
  hasImage: false,
  toolResults: [],
  profile: getProfileState(),
  recovery: null,
  ...extra,
});

const pickBestText = (finalText, streamedText) => {
  const a = String(finalText || "").trim();
  const b = String(streamedText || "").trim();
  if (!a) return b;
  if (!b) return a;
  return a.length >= b.length ? a : b;
};

async function callAgent(
  service,
  payload,
  callbacks = {},
  { stream = true } = {},
) {
  const userId = getUserId();
  const userIdHeader = userId ? { [USER_ID_HEADER]: userId } : {};
  const controller = new AbortController();
  const clearRequestTimeout = createAbortTimer(
    controller,
    service.requestTimeoutMs,
    "request-timeout",
  );
  service._activeController = controller;
  service._activeAbortReason = "";

  try {
    // ── Fetch ──
    let response;
    try {
      if (payload.image) {
        const fd = new FormData();
        fd.append("prompt", payload.prompt || "");
        if (userId) fd.append("userId", userId);
        fd.append("image", payload.image);
        response = await service.fetchImpl(AGENT_ENDPOINT, {
          method: "POST",
          headers: userIdHeader,
          body: fd,
          credentials: "same-origin",
          signal: controller.signal,
        });
      } else {
        response = await service.fetchImpl(AGENT_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...userIdHeader,
          },
          credentials: "same-origin",
          body: JSON.stringify({
            prompt: payload.prompt,
            ...(userId ? { userId } : {}),
            conversationHistory: getHistory(),
            stream,
          }),
          signal: controller.signal,
        });
      }
      syncUserIdFromResponse(response);
    } catch (err) {
      const abortReason = getAbortReason(service, controller);
      if (isAbortLikeError(err)) {
        const text = getAbortResultText(abortReason);
        if (text) callbacks.onToken?.(text);
        return mkResult(text, { aborted: true });
      }

      log.error("Fetch failed:", err?.message || err);
      const text = "KI-Dienst nicht erreichbar. Bitte erneut versuchen.";
      if (text) callbacks.onToken?.(text);
      return mkResult(text);
    } finally {
      clearRequestTimeout();
    }

    // ── Error response ──
    if (!response.ok) {
      let body = {};
      try {
        body = await response.json();
      } catch {
        /* ignore */
      }

      if (response.status === 429) {
        const text = `⏳ Zu viele Anfragen. Bitte ${body.retryAfter || 60}s warten.`;
        callbacks.onToken?.(text);
        return mkResult(text);
      }

      const text = body.text || `KI-Fehler (${response.status}).`;
      callbacks.onToken?.(text);
      return mkResult(text);
    }

    const contentType = response.headers.get("content-type") || "";

    // ── SSE Stream ──
    if (contentType.includes("text/event-stream")) {
      let fullText = "";
      const toolResults = [];
      const executedToolKeys = new Set();
      const runClientTool = (toolCall) => {
        const toolKey = createToolCallKey(toolCall);
        if (!toolKey || executedToolKeys.has(toolKey)) return;
        executedToolKeys.add(toolKey);
        try {
          const result = executeTool(toolCall);
          toolResults.push({ name: toolCall.name, ...result });
        } catch (error) {
          log.warn(`Tool error: ${toolCall?.name || "unknown"}`, error);
        }
      };
      const idleGuard = createStreamIdleGuard(
        controller,
        service.streamIdleTimeoutMs,
      );

      const finalMessage = await parseSSEStream(
        response,
        {
          onToken(delta) {
            fullText += delta;
            try {
              callbacks.onToken?.(fullText);
            } catch {
              /* ignore */
            }
          },
          onTool(ev) {
            if (ev.status === "client") {
              runClientTool({
                name: ev.name,
                arguments: ev.arguments,
                meta: ev.meta || {},
              });
            }
            callbacks.onTool?.(ev);
          },
          onStatus(phase) {
            callbacks.onStatus?.(phase);
          },
          onError(err) {
            log.error("SSE error:", err);
            callbacks.onError?.(err);
          },
          onMessage(msg) {
            if (Array.isArray(msg.toolCalls)) {
              for (const tc of msg.toolCalls) {
                runClientTool(tc);
              }
            }
          },
        },
        { idleGuard },
      );

      const profileState = syncProfileStateFromPayload(finalMessage || {});
      const text = pickBestText(finalMessage?.text, fullText);
      addToHistory("user", payload.prompt);
      if (text) addToHistory("assistant", text);

      return {
        text,
        toolCalls: finalMessage?.toolCalls || [],
        hasMemory: finalMessage?.hasMemory || false,
        hasImage: finalMessage?.hasImage || false,
        toolResults,
        profile: profileState,
        recovery: profileState.recovery,
      };
    }

    // ── JSON response ──
    const result = await response.json();
    if (result.userId) {
      persistUserId(result.userId);
    }
    const profileState = syncProfileStateFromPayload(result);

    addToHistory("user", payload.prompt);
    if (result.text) addToHistory("assistant", result.text);

    const toolResults = [];
    const executedToolKeys = new Set();
    if (Array.isArray(result.toolCalls)) {
      for (const tc of result.toolCalls) {
        const toolKey = createToolCallKey(tc);
        if (toolKey && executedToolKeys.has(toolKey)) continue;
        if (toolKey) executedToolKeys.add(toolKey);
        try {
          toolResults.push({ name: tc.name, ...executeTool(tc) });
        } catch {
          /* skip */
        }
      }
    }

    callbacks.onToken?.(result.text || "");
    return mkResult(result.text || "", {
      toolCalls: result.toolCalls || [],
      hasMemory: result.hasMemory || false,
      hasImage: result.hasImage || false,
      toolResults,
      profile: profileState,
      recovery: profileState.recovery,
    });
  } finally {
    if (service._activeController === controller) {
      service._activeController = null;
      service._activeAbortReason = "";
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export class AIAgentService {
  constructor({
    fetchImpl = globalThis.fetch?.bind(globalThis),
    requestTimeoutMs = REQUEST_TIMEOUT_MS,
    streamIdleTimeoutMs = STREAM_IDLE_TIMEOUT_MS,
  } = {}) {
    this.fetchImpl =
      typeof fetchImpl === "function"
        ? fetchImpl
        : globalThis.fetch?.bind(globalThis);
    this.requestTimeoutMs = requestTimeoutMs;
    this.streamIdleTimeoutMs = streamIdleTimeoutMs;
    this._activeController = null;
    this._activeAbortReason = "";
  }

  /** Streaming agent response with tool-calling */
  generateResponse(prompt, onToken, callbacks = {}) {
    return callAgent(this, { prompt }, { onToken, ...callbacks });
  }

  /** Analyze an image with optional prompt (streamed) */
  analyzeImage(imageFile, prompt = "", onToken) {
    const v = this.validateImage(imageFile);
    if (!v.valid) {
      const err = `⚠️ ${v.error}`;
      onToken?.(err);
      return Promise.resolve(mkResult(err));
    }
    return callAgent(
      this,
      { prompt: prompt || "Analysiere dieses Bild.", image: imageFile },
      { onToken },
    );
  }

  /** Clear conversation history */
  clearHistory() {
    this.cancelActiveRequest("history-cleared");
    runtimeConversationHistory = [];
  }

  cancelActiveRequest(reason = "cancelled") {
    if (!this._activeController) return false;
    this._activeAbortReason = reason;
    abortControllerWithReason(this._activeController, reason);
    return true;
  }

  destroy() {
    this.cancelActiveRequest("destroyed");
  }

  /** @returns {string} Runtime user ID (Cloudflare returns/rotates it per session) */
  getUserId() {
    return getUserId();
  }

  getProfileState() {
    return getProfileState();
  }

  async _callUserEndpoint(
    action,
    payload = {},
    { allowWithoutUserId = false } = {},
  ) {
    const currentUserId = getUserId();
    const controller = new AbortController();
    const clearTimeoutAbort = createAbortTimer(
      controller,
      this.requestTimeoutMs,
      "request-timeout",
    );

    try {
      const response = await this.fetchImpl(USER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentUserId ? { [USER_ID_HEADER]: currentUserId } : {}),
        },
        credentials: "same-origin",
        body: JSON.stringify({
          action,
          ...(currentUserId ? { userId: currentUserId } : {}),
          ...payload,
        }),
        signal: controller.signal,
      });

      syncUserIdFromResponse(response);

      let data = {};
      try {
        data = await response.json();
      } catch {
        /* ignore */
      }

      if (!response.ok || !data?.success) {
        return {
          success: false,
          status: response.status,
          data,
          text:
            data?.text || `Profil-Anfrage fehlgeschlagen (${response.status}).`,
        };
      }

      if (data.userId) {
        persistUserId(data.userId);
      } else if (!allowWithoutUserId && action === "disconnect") {
        clearPersistedUserId();
      }
      const profileState = syncProfileStateFromPayload(data);

      return {
        success: true,
        status: response.status,
        data,
        profile: profileState,
        text: data?.text || "",
      };
    } catch (error) {
      const text = isAbortLikeError(error)
        ? "Profil-Anfrage dauert zu lange. Bitte erneut versuchen."
        : "Profil-Anfrage nicht erreichbar. Bitte erneut versuchen.";
      return {
        success: false,
        status: 0,
        data: {},
        text,
      };
    } finally {
      clearTimeoutAbort();
    }
  }

  async activateProfile(targetUserId) {
    const value = normalizeUserId(targetUserId);
    if (!value) {
      return {
        success: false,
        text: "Kein gültiges Profil zum Laden gefunden.",
      };
    }

    const result = await this._callUserEndpoint(
      "activate",
      { targetUserId: value },
      { allowWithoutUserId: true },
    );
    if (!result.success) return result;

    runtimeConversationHistory = [];
    setRecoveryState(null);
    return {
      success: true,
      userId: value,
      memories: Array.isArray(result.data?.memories)
        ? result.data.memories
        : [],
      profile: result.profile,
      text: result.text || "Profil erfolgreich geladen.",
    };
  }

  async disconnectCurrentDevice() {
    const result = await this._callUserEndpoint(
      "disconnect",
      {},
      { allowWithoutUserId: true },
    );
    if (result.success) {
      runtimeConversationHistory = [];
      clearPersistedUserId();
      setRecoveryState(null);
    }

    return {
      success: result.success,
      userId: result.success ? "" : getUserId(),
      profile: result.success
        ? getProfileState()
        : result.profile || getProfileState(),
      text:
        result.text ||
        "Dieses Gerät ist nicht mehr mit einem Profil verbunden.",
    };
  }

  startFreshLocalProfile() {
    setRecoveryState(null);
    setProfileState({
      userId: getUserId(),
      name: "",
      status: getUserId() ? "anonymous" : "disconnected",
    });
    return getProfileState();
  }

  async updateCloudflareMemory({ key, value, previousValue = "" } = {}) {
    const result = await this._callUserEndpoint("update-memory", {
      key,
      value,
      previousValue,
    });
    return {
      success: result.success,
      memories: Array.isArray(result.data?.memories)
        ? result.data.memories
        : [],
      profile: result.profile || getProfileState(),
      text: result.text,
    };
  }

  async forgetCloudflareMemory({ key, value = "" } = {}) {
    const result = await this._callUserEndpoint("forget-memory", {
      key,
      value,
    });
    return {
      success: result.success,
      memories: Array.isArray(result.data?.memories)
        ? result.data.memories
        : [],
      profile: result.profile || getProfileState(),
      text: result.text,
    };
  }

  /** Load stored memories for current user from Cloudflare */
  async listCloudflareMemories() {
    const userId = getUserId();
    if (!userId) {
      return {
        success: false,
        memories: [],
        text: "Keine aktive User-ID vorhanden. Sende erst eine Nachricht.",
      };
    }

    const result = await this._callUserEndpoint("list");
    if (!result.success) {
      return {
        success: false,
        memories: [],
        profile: getProfileState(),
        text: result.text,
      };
    }

    return {
      success: true,
      memories: Array.isArray(result.data?.memories)
        ? result.data.memories
        : [],
      profile: result.profile || getProfileState(),
      retentionDays:
        Number.isFinite(Number(result.data?.retentionDays)) &&
        Number(result.data.retentionDays) > 0
          ? Number(result.data.retentionDays)
          : 0,
      text: result.text || "",
    };
  }

  /** Validate image before upload */
  validateImage(file) {
    if (!file || !(file instanceof File))
      return { valid: false, error: "Keine gültige Datei." };
    if (file.size > MAX_IMAGE_SIZE)
      return {
        valid: false,
        error: `Bild zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 5 MB.`,
      };
    if (!ALLOWED_IMAGE_TYPES.includes(file.type))
      return {
        valid: false,
        error: `Typ nicht unterstützt: ${file.type}. Erlaubt: JPEG, PNG, WebP, GIF.`,
      };
    return { valid: true, file };
  }
}

export const __test__ = {
  createToolCallKey,
  getAbortResultText,
  getProfileState,
  getUserId,
  persistUserId,
  clearPersistedUserId,
  parseSSEStream,
  syncProfileStateFromPayload,
};
