/**
 * AI Agent Service v3 — Real SSE Streaming, Tool-Calling & Memory
 *
 * Connects to POST /api/ai-agent which streams Server-Sent Events.
 * Falls back to JSON for non-streaming calls (proactive suggestions).
 *
 * @version 3.0.0
 */

import { createLogger } from '../../core/logger.js';
import { executeTool } from './modules/tool-executor.js';

const log = createLogger('AIAgentService');

const AGENT_ENDPOINT = '/api/ai-agent';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const CONVERSATION_HISTORY_KEY = 'jules-conversation-history';
const USER_ID_KEY = 'jules-user-id';
const MAX_HISTORY_LENGTH = 20;

// ─── Circuit Breaker ────────────────────────────────────────────────────────────

const circuit = {
  failures: 0,
  openedAt: 0,
  threshold: 3,
  cooldown: 120_000,
};

function isCircuitOpen() {
  if (!circuit.openedAt) return false;
  if (Date.now() - circuit.openedAt < circuit.cooldown) return true;
  // Half-open after cooldown
  circuit.openedAt = 0;
  circuit.failures = Math.max(0, circuit.threshold - 1);
  return false;
}

function recordSuccess() {
  circuit.failures = 0;
  circuit.openedAt = 0;
}

function recordFailure() {
  circuit.failures++;
  if (circuit.failures >= circuit.threshold && !circuit.openedAt) {
    circuit.openedAt = Date.now();
    log.warn('Circuit breaker opened — AI calls paused for 2 min');
  }
}

// ─── User ID ────────────────────────────────────────────────────────────────────

