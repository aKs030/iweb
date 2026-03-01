/**
 * AI Agent Service - Proactive AI with Tool-Calling, Image Analysis & Memory
 * Erweitert den bestehenden AIService um Agentic-Fähigkeiten.
 * @version 1.0.0
 */

import { createLogger } from '../../core/logger.js';
import { sleep } from '../../core/utils.js';
import { executeTool } from './modules/tool-executor.js';

const log = createLogger('AIAgentService');

const MAX_RETRIES = 2;
const INITIAL_DELAY = 1500;
const AGENT_ENDPOINT = '/api/ai-agent';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
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
  circuit.openedAt = 0;
  circuit.failures = Math.max(0, circuit.threshold - 1);
  return false;
}

// ─── User ID Management ─────────────────────────────────────────────────────────

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
    const trimmed = history.slice(-MAX_HISTORY_LENGTH);
    localStorage.setItem(CONVERSATION_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage not available
  }
}

function addToHistory(role, content) {
  const history = getConversationHistory();
  history.push({ role, content, timestamp: Date.now() });
  saveConversationHistory(history);
}

// ─── Streaming Simulation ───────────────────────────────────────────────────────

async function simulateStreaming(text, onChunk) {
  const tokens = text.match(/\S+\s*/g) || [];
  let accumulated = '';

  for (const token of tokens) {
    accumulated += token;
    onChunk(accumulated);
    await sleep(Math.floor(Math.random() * 30) + 15);
  }
}

// ─── Image Processing ───────────────────────────────────────────────────────────

/**
 * Process and validate an image file for upload
 * @param {File} file - Image file
 * @returns {Promise<{ valid: boolean, error?: string, file?: File }>}
 */
