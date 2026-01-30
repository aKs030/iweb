/**
 * AI API Service (using Groq - Free!)
 * Handles AI chat responses via Cloudflare Worker proxy
 */

import { createLogger } from '/content/core/logger.js';
import { sleep } from '/content/core/utils.js';

const log = createLogger('AIService');

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;
const FALLBACK_MESSAGE =
  'Entschuldigung, ich habe gerade Verbindungsprobleme. Bitte versuche es später noch einmal.';

/**
 * Makes a request to the AI API via proxy with retry logic
 * Note: Endpoint is still /api/gemini for backward compatibility, but uses Groq now
 * @param {string} prompt - User prompt
 * @param {string} systemInstruction - System instruction for the AI
 * @returns {Promise<string>} AI response text
 */
async function callAIAPI(prompt, systemInstruction) {
  let delay = INITIAL_DELAY;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      const text =
        result.text || result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('Empty response from AI model');
      }

      return text;
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      if (isLastAttempt) {
        log.error('AI API failed after retries:', error?.message);
        return FALLBACK_MESSAGE;
      }

      log.warn(`AI API attempt ${attempt + 1} failed, retrying...`);
      await sleep(delay);
      delay *= 2; // Exponential backoff
    }
  }

  return FALLBACK_MESSAGE;
}

/**
 * AI Service - Provides AI chat functionality (using Groq)
 * Note: Class name kept as "GeminiService" for backward compatibility
 */
export class GeminiService {
  /**
   * Generate a chat response
   * @param {string} prompt - User message
   * @returns {Promise<string>} AI response
   */
  async generateResponse(prompt) {
    return await callAIAPI(
      prompt,
      'Du bist ein hilfreicher Roboter-Begleiter.',
    );
  }

  /**
   * Summarize page content
   * @param {string} content - Page content to summarize
   * @returns {Promise<string>} Summary
   */
  async summarizePage(content) {
    const trimmed = String(content || '').slice(0, 4800);
    const prompt = `Fasse den folgenden Text kurz und präzise zusammen:\n\n${trimmed}`;
    return await callAIAPI(prompt, 'Fasse kurz zusammen. Maximal 3 Sätze.');
  }

  /**
   * Get AI suggestion based on user behavior
   * @param {Object} behavior - User behavior data
   * @returns {Promise<string>} Suggestion
   */
  async getSuggestion(behavior) {
    const prompt = `Gib eine kurze, konkrete Empfehlung für den Nutzer basierend auf:\n${JSON.stringify(
      behavior,
    )}`;
    return await callAIAPI(prompt, 'Sei prägnant, maximal 2 Sätze.');
  }
}
