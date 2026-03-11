/**
 * Client wrapper for `/api/ai-agent` and `/api/ai-agent-user`.
 * Handles streaming chat, client-side tool execution and memory utilities.
 * @version 5.0.0
 */

import { createLogger } from '../../core/logger.js';
import { executeTool } from './modules/tool-executor.js';

const log = createLogger('AIAgentService');

const AGENT_ENDPOINT = '/api/ai-agent';
const DELETE_USER_ENDPOINT = '/api/ai-agent-user';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const USER_ID_HEADER = 'x-jules-user-id';
const MAX_HISTORY = 20;
const REQUEST_TIMEOUT_MS = 25000;
const STREAM_IDLE_TIMEOUT_MS = 12000;
let runtimeUserId = '';
let runtimeConversationHistory = [];

// ─── User ID & History ──────────────────────────────────────────────────────────

function normalizeUserId(raw) {
  const value = String(raw || '').trim();
  if (!value || value === 'anonymous') return '';
  if (!/^[A-Za-z0-9_-]{3,120}$/.test(value)) return '';
  return value;
}

function persistUserId(id) {
  const value = normalizeUserId(id);
  if (!value) return '';
  runtimeUserId = value;
  return value;
}

function getUserId() {
  return normalizeUserId(runtimeUserId);
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
    error?.name === 'AbortError' ||
    error?.name === 'TimeoutError' ||
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
    'aborted'
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
      abortControllerWithReason(controller, 'stream-idle');
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
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value ?? null);
}

function createToolCallKey(toolCall) {
  return `${String(toolCall?.name || '').trim()}:${stableSerialize(toolCall?.arguments || {})}`;
}

function getAbortResultText(reason) {
  switch (reason) {
    case 'request-timeout':
    case 'stream-idle':
      return 'Die Antwort dauert zu lange. Bitte versuche es erneut.';
    case 'history-cleared':
    case 'destroyed':
    case 'cancelled':
      return '';
    default:
      return 'Die Anfrage wurde abgebrochen. Bitte versuche es erneut.';
  }
}

// ─── SSE Stream Parser ──────────────────────────────────────────────────────────

function processSSEEventBlock(eventBlock, callbacks, finalMessageRef) {
  if (!eventBlock.trim()) return;

  let eventType = '';
  const dataLines = [];

  for (const rawLine of eventBlock.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  const eventData = dataLines.join('\n').trim();
  if (!eventType || !eventData || eventData === '[DONE]') return;

  let data;
  try {
    data = JSON.parse(eventData);
  } catch {
    return;
  }

  switch (eventType) {
    case 'identity':
      if (data.userId) {
        persistUserId(data.userId);
      }
      break;
    case 'token':
      callbacks.onToken?.(data.text || '');
      break;
    case 'tool':
      callbacks.onTool?.(data);
      break;
    case 'status':
      callbacks.onStatus?.(data.phase || '');
      break;
    case 'message':
      finalMessageRef.current = data;
      callbacks.onMessage?.(data);
      break;
    case 'error':
      callbacks.onError?.(data);
      break;
    default:
      break;
  }
}

async function parseSSEStream(response, callbacks = {}, options = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const finalMessageRef = { current: null };
  const idleGuard = options.idleGuard || null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      idleGuard?.touch();

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

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
  ...extra,
});

