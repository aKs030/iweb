// @ts-nocheck
/**
 * AI Agent Service — SSE Streaming, Tool-Calling & Memory
 * Pure AI-first: Kein Offline-Fallback, kein Circuit Breaker.
 * @version 5.0.0
 */

import { createLogger } from '../../core/logger.js';
import { executeTool } from './modules/tool-executor.js';

const log = createLogger('AIAgentService');

const AGENT_ENDPOINT = '/api/ai-agent';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const USER_ID_HEADER = 'x-jules-user-id';
const MAX_HISTORY = 20;
let runtimeUserId = '';
let runtimeConversationHistory = [];

// track when persistUserId rewrote the URL so callers can notify the user
let urlUpdatedFlag = false;

// clears and returns the current flag state; used by callers to know if the
// address bar was rewritten during the last getUserId() invocation.
function consumeUrlUpdatedFlag() {
  const v = urlUpdatedFlag;
  urlUpdatedFlag = false;
  return v;
}

// ─── User ID & History ──────────────────────────────────────────────────────────

function normalizeUserId(raw) {
  const value = String(raw || '').trim();
  if (!value || value === 'anonymous') return '';
  if (!/^[A-Za-z0-9_-]{3,120}$/.test(value)) return '';
  return value;
}

function createUserId(prefix = 'anon') {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function persistUserId(id, { syncUrl = true } = {}) {
  const value = normalizeUserId(id);
  if (!value) return '';
  runtimeUserId = value;

  // Name-basierte Sessions werden nur per URL (name=...) geteilt.
  // Es wird absichtlich NICHT in localStorage/cookies persistiert.
  if (syncUrl && typeof window !== 'undefined' && value.startsWith('name_')) {
    try {
      const nameValue = value.slice(5);
      if (!nameValue) return value;
      const url = new URL(window.location.href);
      if (url.searchParams.get('name') !== nameValue) {
        url.searchParams.set('name', nameValue);
        window.history.replaceState(null, '', url.toString());
        log.debug('name-based identity written to URL', nameValue);
        urlUpdatedFlag = true;
      }
    } catch {
      /* ignore */
    }
  }

  return value;
}

// Parse and normalize a `?name=` query parameter from the current URL.
function extractNameFromUrl() {
  if (typeof window === 'undefined') return '';
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('name') || '';
    return normalizeUserId(param.trim());
  } catch {
    return '';
  }
}

function getUserId() {
  // reset flag at start of lookup
  urlUpdatedFlag = false;
  // if a global name is supplied, it takes absolute precedence
  if (typeof window !== 'undefined') {
    let globalName = window.ROBOT_USER_NAME;

    // fall back to URL parameter if no global set yet; useful when the page
    // is opened with ?name=foo and the constructor hasn't run ensureName yet
    if (!globalName) {
      const urlName = extractNameFromUrl();
      if (urlName) {
        log.debug('got name from URL parameter', urlName);
        globalName = urlName;
        window.ROBOT_USER_NAME = urlName;
        window.ROBOT_NO_COOKIES = true;
      }
    }

    if (globalName) {
      const norm = normalizeUserId(globalName);
      if (norm) {
        // don't double-prefix if the string already looks like a full id
        const id = /^(?:name_|jwt_|u_|anon_)/.test(norm)
          ? norm
          : `name_${norm}`;
        return persistUserId(id, { syncUrl: true });
      }
    }
  }

  if (normalizeUserId(runtimeUserId)) return runtimeUserId;

  return persistUserId(createUserId('anon'), { syncUrl: false });
}

