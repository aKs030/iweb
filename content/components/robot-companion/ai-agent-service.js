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
const HISTORY_KEY = 'jules-conversation-history';
const USER_ID_KEY = 'jules-user-id';
const MAX_HISTORY = 20;

// ─── User ID & History ──────────────────────────────────────────────────────────

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

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(-MAX_HISTORY)),
    );
  } catch {
    /* ignore */
  }
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

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        if (!event.trim()) continue;

        let eventType = '';
        let eventData = '';

        for (const line of event.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim();
          else if (line.startsWith('data: ')) eventData += line.slice(6);
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
        }
      }
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

async function callAgent(payload, callbacks = {}, { stream = true } = {}) {
  const userId = getUserId();

  // ── Fetch ──
  let response;
  try {
    if (payload.image) {
      const fd = new FormData();
      fd.append('prompt', payload.prompt || '');
      fd.append('userId', userId);
      fd.append('image', payload.image);
      response = await fetch(AGENT_ENDPOINT, { method: 'POST', body: fd });
    } else {
      response = await fetch(AGENT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: payload.prompt,
          userId,
          conversationHistory: getHistory(),
          stream,
        }),
      });
    }
  } catch (err) {
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

    const finalMessage = await parseSSEStream(response, {
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
        log.error('SSE error:', err);
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
  }

  // ── JSON response ──
  const result = await response.json();
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
    }
  }

  callbacks.onToken?.(result.text || '');
  return mkResult(result.text || '', {
    toolCalls: result.toolCalls || [],
    hasMemory: result.hasMemory || false,
    hasImage: result.hasImage || false,
    toolResults,
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export class AIAgentService {
  /** Streaming agent response with tool-calling */
  generateResponse(prompt, onToken, callbacks = {}) {
    return callAgent({ prompt }, { onToken, ...callbacks });
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
      { prompt: prompt || 'Analysiere dieses Bild.', image: imageFile },
      { onToken },
    );
  }

  /** Clear conversation history */
  clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
  }

  /** @returns {string} Persistent user ID */
  getUserId() {
    return getUserId();
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
