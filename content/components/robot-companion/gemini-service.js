/**
 * Optimierter Gemini API Service
 * Implementiert Exponential Backoff und striktes Error-Handling.
 */

import { createLogger } from '/content/core/shared-utilities.js';

const log = createLogger('GeminiService');

async function getGeminiResponse(
  prompt,
  systemInstruction = 'Du bist ein hilfreicher Roboter-Begleiter.',
  _options = {},
) {
  const maxRetries = 5;
  let delay = 1000;

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

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await doBrowserRequest(
        prompt,
        systemInstruction,
        _options,
      );

      const text =
        result.text || result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Keine Antwort vom Modell erhalten.');
      return text;
    } catch (error) {
      if (i === maxRetries - 1) {
        log.error(
          'Gemini API Fehler nach Max Retries: ' +
            (error?.message || String(error)),
        );
        return 'Entschuldigung, ich habe gerade Verbindungsprobleme. Bitte versuche es später noch einmal.';
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

export class GeminiService {
  // eslint-disable-next-line no-unused-vars
  async generateResponse(prompt, _history = [], options = {}) {
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