function syncUserIdFromResponse(response) {
  const headerValue = normalizeUserId(response?.headers?.get?.(USER_ID_HEADER));
  if (!headerValue) return;

  // don’t overwrite a runtime user id that we already set manually
  if (headerValue === runtimeUserId) return;

  const shouldSyncUrl = headerValue.startsWith('name_');
  persistUserId(headerValue, { syncUrl: shouldSyncUrl });
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

// ─── SSE Stream Parser ──────────────────────────────────────────────────────────

async function parseSSEStream(response, callbacks = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalMessage = null;

  const handleEvent = async (event) => {
    if (!event || !event.trim()) return;

    let eventType = '';
    let eventData = '';

    for (const line of event.split('\n')) {
      if (line.startsWith('event: ')) eventType = line.slice(7).trim();
      else if (line.startsWith('data: ')) eventData += line.slice(6);
    }

    if (!eventType || !eventData) return;

    let data;
    try {
      data = JSON.parse(eventData);
    } catch (err) {
      log.error('[AIAgent] malformed SSE event', eventType, eventData, err);
      return;
    }

    switch (eventType) {
      case 'token':
        callbacks.onToken?.(data.text || '');
        break;
      case 'tool':
        callbacks.onTool?.(data);
        // sync name if agent remembered it
        if (
          data.name === 'rememberUser' &&
          data.arguments?.key === 'name' &&
          data.arguments?.value
        ) {
          const norm = normalizeUserId(data.arguments.value);
          if (norm && typeof window !== 'undefined') {
            /** @type {any} */ (window).ROBOT_USER_NAME = norm;
            /** @type {any} */ (window).ROBOT_NO_COOKIES = true;
            try {
              const url = new URL(window.location.href);
              url.searchParams.set('name', norm);
              window.history.replaceState(null, '', url);
            } catch {}
          }
        }
        break;
      case 'status':
        callbacks.onStatus?.(data.phase || '');
        break;
      case 'message':
        finalMessage = data;
        callbacks.onMessage?.(data);
        break;
      case 'error':
        callbacks.onError?.(data);
        break;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        await handleEvent(event);
      }
    }
    if (buffer.trim()) {
      await handleEvent(buffer);
    }
  } finally {
    reader.releaseLock();
  }

  return finalMessage;
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
  payload,
  callbacks = {},
  { stream = true, signal = undefined } = {},
) {
  log.debug('callAgent payload', payload);
  const userId = getUserId();
  const urlWasUpdated = consumeUrlUpdatedFlag();

  // ── Fetch ──
  let response;
  try {
    if (payload.image) {
      const fd = new FormData();
      fd.append('prompt', payload.prompt || '');
      fd.append('userId', userId);
      fd.append('image', payload.image);
      response = await fetch(AGENT_ENDPOINT, {
        method: 'POST',
        body: fd,
        credentials: 'omit',
        signal,
      });
    } else {
      response = await fetch(AGENT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        signal,
        body: JSON.stringify({
          prompt: payload.prompt,
          userId,
          conversationHistory: getHistory(),
          stream,
        }),
      });
    }
    syncUserIdFromResponse(response);
  } catch (err) {
    if (signal?.aborted || err?.name === 'AbortError') {
      return mkResult('', { aborted: true, urlUpdated: urlWasUpdated });
    }
    log.error('Fetch failed:', err?.message);
    const text = 'KI-Dienst nicht erreichbar. Bitte erneut versuchen.';
    callbacks.onToken?.(text);
    return mkResult(text);
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
    /** @type {{ text?: string, retryable?: boolean }|null} */
    let sseError = null;

    let finalMessage;
    try {
      finalMessage = await parseSSEStream(response, {
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
            try {
              const result = executeTool({
                name: ev.name,
                arguments: ev.arguments,
              });
              toolResults.push({ name: ev.name, ...result });
            } catch (e) {
              log.warn(`Tool error: ${ev.name}`, e);
            }
          }
          callbacks.onTool?.(ev);
        },
        onStatus(phase) {
          callbacks.onStatus?.(phase);
        },
        onError(err) {
          sseError =
            err && typeof err === 'object'
              ? err
              : { text: String(err || 'KI-Dienst fehlgeschlagen.') };
          if (sseError?.retryable) {
            log.warn('SSE error (retryable):', sseError);
          } else {
            log.error('SSE error:', sseError);
          }
          callbacks.onError?.(err);
        },
        onMessage(msg) {
          if (Array.isArray(msg.toolCalls)) {
            for (const tc of msg.toolCalls) {
              if (!toolResults.some((r) => r.name === tc.name)) {
                try {
                  const result = executeTool(tc);
                  toolResults.push({ name: tc.name, ...result });
                } catch {
                  /* skip */
                }
              }
            }
          }
        },
      });
    } catch (err) {
      if (signal?.aborted || err?.name === 'AbortError') {
        return mkResult(fullText, { aborted: true, urlUpdated: urlWasUpdated });
      }
      throw err;
    }

    const streamedOrFinalText = pickBestText(finalMessage?.text, fullText);

    // The edge function can emit an SSE error event while still returning 200.
    // If the error is retryable and we have no usable text, retry once with
    // non-streaming mode to recover a user-visible answer.
    const hasSseErrorText = Boolean(String(sseError?.text || '').trim());
    if (
      !streamedOrFinalText &&
      sseError?.retryable &&
      !hasSseErrorText &&
      !signal?.aborted &&
      stream !== false
    ) {
      const fallback = await callAgent(payload, callbacks, {
        stream: false,
        signal,
      });
      return {
        ...fallback,
        urlUpdated: Boolean(fallback?.urlUpdated || urlWasUpdated),
      };
    }

    const text =
      streamedOrFinalText ||
      String(sseError?.text || '').trim() ||
      'KI-Dienst fehlgeschlagen. Bitte erneut versuchen.';
    addToHistory('user', payload.prompt);
    if (text) addToHistory('assistant', text);

    return {
      text,
      toolCalls: finalMessage?.toolCalls || [],
      hasMemory: finalMessage?.hasMemory || false,
      hasImage: finalMessage?.hasImage || false,
      toolResults,
      urlUpdated: urlWasUpdated,
    };
  }

  // ── JSON response ──
  let result;
  try {
    result = await response.json();
  } catch (err) {
    const txt = await response.text().catch(() => '');
    log.error('[AIAgent] JSON parse failed on non-SSE response', err, txt);
    callbacks.onToken?.('Antwort konnte nicht gelesen werden.');
    return mkResult(txt || '');
  }
  addToHistory('user', payload.prompt);
  if (result.text) addToHistory('assistant', result.text);

  const toolResults = [];
  if (Array.isArray(result.toolCalls)) {
    for (const tc of result.toolCalls) {
      try {
        toolResults.push({ name: tc.name, ...executeTool(tc) });
      } catch {
        /* skip */
      }

      // keep local identity in sync if the AI remembered the name
      if (
        tc.name === 'rememberUser' &&
        tc.arguments?.key === 'name' &&
        tc.arguments?.value
      ) {
        const norm = normalizeUserId(tc.arguments.value);
        if (norm) {
          window.ROBOT_USER_NAME = norm;
          window.ROBOT_NO_COOKIES = true;
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('name', norm);
            window.history.replaceState(null, '', url);
          } catch {}
        }
      }
    }
  }

  return {
    text: result.text || '',
    toolCalls: result.toolCalls || [],
    hasMemory: result.hasMemory || false,
    hasImage: result.hasImage || false,
    toolResults,
    urlUpdated: urlWasUpdated,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Manually override the current user id with a name-based identifier.
 * The value is normalized and prefixed with "name_". Identity is only kept
 * in runtime memory and optional `?name=` URL sharing (no localStorage/cookies).
 *
 * @param {string} name
 * @returns {string} normalized user id or empty string if invalid
 */
export function setUserName(name) {
  const normalized = normalizeUserId(name);
  if (!normalized) return '';
  const userId = `name_${normalized}`;
  persistUserId(userId, { syncUrl: true });
  return userId;
}

export { getUserId };

export class AIAgentService {
  /** Streaming agent response with tool-calling */
  generateResponse(prompt, onToken, callbacks = {}, options = {}) {
    return callAgent({ prompt }, { onToken, ...callbacks }, options);
  }

  /** expose current user id to callers */
  getUserId() {
    return getUserId();
  }

  /**
   * Helper exposed on the instance for convenience.
   */
  setUserName(name, opts) {
    return setUserName(name, opts);
  }

  /**
   * Short helper that invokes the rememberUser tool on the AI agent.  Useful
   * for client-triggered memorization without sending a user-visible prompt.
   *
   * @param {string} key
   * @param {string} value
   * @returns {Promise<object>} result of the agent call
   */
  async remember(key, value) {
    // callAgent is defined in this module's scope
    // The AI endpoint rejects empty prompts, so include a harmless space.
    return callAgent(
      {
        prompt: ' ', // non-empty to satisfy server-side validation
        toolCalls: [{ name: 'rememberUser', arguments: { key, value } }],
        stream: false,
      },
      {},
      { stream: false },
    );
  }

  /** Analyze an image with optional prompt (streamed) */
  analyzeImage(imageFile, prompt = '', onToken, options = {}) {
    const v = this.validateImage(imageFile);
    if (!v.valid) {
      const err = `⚠️ ${v.error}`;
      onToken?.(err);
      return Promise.resolve(mkResult(err));
    }
    return callAgent(
      { prompt: prompt || 'Analysiere dieses Bild.', image: imageFile },
      { onToken },
      options,
    );
  }

  /** Clear conversation history */
  clearHistory() {
    runtimeConversationHistory = [];
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
