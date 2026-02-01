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
 * @param {Function} [onChunk] - Optional callback for streaming chunks
 * @returns {Promise<string>} AI response text
 */
async function callAIAPI(prompt, systemInstruction, onChunk) {
  let delay = INITIAL_DELAY;

  // Check if we're in development mode and API is not available
  const isDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction }),
      });

      if (!response.ok) {
        // In development, use mock response if API is not available
        if (isDev && response.status === 404) {
          const mockText = `Das ist eine **Mock-Antwort** für deine Frage: _"${prompt}"_.

In der Produktionsumgebung würde hier die echte KI-Antwort erscheinen.

Features:
- **Markdown** Support
- Streaming _Simulation_
- \`Code\` Highlighting

\`\`\`javascript
console.log("Hello Robot!");
\`\`\`
`;

          if (onChunk && typeof onChunk === 'function') {
            await simulateStreaming(mockText, onChunk);
            return mockText;
          }

          return mockText;
        }

        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      const text =
        result.text || result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('Empty response from AI model');
      }

      // If streaming callback provided, simulate streaming effect
      if (onChunk && typeof onChunk === 'function') {
        await simulateStreaming(text, onChunk);
        return text; // Return after streaming is complete
      }

      return text;
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      if (isLastAttempt) {
        // In development, use mock response as fallback
        if (isDev) {
          const mockText = `**Mock-Antwort**: Ich kann dir helfen! (API nicht verfügbar im _Dev-Modus_)`;

          if (onChunk && typeof onChunk === 'function') {
            await simulateStreaming(mockText, onChunk);
            return mockText;
          }

          return mockText;
        }

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
 * Note: Class name kept as "GeminiService" for backward compatibility
 */
export class GeminiService {
  /**
   * Generate a chat response
   * @param {string} prompt - User message
   * @param {Function} [onChunk] - Optional callback for streaming chunks
   * @returns {Promise<string>} AI response
   */
  async generateResponse(prompt, onChunk) {
    const hasCallback = onChunk && typeof onChunk === 'function';

    return await callAIAPI(
      prompt,
      'Du bist ein hilfreicher Roboter-Begleiter.',
      hasCallback ? onChunk : undefined,
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
   * Get AI suggestion based on page context
   * @param {Object} contextData - Context data (title, headline, etc.)
   * @returns {Promise<string>} Suggestion
   */
  async getSuggestion(contextData) {
    const prompt = `Der Nutzer betrachtet gerade die Seite: "${contextData.title || ''}".
    Überschrift: "${contextData.headline || ''}"
    Beschreibung: "${contextData.description || ''}"
    URL: "${contextData.url || ''}"

    Generiere einen kurzen, hilfreichen Tipp, einen interessanten Fakt oder eine Frage zu diesem Inhalt, um den Nutzer einzuladen.
    Sprich den Nutzer freundlich als Roboter-Assistent an.
    Maximal 2 kurze Sätze.`;

    return await callAIAPI(
      prompt,
      'Du bist ein proaktiver, hilfreicher Roboter-Assistent.',
    );
  }
}