function getUserId() {
  try {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

// ─── Conversation History ───────────────────────────────────────────────────────

function getConversationHistory() {
  try {
    return JSON.parse(localStorage.getItem(CONVERSATION_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveConversationHistory(history) {
  try {
    localStorage.setItem(
      CONVERSATION_HISTORY_KEY,
      JSON.stringify(history.slice(-MAX_HISTORY_LENGTH)),
    );
  } catch {
    /* storage unavailable */
  }
}

function addToHistory(role, content) {
  const history = getConversationHistory();
  history.push({ role, content, timestamp: Date.now() });
  saveConversationHistory(history);
}

// ─── Image Validation ───────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

function validateImageFile(file) {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: 'Keine gültige Datei.' };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `Bild zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: 5 MB.`,
    };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Dateityp nicht unterstützt: ${file.type}. Erlaubt: JPEG, PNG, WebP, GIF.`,
    };
  }
  return { valid: true, file };
}

// ─── SSE Stream Parser ──────────────────────────────────────────────────────────

/**
 * Parse an SSE stream from the AI agent endpoint.
 *
 * Callbacks:
 * - onToken(text)       — incremental text delta
 * - onTool(toolEvent)   — tool call status updates
 * - onStatus(phase)     — thinking / streaming / synthesizing
 * - onMessage(msg)      — final complete message payload
 * - onError(err)        — error event
 *
 * @param {Response} response
 * @param {Object} callbacks
 * @returns {Promise<Object>} Final message payload
 */
async function parseSSEStream(response, callbacks = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalMessage = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events (double newline delimited)
      const events = buffer.split('\n\n');
      buffer = events.pop() || ''; // Keep incomplete event in buffer

      for (const event of events) {
        if (!event.trim()) continue;

        let eventType = '';
        let eventData = '';

        for (const line of event.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData += line.slice(6);
          }
        }

        if (!eventType || !eventData) continue;

        let data;
        try {
          data = JSON.parse(eventData);
        } catch {
          continue;
        }

        switch (eventType) {
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
            finalMessage = data;
            callbacks.onMessage?.(data);
            break;
          case 'error':
            callbacks.onError?.(data);
            break;
          case 'done':
            // Stream finished
            break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return finalMessage;
}

// ─── Core Streaming Call ────────────────────────────────────────────────────────

/**
 * @typedef {Object} AgentResponse
 * @property {string} text
 * @property {Array<{name: string, arguments: Object}>} toolCalls
 * @property {boolean} hasMemory
 * @property {boolean} hasImage
 * @property {Array<{name: string, success: boolean, message: string}>} toolResults
 */

/**
 * Call the AI Agent API with real SSE streaming.
 *
 * @param {Object} payload - { prompt, image? }
 * @param {Object} [callbacks] - { onToken, onTool, onStatus }
 * @param {Object} [options] - { stream?, maxRetries? }
 * @returns {Promise<AgentResponse>}
 */
async function callAgentAPI(payload, callbacks = {}, options = {}) {
  const stream = options.stream !== false;

  const errorResult = (text) => ({
    text,
    toolCalls: [],
    hasMemory: false,
    hasImage: false,
    toolResults: [],
  });

  // Offline / circuit breaker check
  const offline =
    typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offline || isCircuitOpen()) {
    const fallback =
      '🤖 Ich bin gerade offline. Bitte versuche es später erneut.';
    callbacks.onToken?.(fallback);
    return errorResult(fallback);
  }

  const userId = getUserId();
  const conversationHistory = getConversationHistory();

  // ── 1. Fetch ──────────────────────────────────────────────
  let response;
  try {
    if (payload.image) {
      const formData = new FormData();
      formData.append('prompt', payload.prompt || '');
      formData.append('userId', userId);
      formData.append('image', payload.image);

      response = await fetch(AGENT_ENDPOINT, {
        method: 'POST',
        body: formData,
      });
    } else {
      response = await fetch(AGENT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: payload.prompt,
          userId,
          conversationHistory,
          mode: 'agent',
          stream,
        }),
      });
    }
  } catch (fetchError) {
    // TypeError = CORS or network error, AbortError = timeout
    log.error(
      `Fetch failed [${fetchError?.name}]:`,
      fetchError?.message,
      fetchError?.stack,
    );
    recordFailure();
    const fallback =
      fetchError?.name === 'TypeError'
        ? 'Netzwerkfehler — bitte prüfe deine Verbindung und versuche es erneut.'
        : 'Verbindung zum KI-Dienst fehlgeschlagen. Bitte versuche es erneut.';
    callbacks.onToken?.(fallback);
    return errorResult(fallback);
  }

  // ── 2. Response status ────────────────────────────────────
  if (!response.ok) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = {};
    }

    // Rate limited — inform user, don't trip circuit breaker
    if (response.status === 429) {
      const retryAfter = errorBody.retryAfter || 60;
      const text = `⏳ Zu viele Anfragen. Bitte warte ${retryAfter} Sekunden.`;
      callbacks.onToken?.(text);
      return errorResult(text);
    }

    if (errorBody.retryable === false) {
      log.warn('Non-retryable AI error:', response.status);
      const text =
        errorBody.text || 'Der KI-Dienst ist momentan nicht verfügbar.';
      callbacks.onToken?.(text);
      return errorResult(text);
    }

    log.error(`API returned ${response.status}:`, errorBody);
    recordFailure();
    const fallback =
      errorBody.text ||
      `KI-Dienst-Fehler (${response.status}). Bitte versuche es erneut.`;
    callbacks.onToken?.(fallback);
    return errorResult(fallback);
  }

  recordSuccess();

  const contentType = response.headers.get('content-type') || '';

  // ── 3. SSE Stream ────────────────────────────────────────
  if (contentType.includes('text/event-stream')) {
    try {
      let fullText = '';
      const toolResults = [];

      const finalMessage = await parseSSEStream(response, {
        onToken(delta) {
          fullText += delta;
          try {
            callbacks.onToken?.(fullText);
          } catch (cbErr) {
            log.warn('onToken callback error:', cbErr?.message);
          }
        },
        onTool(toolEvent) {
          // Execute client-side tools immediately
          if (toolEvent.status === 'client') {
            try {
              const result = executeTool({
                name: toolEvent.name,
                arguments: toolEvent.arguments,
              });
              toolResults.push({ name: toolEvent.name, ...result });
              log.info(`Tool executed: ${toolEvent.name}`, result);
            } catch (toolErr) {
              log.warn(`Tool execution error: ${toolEvent.name}`, toolErr);
            }
          }
          callbacks.onTool?.(toolEvent);
        },
        onStatus(phase) {
          callbacks.onStatus?.(phase);
        },
        onError(err) {
          log.error('SSE error event:', err);
          callbacks.onError?.(err);
        },
        onMessage(msg) {
          // Execute any remaining client tool calls from final message
          if (Array.isArray(msg.toolCalls)) {
            for (const tc of msg.toolCalls) {
              if (!toolResults.some((r) => r.name === tc.name)) {
                try {
                  const result = executeTool(tc);
                  toolResults.push({ name: tc.name, ...result });
                  log.info(`Tool executed: ${tc.name}`, result);
                } catch (toolErr) {
                  log.warn(`Tool execution error: ${tc.name}`, toolErr);
                }
              }
            }
          }
        },
      });

      const text = finalMessage?.text || fullText;

      addToHistory('user', payload.prompt);
      if (text) addToHistory('assistant', text);

      return {
        text,
        toolCalls: finalMessage?.toolCalls || [],
        hasMemory: finalMessage?.hasMemory || false,
        hasImage: finalMessage?.hasImage || false,
        toolResults,
      };
    } catch (sseError) {
      log.error(
        `SSE parsing failed [${sseError?.name}]:`,
        sseError?.message,
        sseError?.stack,
      );
      recordFailure();
      const fallback =
        'Fehler beim Lesen der KI-Antwort. Bitte versuche es erneut.';
      callbacks.onToken?.(fallback);
      return errorResult(fallback);
    }
  }

  // ── 4. JSON fallback (non-streaming) ──────────────────────
  try {
    const result = await response.json();

    addToHistory('user', payload.prompt);
    if (result.text) addToHistory('assistant', result.text);

    // Execute client tool calls
    const toolResults = [];
    if (Array.isArray(result.toolCalls)) {
      for (const tc of result.toolCalls) {
        try {
          const toolResult = executeTool(tc);
          toolResults.push({ name: tc.name, ...toolResult });
          log.info(`Tool executed: ${tc.name}`, toolResult);
        } catch (toolErr) {
          log.warn(`Tool execution error: ${tc.name}`, toolErr);
        }
      }
    }

    callbacks.onToken?.(result.text || '');

    return {
      text: result.text || '',
      toolCalls: result.toolCalls || [],
      hasMemory: result.hasMemory || false,
      hasImage: result.hasImage || false,
      toolResults,
    };
  } catch (jsonError) {
    log.error(
      `JSON parsing failed [${jsonError?.name}]:`,
      jsonError?.message,
      jsonError?.stack,
    );
    recordFailure();
    const fallback =
      'Fehler beim Lesen der KI-Antwort. Bitte versuche es erneut.';
    callbacks.onToken?.(fallback);
    return errorResult(fallback);
  }
}

// ─── AI Agent Service Class ─────────────────────────────────────────────────────

export class AIAgentService {
  /**
   * Generate a streaming agent response with tool-calling.
   *
   * @param {string} prompt - User message
   * @param {Function} [onToken] - Called with accumulated text on each token
   * @param {Object} [callbacks] - { onTool, onStatus, onError }
   * @returns {Promise<AgentResponse>}
   */
  async generateResponse(prompt, onToken, callbacks = {}) {
    return callAgentAPI(
      { prompt },
      { onToken, ...callbacks },
      { stream: true },
    );
  }

  /**
   * Analyze an image with optional prompt (streamed).
   *
   * @param {File} imageFile
   * @param {string} [prompt]
   * @param {Function} [onToken]
   * @returns {Promise<AgentResponse>}
   */
  async analyzeImage(imageFile, prompt = '', onToken) {
    const validation = validateImageFile(imageFile);
    if (!validation.valid) {
      const error = `⚠️ ${validation.error}`;
      onToken?.(error);
      return {
        text: error,
        toolCalls: [],
        hasMemory: false,
        hasImage: false,
        toolResults: [],
      };
    }

    return callAgentAPI(
      { prompt: prompt || 'Analysiere dieses Bild.', image: imageFile },
      { onToken },
      { stream: true },
    );
  }

  /**
   * Get proactive suggestion (non-streaming, single request).
   *
   * @param {Object} contextData
   * @returns {Promise<string>}
   */
  async getProactiveSuggestion(contextData) {
    try {
      let promptText = `Gib einen kurzen, proaktiven Tipp für den Nutzer auf der Seite "${contextData.title || 'Unbekannt'}" (${contextData.url || '/'}). Maximal 2 Sätze.`;

      if (contextData.headline) {
        promptText += `\nÜberschrift der Seite: "${contextData.headline}"`;
      }
      if (contextData.description) {
        promptText += `\nBeschreibung: "${contextData.description}"`;
      }
      if (contextData.contentSnippet) {
        promptText += `\nAuszug des Seiteninhalts:\n"${contextData.contentSnippet.substring(0, 500)}..."`;
      }

      const response = await callAgentAPI(
        { prompt: promptText },
        {},
        { stream: false },
      );
      return response.text;
    } catch {
      return '';
    }
  }

  /** Clear conversation history */
  clearHistory() {
    try {
      localStorage.removeItem(CONVERSATION_HISTORY_KEY);
    } catch {
      /* ignore */
    }
  }

  /** @returns {string} Persistent user ID */
  getUserId() {
    return getUserId();
  }

  /**
   * Validate image before upload.
   * @param {File} file
   * @returns {{ valid: boolean, error?: string }}
   */
  validateImage(file) {
    return validateImageFile(file);
  }
}