function validateImageFile(file) {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: 'Keine gültige Datei.' };
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `Bild zu groß (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 5MB.`,
    };
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Dateityp nicht unterstützt: ${file.type}. Erlaubt: JPEG, PNG, WebP, GIF.`,
    };
  }

  return { valid: true, file };
}

// ─── Core API Call ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AgentResponse
 * @property {string} text - AI response text
 * @property {Array<{name: string, arguments: Object}>} toolCalls - Client tool calls
 * @property {boolean} hasMemory - Whether memory context was used
 * @property {boolean} hasImage - Whether image analysis was included
 * @property {Array<{name: string, success: boolean, message: string}>} toolResults - Tool execution results
 */

/**
 * Call the AI Agent API
 * @param {Object} payload
 * @param {string} payload.prompt
 * @param {File} [payload.image]
 * @param {Function} [onChunk]
 * @returns {Promise<AgentResponse>}
 */
async function callAgentAPI(payload, onChunk) {
  const offline =
    typeof navigator !== 'undefined' && navigator.onLine === false;

  if (offline || isCircuitOpen()) {
    const fallback =
      '🤖 Ich bin gerade offline. Bitte versuche es später erneut.';
    if (onChunk) await simulateStreaming(fallback, onChunk);
    return {
      text: fallback,
      toolCalls: [],
      hasMemory: false,
      hasImage: false,
      toolResults: [],
    };
  }

  const userId = getUserId();
  const conversationHistory = getConversationHistory();
  let delay = INITIAL_DELAY;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let response;

      if (payload.image) {
        // Multipart upload for image
        const formData = new FormData();
        formData.append('prompt', payload.prompt || '');
        formData.append('userId', userId);
        formData.append('image', payload.image);

        response = await fetch(AGENT_ENDPOINT, {
          method: 'POST',
          body: formData,
        });
      } else {
        // JSON request
        response = await fetch(AGENT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: payload.prompt,
            userId,
            conversationHistory,
            mode: 'agent',
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`API Error ${response.status}`);
      }

      const result = await response.json();

      // Reset circuit breaker on success
      circuit.failures = 0;
      circuit.openedAt = 0;

      // Save to conversation history
      addToHistory('user', payload.prompt);
      if (result.text) {
        addToHistory('assistant', result.text);
      }

      // Execute client-side tool calls
      const toolResults = [];
      if (Array.isArray(result.toolCalls) && result.toolCalls.length > 0) {
        for (const tc of result.toolCalls) {
          const toolResult = executeTool(tc);
          toolResults.push({
            name: tc.name,
            ...toolResult,
          });
          log.info(`Tool executed: ${tc.name}`, toolResult);
        }
      }

      // Stream the text response
      if (result.text && onChunk) {
        await simulateStreaming(result.text, onChunk);
      }

      return {
        text: result.text || '',
        toolCalls: result.toolCalls || [],
        hasMemory: result.hasMemory || false,
        hasImage: result.hasImage || false,
        toolResults,
      };
    } catch {
      if (attempt === MAX_RETRIES) {
        circuit.failures++;
        if (circuit.failures >= circuit.threshold && !circuit.openedAt) {
          circuit.openedAt = Date.now();
          log.warn('Agent circuit breaker opened');
        }

        const fallback =
          'Verbindung zum KI-Dienst fehlgeschlagen. Bitte versuche es erneut.';
        if (onChunk) await simulateStreaming(fallback, onChunk);
        return {
          text: fallback,
          toolCalls: [],
          hasMemory: false,
          hasImage: false,
          toolResults: [],
        };
      }

      log.warn(`Agent API attempt ${attempt + 1} failed, retrying...`);
      await sleep(delay);
      delay *= 2;
    }
  }

  // Should not reach here, but just in case
  return {
    text: 'Ein unerwarteter Fehler ist aufgetreten.',
    toolCalls: [],
    hasMemory: false,
    hasImage: false,
    toolResults: [],
  };
}

// ─── AI Agent Service Class ─────────────────────────────────────────────────────

export class AIAgentService {
  /**
   * Generate a proactive agent response with tool-calling
   * @param {string} prompt - User message
   * @param {Function} [onChunk] - Streaming callback
   * @returns {Promise<AgentResponse>}
   */
  async generateResponse(prompt, onChunk) {
    return await callAgentAPI({ prompt }, onChunk);
  }

  /**
   * Analyze an image with optional prompt
   * @param {File} imageFile - Image file
   * @param {string} [prompt] - User prompt about the image
   * @param {Function} [onChunk] - Streaming callback
   * @returns {Promise<AgentResponse>}
   */
  async analyzeImage(imageFile, prompt = '', onChunk) {
    const validation = validateImageFile(imageFile);
    if (!validation.valid) {
      const error = `⚠️ ${validation.error}`;
      if (onChunk) await simulateStreaming(error, onChunk);
      return {
        text: error,
        toolCalls: [],
        hasMemory: false,
        hasImage: false,
        toolResults: [],
      };
    }

    return await callAgentAPI(
      {
        prompt: prompt || 'Analysiere dieses Bild.',
        image: imageFile,
      },
      onChunk,
    );
  }

  /**
   * Get proactive suggestion based on current context
   * @param {Object} contextData
   * @returns {Promise<string>}
   */
  async getProactiveSuggestion(contextData) {
    try {
      const {
        title = 'Unknown',
        url = '/',
        headline = '',
        description = '',
        contentSnippet = '',
      } = contextData;
      const contextParts = [];
      if (headline) contextParts.push(`Headline: ${headline}`);
      if (description) contextParts.push(`Description: ${description}`);
      if (contentSnippet)
        contextParts.push(`Content: ${contentSnippet.substring(0, 500)}`);
      const contextBlock =
        contextParts.length > 0 ? `\n${contextParts.join('\n')}` : '';
      const response = await callAgentAPI({
        prompt: `Give a short, proactive tip for the user on the page "${title}" (${url}).${contextBlock}\nMax 2 sentences.`,
      });
      return response.text;
    } catch {
      return '';
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    try {
      localStorage.removeItem(CONVERSATION_HISTORY_KEY);
    } catch {
      // ignore
    }
  }

  /**
   * Get user ID
   * @returns {string}
   */
  getUserId() {
    return getUserId();
  }

  /**
   * Validate image before upload
   * @param {File} file
   * @returns {{ valid: boolean, error?: string }}
   */
  validateImage(file) {
    return validateImageFile(file);
  }
}
