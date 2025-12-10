import { config } from './config.js';

export class GeminiService {
  constructor() {
    this.apiKey = config.geminiApiKey;
    this.baseUrl = config.apiBaseUrl;
    this.model = config.model;
    this.hfKey = config.huggingFaceApiKey;
    this.hfModel = config.huggingFaceModel;
  }

  hasApiKey() {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  async generateResponse(prompt, context = []) {
    // If Gemini API key not configured, fallback to HF if available, else local fallback.
    if (!this.hasApiKey()) {
      if (this.hfKey) {
        return this.generateResponseViaHuggingFace(prompt);
      }
      return this.generateResponseLocal(prompt);
    }

    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    // Construct the conversation history for the API
    // Gemini expects: { contents: [{ role: "user", parts: [{ text: "..." }] }, { role: "model", parts: ... }] }
    const contents = context.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    // Add the current prompt
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 200,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        if (response.status === 429) {
          console.warn('Gemini API Rate Limit Hit (429)');
          return 'Ich bin gerade etwas überlastet (zu viele Anfragen). Bitte versuche es in ein paar Sekunden noch einmal. 🤯';
        }

        // If permission denied / key leak or other 403, try fallback.
        console.error('Gemini API Error:', errorData);
        if (response.status === 403) {
          console.warn('Gemini 403 - check API key. Trying Hugging Face fallback if available.');
          if (this.hfKey) return this.generateResponseViaHuggingFace(prompt, context);
          return this.generateResponseLocal(prompt);
        }
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
      } else {
        return 'Entschuldigung, ich konnte keine Antwort generieren.';
      }
    } catch (error) {
      console.error('Gemini Service Error:', error);
      // If something else goes wrong, try HF fallback
      if (this.hfKey) return this.generateResponseViaHuggingFace(prompt, context);
      return this.generateResponseLocal(prompt);
    }
  }

  async generateResponseViaHuggingFace(prompt, _context = []) {
    try {
      const url = `https://api-inference.huggingface.co/models/${this.hfModel}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.hfKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: prompt, options: { use_cache: false }, parameters: { max_new_tokens: 180 } }),
      });
      if (!response.ok) {
        console.warn('HuggingFace fallback returned', response.status);
        try {
          const err = await response.json();
          console.warn('HF error data', err);
        } catch {
          /* ignored */
        }
        return 'Ich kann derzeit keine Verbindung zum freien Modell herstellen.';
      }
      const data = await response.json();
      // Response formats vary — try to extract generated_text
      if (Array.isArray(data) && data[0] && data[0].generated_text) {
        return data[0].generated_text;
      }
      if (data.generated_text) {
        return data.generated_text;
      }
      if (typeof data === 'string') return data;
      // As a fallback, use a joined text from possible fields
      return String(JSON.stringify(data)).slice(0, 200);
    } catch {
      console.error('HF Fallback Error');
      return this.generateResponseLocal(prompt);
    }
  }

  async generateResponseLocal(prompt) {
    // Minimal offline responder: simple template-based answers for a friendly UX.
    const lower = prompt.toLowerCase();
    if (lower.includes('hallo') || lower.includes('hi') || lower.includes('hey')) {
      return 'Hallo! Ich bin gerade im Offline-Modus. Ich kann dir einfache Hilfestellungen geben: z. B. Navigation oder Links.';
    }
    if (lower.includes('zusammenfass') || lower.includes('fasse') || lower.includes('kurz')) {
      return 'Ich kann dir leider keine vollständige Zusammenfassung liefern, da die AI-Verbindung fehlt. Versuche später erneut.';
    }
    if (lower.includes('projekt') || lower.includes('projekte')) {
      return 'Ich kann dir die Sektion „Projekte“ zeigen: Schau dir die Seite /projekte an, um alle Projekte zu sehen.';
    }
    // Default friendly fallback
    return 'Ich bin aktuell im Offline-Modus oder mein AI-Key wurde gesperrt. Ich bin trotzdem hier! Frag mich nach Seiten-Navigation oder Kurzinfos.';
  }

  async summarizePage(pageContent) {
    if (!this.hasApiKey()) return 'Kein API Key konfiguriert.';

    const prompt = `Fasse den folgenden Webseiten-Inhalt kurz und prägnant zusammen (max 3 Sätze). Der Inhalt ist: ${pageContent.substring(0, 5000)}`; // Limit content length

    return this.generateResponse(prompt);
  }

  async getSuggestion(userBehavior) {
    if (!this.hasApiKey()) return null;

    const prompt = `Der User befindet sich auf der Seite "${userBehavior.page}".
        Er hat folgende Interessen gezeigt: ${userBehavior.interests ? userBehavior.interests.join(', ') : 'Unbekannt'}.
        Generiere einen kurzen, freundlichen und einladenden Satz (max 15 Wörter), der ihn begrüßt oder auf etwas Interessantes hinweist.
        Sei hilfreich wie ein Roboter-Assistent.`;

    return this.generateResponse(prompt);
  }
}
