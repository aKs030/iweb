/**
 * Client wrapper for `/api/ai-agent` and `/api/ai-agent-user`.
 * Handles streaming chat, client-side tool execution and memory utilities.
 * @version 6.0.0
 */

import { createLogger } from '../../core/logger.js';
import { executeTool } from './modules/tool-executor.js';
import {
  abortControllerWithReason,
  createAbortTimer,
  createStreamIdleGuard,
  createToolCallKey,
  getAbortReason,
  getAbortResultText,
  isAbortLikeError,
  parseSSEStream,
} from './modules/sse-stream-parser.js';
import {
  addToHistory,
  clearHistory as clearIdentityHistory,
  clearPersistedUserId,
  getHistory,
  getProfileState,
  getUserId,
  persistUserId,
  setProfileState,
  setRecoveryState,
  shouldPersistIdentityFromPayload,
  syncProfileStateFromPayload,
  syncUserIdFromResponse,
} from './modules/user-identity.js';

const log = createLogger('AIAgentService');

const AGENT_ENDPOINT = '/api/ai-agent';
const USER_ENDPOINT = '/api/ai-agent-user';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const USER_ID_HEADER = 'x-jules-user-id';
const REQUEST_TIMEOUT_MS = 25000;
const STREAM_IDLE_TIMEOUT_MS = 12000;

// ─── Helpers ────────────────────────────────────────────────────────────────────

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
  const a = String(finalText || '').trim();
  const b = String(streamedText || '').trim();
  if (!a) return b;
  if (!b) return a;
  return a.length >= b.length ? a : b;
};

// ─── Core API Call ──────────────────────────────────────────────────────────────

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
          credentials: 'same-origin',
          signal: controller.signal,
        });
      } else {
        response = await service.fetchImpl(AGENT_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...userIdHeader,
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            prompt: payload.prompt,
            ...(userId ? { userId } : {}),
            conversationHistory: getHistory(),
            stream,
          }),
          signal: controller.signal,
        });
      }
    } catch (err) {
      const abortReason = getAbortReason(service, controller);
      if (isAbortLikeError(err)) {
        const text = getAbortResultText(abortReason);
        if (text) callbacks.onToken?.(text);
        return mkResult(text, { aborted: true });
      }

      log.error('Fetch failed:', err?.message || err);
      const text = 'KI-Dienst nicht erreichbar. Bitte erneut versuchen.';
      callbacks.onToken?.(text);
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
      return await handleSSEResponse(
        service,
        response,
        controller,
        payload,
        callbacks,
      );
    }

    // ── JSON response ──
    return await handleJSONResponse(response, payload, callbacks);
  } finally {
    if (service._activeController === controller) {
      service._activeController = null;
      service._activeAbortReason = '';
    }
  }
}

async function handleSSEResponse(
  service,
  response,
  controller,
  payload,
  callbacks,
) {
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
          for (const tc of msg.toolCalls) runClientTool(tc);
        }
      },
    },
    {
      idleGuard,
      onIdentity: (id) => persistUserId(id),
    },
  );

  if (shouldPersistIdentityFromPayload(finalMessage)) {
    syncUserIdFromResponse(response);
  }
  const profileState = syncProfileStateFromPayload(finalMessage || {});
  const text = pickBestText(finalMessage?.text, fullText);
  addToHistory('user', payload.prompt);
  if (text) addToHistory('assistant', text);

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

async function handleJSONResponse(response, payload, callbacks) {
  const result = await response.json();
  if (shouldPersistIdentityFromPayload(result)) {
    syncUserIdFromResponse(response);
  }
  if (shouldPersistIdentityFromPayload(result) && result.userId) {
    persistUserId(result.userId);
  }
  const profileState = syncProfileStateFromPayload(result);

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
    profile: profileState,
    recovery: profileState.recovery,
  });
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
    clearIdentityHistory();
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
      'request-timeout',
    );

    try {
      const response = await this.fetchImpl(USER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUserId ? { [USER_ID_HEADER]: currentUserId } : {}),
        },
        credentials: 'same-origin',
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
      } else if (!allowWithoutUserId && action === 'disconnect') {
        clearPersistedUserId();
      }
      const profileState = syncProfileStateFromPayload(data);

      return {
        success: true,
        status: response.status,
        data,
        profile: profileState,
        text: data?.text || '',
      };
    } catch (error) {
      const text = isAbortLikeError(error)
        ? 'Profil-Anfrage dauert zu lange. Bitte erneut versuchen.'
        : 'Profil-Anfrage nicht erreichbar. Bitte erneut versuchen.';
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

  async disconnectCurrentDevice() {
    const result = await this._callUserEndpoint(
      'disconnect',
      {},
      { allowWithoutUserId: true },
    );
    if (result.success) {
      clearIdentityHistory();
      clearPersistedUserId();
      setRecoveryState(null);
    }

    return {
      success: result.success,
      userId: result.success ? '' : getUserId(),
      profile: result.success
        ? getProfileState()
        : result.profile || getProfileState(),
      text:
        result.text ||
        'Dieses Gerät ist nicht mehr mit einem Profil verbunden.',
    };
  }

  startFreshLocalProfile() {
    setRecoveryState(null);
    setProfileState({
      userId: getUserId(),
      name: '',
      status: getUserId() ? 'anonymous' : 'disconnected',
    });
    return getProfileState();
  }

  async updateCloudflareMemory({ key, value, previousValue = '' } = {}) {
    const result = await this._callUserEndpoint('update-memory', {
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

  async forgetCloudflareMemory({ key, value = '' } = {}) {
    const result = await this._callUserEndpoint('forget-memory', {
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

  async activateRecoveredProfile({ userId, name } = {}) {
    const result = await this._callUserEndpoint(
      'activate',
      {
        targetUserId: userId,
        name,
      },
      { allowWithoutUserId: true },
    );

    return {
      success: result.success,
      memories: Array.isArray(result.data?.memories)
        ? result.data.memories
        : [],
      profile: result.profile || getProfileState(),
      retentionDays:
        Number.isFinite(Number(result.data?.retentionDays)) &&
        Number(result.data.retentionDays) > 0
          ? Number(result.data.retentionDays)
          : 0,
      text: result.text,
    };
  }

  async listCloudflareMemories() {
    const result = await this._callUserEndpoint(
      'list',
      {},
      { allowWithoutUserId: true },
    );
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
      text: result.text || '',
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
  getProfileState,
  getUserId,
  persistUserId,
  clearPersistedUserId,
  parseSSEStream,
  syncProfileStateFromPayload,
};