const pickBestText = (finalText, streamedText) => {
  const a = String(finalText || '').trim();
  const b = String(streamedText || '').trim();
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
    'request-timeout',
  );
  service._activeController = controller;
  service._activeAbortReason = '';

  try {
    // ── Fetch ──
    let response;
    try {
      if (payload.image) {
        const fd = new FormData();
        fd.append('prompt', payload.prompt || '');
        if (userId) fd.append('userId', userId);
        fd.append('image', payload.image);
        response = await service.fetchImpl(AGENT_ENDPOINT, {
          method: 'POST',
          headers: userIdHeader,
          body: fd,
          credentials: 'omit',
          signal: controller.signal,
        });
      } else {
        response = await service.fetchImpl(AGENT_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...userIdHeader,
          },
          credentials: 'omit',
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

      log.error('Fetch failed:', err?.message || err);
      const text = 'KI-Dienst nicht erreichbar. Bitte erneut versuchen.';
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

    const contentType = response.headers.get('content-type') || '';

    // ── SSE Stream ──
    if (contentType.includes('text/event-stream')) {
      let fullText = '';
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
          log.warn(`Tool error: ${toolCall?.name || 'unknown'}`, error);
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
            if (ev.status === 'client') {
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
            log.error('SSE error:', err);
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

      const text = pickBestText(finalMessage?.text, fullText);
      addToHistory('user', payload.prompt);
      if (text) addToHistory('assistant', text);

      return {
        text,
        toolCalls: finalMessage?.toolCalls || [],
        hasMemory: finalMessage?.hasMemory || false,
        hasImage: finalMessage?.hasImage || false,
        toolResults,
      };
    }

    // ── JSON response ──
    const result = await response.json();
    if (result.userId) {
      persistUserId(result.userId);
    }

    addToHistory('user', payload.prompt);
    if (result.text) addToHistory('assistant', result.text);

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

    callbacks.onToken?.(result.text || '');
    return mkResult(result.text || '', {
      toolCalls: result.toolCalls || [],
      hasMemory: result.hasMemory || false,
      hasImage: result.hasImage || false,
      toolResults,
    });
  } finally {
    if (service._activeController === controller) {
      service._activeController = null;
      service._activeAbortReason = '';
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
      typeof fetchImpl === 'function'
        ? fetchImpl
        : globalThis.fetch?.bind(globalThis);
    this.requestTimeoutMs = requestTimeoutMs;
    this.streamIdleTimeoutMs = streamIdleTimeoutMs;
    this._activeController = null;
    this._activeAbortReason = '';
  }

  /** Streaming agent response with tool-calling */
  generateResponse(prompt, onToken, callbacks = {}) {
    return callAgent(this, { prompt }, { onToken, ...callbacks });
  }

  /** Analyze an image with optional prompt (streamed) */
  analyzeImage(imageFile, prompt = '', onToken) {
    const v = this.validateImage(imageFile);
    if (!v.valid) {
      const err = `⚠️ ${v.error}`;
      onToken?.(err);
      return Promise.resolve(mkResult(err));
    }
    return callAgent(
      this,
      { prompt: prompt || 'Analysiere dieses Bild.', image: imageFile },
      { onToken },
    );
  }

  /** Clear conversation history */
  clearHistory() {
    this.cancelActiveRequest('history-cleared');
    runtimeConversationHistory = [];
  }

  cancelActiveRequest(reason = 'cancelled') {
    if (!this._activeController) return false;
    this._activeAbortReason = reason;
    abortControllerWithReason(this._activeController, reason);
    return true;
  }

  destroy() {
    this.cancelActiveRequest('destroyed');
  }

  /** @returns {string} Runtime user ID (Cloudflare returns/rotates it per session) */
  getUserId() {
    return getUserId();
  }

  /**
   * Delete current user identity and memory bindings from Cloudflare.
   * Resets local in-memory session identity on success.
   */
  async deleteUserIdFromCloudflare() {
    const userId = normalizeUserId(runtimeUserId);
    if (!userId) {
      return {
        success: false,
        text: 'Keine aktive User-ID vorhanden. Sende erst eine Nachricht.',
      };
    }

    let response;
    const controller = new AbortController();
    const clearTimeoutAbort = createAbortTimer(
      controller,
      this.requestTimeoutMs,
      'request-timeout',
    );
    try {
      response = await this.fetchImpl(DELETE_USER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [USER_ID_HEADER]: userId,
        },
        credentials: 'omit',
        body: JSON.stringify({ action: 'delete' }),
        signal: controller.signal,
      });
    } catch (error) {
      log.error('deleteUserIdFromCloudflare failed:', error?.message || error);
      const text = isAbortLikeError(error)
        ? 'Cloudflare-Löschung dauert zu lange. Bitte erneut versuchen.'
        : 'Cloudflare-Löschung nicht erreichbar. Bitte erneut versuchen.';
      return {
        success: false,
        text,
      };
    } finally {
      clearTimeoutAbort();
    }

    let data = {};
    try {
      data = await response.json();
    } catch {
      /* ignore */
    }

    if (!response.ok || !data?.success) {
      return {
        success: false,
        text:
          data?.text ||
          `Cloudflare-Löschung fehlgeschlagen (${response.status}).`,
      };
    }

    runtimeConversationHistory = [];
    runtimeUserId = '';
    return {
      success: true,
      userId: '',
      text:
        data?.text || 'User-ID und Erinnerungen in Cloudflare wurden gelöscht.',
    };
  }

  /** Load stored memories for current user from Cloudflare */
  async listCloudflareMemories() {
    const userId = normalizeUserId(runtimeUserId);
    if (!userId) {
      return {
        success: false,
        memories: [],
        text: 'Keine aktive User-ID vorhanden. Sende erst eine Nachricht.',
      };
    }

    let response;
    const controller = new AbortController();
    const clearTimeoutAbort = createAbortTimer(
      controller,
      this.requestTimeoutMs,
      'request-timeout',
    );
    try {
      response = await this.fetchImpl(DELETE_USER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [USER_ID_HEADER]: userId,
        },
        credentials: 'omit',
        body: JSON.stringify({ action: 'list' }),
        signal: controller.signal,
      });
    } catch (error) {
      log.error('listCloudflareMemories failed:', error?.message || error);
      const text = isAbortLikeError(error)
        ? 'Cloudflare-Erinnerungen dauern zu lange. Bitte erneut versuchen.'
        : 'Cloudflare-Erinnerungen nicht erreichbar. Bitte erneut versuchen.';
      return {
        success: false,
        memories: [],
        text,
      };
    } finally {
      clearTimeoutAbort();
    }

    let data = {};
    try {
      data = await response.json();
    } catch {
      /* ignore */
    }

    if (!response.ok || !data?.success) {
      return {
        success: false,
        memories: [],
        text:
          data?.text ||
          `Cloudflare-Erinnerungen konnten nicht geladen werden (${response.status}).`,
      };
    }

    return {
      success: true,
      memories: Array.isArray(data.memories) ? data.memories : [],
      retentionDays:
        Number.isFinite(Number(data?.retentionDays)) &&
        Number(data.retentionDays) > 0
          ? Number(data.retentionDays)
          : 0,
      text: data?.text || '',
    };
  }

  /** Validate image before upload */
  validateImage(file) {
    if (!file || !(file instanceof File))
      return { valid: false, error: 'Keine gültige Datei.' };
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
  parseSSEStream,
};
