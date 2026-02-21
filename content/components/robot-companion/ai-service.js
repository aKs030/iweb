/**
 * AI API Service (using Groq - Free!)
 * Handles AI chat responses via Cloudflare Pages Function
 */

import { createLogger } from '../../core/logger.js';
import { sleep } from '../../core/utils.js';

const log = createLogger('AIService');

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;
const FALLBACK_MESSAGE =
  'Entschuldigung, ich habe gerade Verbindungsprobleme. Bitte versuche es später noch einmal.';

/**
 * Makes a request to the AI API via proxy with retry logic
 * @param {string} prompt - User prompt
 * @param {string} mode - AI mode ('chat', 'summary', 'suggestion')
 * @param {Function} [onChunk] - Optional callback for streaming chunks
 * @returns {Promise<string>} AI response text
 */
async function callAIAPI(prompt, mode = 'chat', onChunk) {
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

      if (!result.text) {
        throw new Error('Empty response from AI model');
      }

      // If streaming callback provided, simulate streaming effect
      if (onChunk && typeof onChunk === 'function') {
        await simulateStreaming(result.text, onChunk);
        return result.text;
      }

      return result.text;
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
 * Simulate streaming effect by sending text in chunks
 * @param {string} text - Full text to stream
 * @param {Function} onChunk - Callback for each chunk
 */
async function simulateStreaming(text, onChunk) {
  // Use word-based chunking for better performance with markdown parsing
  // Split on word boundaries while preserving whitespace and newlines
  const tokens = text.match(/\S+\s*/g) || [];

  let accumulated = '';

  for (const token of tokens) {
    accumulated += token;
    onChunk(accumulated);
    // Add jitter for more natural typing effect (15ms - 50ms)
    await sleep(Math.floor(Math.random() * 35) + 15);
  }
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
    return await callAIAPI(prompt, 'summary');
  }

  /**
   * Get AI suggestion based on page context
   * @param {Object} contextData - Context data (title, headline, etc.)
   * @returns {Promise<string>} Suggestion
   */
  async getSuggestion(contextData) {
    // Clean and limit content snippet to avoid API payload issues
    const cleanContent = String(contextData.contentSnippet || '')
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .slice(0, 500); // Limit to 500 chars

    const prompt = `Seite: "${contextData.title || 'Unbekannt'}"
Überschrift: "${contextData.headline || ''}"
URL: "${contextData.url || ''}"
Kontext: "${cleanContent || 'Kein Text verfügbar'}"

Generiere einen kurzen, hilfreichen Tipp oder eine Frage zu diesem Inhalt.
Sprich den Nutzer freundlich als Roboter-Assistent an (Cyber).
Maximal 2 kurze Sätze.`;

    return await callAIAPI(prompt, 'suggestion');
  }
}
