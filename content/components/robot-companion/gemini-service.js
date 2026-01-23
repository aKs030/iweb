/**
 * Optimierter Gemini API Service
 * Implementiert Exponential Backoff und striktes Error-Handling.
 */

const MODEL_NAME = 'gemini-2.5-flash-preview-09-2025';
const getBaseUrl = (apiKey) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${
    apiKey || ''
  }`; // server-only: pass API key when calling from server side

/**
 * Sendet eine Anfrage an die Gemini API mit Exponential Backoff.
 * @param {string} prompt - Die Benutzereingabe.
 * @param {string} systemInstruction - Anweisungen für das System.
 * @returns {Promise<string>} - Die Antwort der KI.
 */
import { createLogger } from '/content/utils/shared-utilities.js';

const log = createLogger('GeminiService');

async function getGeminiResponse(
  prompt,
  systemInstruction = 'Du bist ein hilfreicher Roboter-Begleiter.',
  _options = {},
) {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
  };

  const maxRetries = 5;
  let delay = 1000; // Start mit 1 Sekunde

  const isRunningInBrowser = () =>
    globalThis.fetch !== undefined && globalThis.window !== undefined;

  const doBrowserRequest = async (promptArg, systemArg, opts) => {
    const r = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: promptArg,
        systemInstruction: systemArg,
        options: opts,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Proxy Error: ${r.status} ${txt}`);
    }
    return r.json();
  };

  const doServerRequest = async () => {
    // DEPRECATED: Direct server-side requests are no longer supported for security.
    // All requests must go through the Cloudflare Worker proxy at /api/gemini
    throw new Error(
      'Direct server-side Gemini API calls are disabled. ' +
      'Use the browser proxy endpoint /api/gemini instead.'
    );
  };

  for (let i = 0; i < maxRetries; i++) {
    try {
      // SECURITY: Always use browser proxy endpoint (never direct API calls)
      if (!isRunningInBrowser()) {
        throw new Error(
          'Gemini service must run in browser context. Use /api/gemini proxy.'
        );
      }

      const result = await doBrowserRequest(prompt, systemInstruction, _options);

      const text =
        result.text || result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Keine Antwort vom Modell erhalten.');
      return text;
    } catch (error) {
      if (i === maxRetries - 1) {
        // Letzter Versuch fehlgeschlagen
        log.error(
          'Gemini API Fehler nach Max Retries: ' +
            (error && error.message ? error.message : String(error)),
        );
        return 'Entschuldigung, ich habe gerade Verbindungsprobleme. Bitte versuche es später noch einmal.';
      }

      // Exponential Backoff (1s, 2s, 4s, 8s, 16s)
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

// Provide a thin class wrapper so callers can use `new GeminiService()` in the app
export class GeminiService {
  async generateResponse(prompt, _history = [], options = {}) {
    // _history is available to craft system instructions later if needed
    const system = 'Du bist ein hilfreicher Roboter-Begleiter.';
    return await getGeminiResponse(prompt, system, options);
  }

  async summarizePage(content) {
    const trimmed = String(content || '').slice(0, 4800);
    const prompt = `Fasse den folgenden Text kurz und präzise zusammen:\n\n${trimmed}`;
    const system = 'Fasse kurz zusammen. Maximal 3 Sätze.';
    return await getGeminiResponse(prompt, system);
  }

  async getSuggestion(behavior) {
    const prompt = `Gib eine kurze, konkrete Empfehlung für den Nutzer basierend auf:\n${JSON.stringify(
      behavior,
    )}`;
    const system = 'Sei prägnant, maximal 2 Sätze.';
    return await getGeminiResponse(prompt, system);
  }
}
