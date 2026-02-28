/**
 * AI API Service (using Groq through /api/ai proxy)
 * Includes retry logic and a circuit breaker fallback to local mode.
 */

import { createLogger } from '../../core/logger.js';
import { sleep } from '../../core/utils.js';

const log = createLogger('AIService');

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;
const FALLBACK_MESSAGE =
  'Entschuldigung, ich habe gerade Verbindungsprobleme. Bitte versuche es später noch einmal.';
const LOCAL_MODE_MESSAGE =
  'Ich bin aktuell im lokalen Modus (ohne Cloud-Verbindung) und beantworte nur Basisanfragen.';
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 120000;

const circuitState = {
  consecutiveFailures: 0,
  openedAt: 0,
};

function isCircuitOpen() {
  if (!circuitState.openedAt) return false;

  const elapsed = Date.now() - circuitState.openedAt;
  if (elapsed < CIRCUIT_COOLDOWN_MS) return true;

  circuitState.openedAt = 0;
  circuitState.consecutiveFailures = Math.max(0, CIRCUIT_FAILURE_THRESHOLD - 1);
  return false;
}

function registerFailure(error) {
  circuitState.consecutiveFailures += 1;
  if (circuitState.consecutiveFailures < CIRCUIT_FAILURE_THRESHOLD) return;

  if (!circuitState.openedAt) {
    circuitState.openedAt = Date.now();
    log.warn('AI circuit breaker opened:', error?.message || error);
  }
}

function registerSuccess() {
  circuitState.consecutiveFailures = 0;
  circuitState.openedAt = 0;
}

function buildLocalReply(prompt = '', mode = 'chat') {
  const normalizedPrompt = String(prompt || '').toLowerCase();

  if (mode === 'summary') {
    return `${LOCAL_MODE_MESSAGE} Ich kann gerade nur eine sehr kurze lokale Zusammenfassung liefern.`;
  }

  if (mode === 'suggestion') {
    return `${LOCAL_MODE_MESSAGE} Probiere in der Zwischenzeit die Navigation oder die lokale Suche im Menü.`;
  }

  if (
    normalizedPrompt.includes('kontakt') ||
    normalizedPrompt.includes('mail')
  ) {
    return `${LOCAL_MODE_MESSAGE} Für Kontakt kannst du den Footer über das Menü öffnen.`;
  }

  if (normalizedPrompt.includes('projekt')) {
    return `${LOCAL_MODE_MESSAGE} Die Projekte findest du unter /projekte/.`;
  }

  if (normalizedPrompt.includes('blog')) {
    return `${LOCAL_MODE_MESSAGE} Blog-Inhalte findest du unter /blog/.`;
  }

  return `${LOCAL_MODE_MESSAGE} ${FALLBACK_MESSAGE}`;
}

/**
 * Simulate streaming effect by sending text in chunks
 * @param {string} text - Full text to stream
 * @param {Function} onChunk - Callback for each chunk
 */
async function simulateStreaming(text, onChunk) {
  const tokens = text.match(/\S+\s*/g) || [];
  let accumulated = '';

  for (const token of tokens) {
    accumulated += token;
    onChunk(accumulated);
    await sleep(Math.floor(Math.random() * 35) + 15);
  }
}

/**
 * Makes a request to the AI API via proxy with retry + circuit breaker
 * @param {string} prompt - User prompt
 * @param {string} mode - AI mode ('chat', 'summary', 'suggestion')
 * @param {Function} [onChunk] - Optional callback for streaming chunks
 * @returns {Promise<Object>} AI response object
 */
async function callAIAPI(prompt, mode = 'chat', onChunk) {
  const offline =
    typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offline || isCircuitOpen()) {
    const localReply = buildLocalReply(prompt, mode);
    if (onChunk && typeof onChunk === 'function') {
      await simulateStreaming(localReply, onChunk);
    }
    return { text: localReply };
  }

  let delay = INITIAL_DELAY;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (!result.text && !result.toolCalls) {
        throw new Error('Empty response from AI model');
      }

      registerSuccess();

      if (onChunk && typeof onChunk === 'function' && result.text) {
        await simulateStreaming(result.text, onChunk);
      }

      return result;
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      if (isLastAttempt) {
        registerFailure(error);

        const circuitOpenAfterFailure = isCircuitOpen();
        const localReply = circuitOpenAfterFailure
          ? buildLocalReply(prompt, mode)
          : FALLBACK_MESSAGE;

        if (onChunk && typeof onChunk === 'function') {
          await simulateStreaming(localReply, onChunk);
        }
        return { text: localReply };
      }

      log.warn(`AI API attempt ${attempt + 1} failed, retrying...`);
      await sleep(delay);
      delay *= 2;
    }
  }

  registerFailure(new Error('Retries exhausted'));
  return { text: buildLocalReply(prompt, mode) };
}

/**
 * AI Service - Provides AI chat functionality (using Groq)
 */
export class AIService {
  /**
   * Generate a chat response
   * @param {string} prompt - User message
   * @param {Function} [onChunk] - Optional callback for streaming chunks
   * @param {string} [mode] - AI mode
   * @returns {Promise<string>} AI response
   */
  async generateResponse(prompt, onChunk, mode = 'chat') {
    const hasCallback = onChunk && typeof onChunk === 'function';
    return await callAIAPI(prompt, mode, hasCallback ? onChunk : undefined);
  }

  /**
   * Summarize page content
   * @param {string} content - Page content to summarize
   * @returns {Promise<string>} Summary
   */
  async summarizePage(content) {
    const trimmed = String(content || '').slice(0, 4800);
    const prompt = `Fasse den folgenden Text kurz und präzise auf DEUTSCH zusammen:\n\n${trimmed}`;
    const res = await callAIAPI(prompt, 'summary');
    return res.text;
  }

  /**
   * Get AI suggestion based on page context
   * @param {Object} contextData - Context data (title, headline, etc.)
   * @returns {Promise<string>} Suggestion
   */
  async getSuggestion(contextData) {
    const cleanContent = String(contextData.contentSnippet || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);

    const prompt = `Seite: "${contextData.title || 'Unbekannt'}"
Überschrift: "${contextData.headline || ''}"
URL: "${contextData.url || ''}"
Kontext: "${cleanContent || 'Kein Text verfügbar'}"

Generiere einen kurzen, hilfreichen Tipp oder eine Frage zu diesem Inhalt.
Sprich den Nutzer freundlich als Roboter-Assistent an (Cyber).
Maximal 2 kurze Sätze.`;

    const res = await callAIAPI(prompt, 'suggestion');
    return res.text;
  }
}
