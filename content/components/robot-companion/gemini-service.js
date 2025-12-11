import { config } from './config.js';

export class GeminiService {
  constructor() {
    // Check if key is a function (obfuscated) or string
    this.apiKey = typeof config.getGeminiApiKey === 'function' ? config.getGeminiApiKey() : config.geminiApiKey;
    this.baseUrl = config.apiBaseUrl;
    this.model = config.model;
  }

  hasApiKey() {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  async generateResponse(prompt, context = []) {
    if (!this.hasApiKey()) {
      return this.fallbackResponse(prompt);
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
        // Force the browser to send the Origin/Referer header to satisfy Google's restrictions
        referrerPolicy: 'strict-origin-when-cross-origin',
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
        const errorData = await response.json().catch(() => ({}));

        // Log detailed error for debugging if available
        if (errorData.error && errorData.error.message) {
             console.error('Gemini API Detailed Error:', errorData.error.message);
        }

        if (response.status === 429) {
          console.warn('Gemini API Rate Limit Hit (429)');
          return 'Ich bin gerade etwas überlastet (zu viele Anfragen). Bitte versuche es in ein paar Sekunden noch einmal. 🤯';
        }

        if (response.status === 403) {
             console.warn('Gemini API Key blocked or restricted incorrectly.');
             return this.fallbackResponse(prompt);
        }

        console.error('Gemini API Error:', errorData);
        return this.fallbackResponse(prompt);
      }

      const data = await response.json();

      if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
      } else {
        return this.fallbackResponse(prompt);
      }
    } catch (error) {
      console.error('Gemini Service Error:', error);
      return this.fallbackResponse(prompt);
    }
  }

  fallbackResponse(prompt) {
      const lower = prompt.toLowerCase();
      if (lower.includes('hallo') || lower.includes('hi')) return 'Hallo! Mein Gehirn ist gerade offline, aber ich bin trotzdem für dich da. 😊';
      if (lower.includes('wer bist du')) return 'Ich bin dein virtueller Assistent auf dieser Webseite!';
      if (lower.includes('hilfe')) return 'Ich kann dir helfen, dich zurechtzufinden. Klicke einfach auf die Optionen unten.';
      if (lower.includes('witz')) return 'Warum können Geister so schlecht lügen? Weil man durch sie hindurchsehen kann! 👻 (Sorry, Offline-Modus Witz)';
      return 'Ich habe gerade keine Verbindung zu meinem Sprachzentrum. Bitte nutze die Buttons unten für die Navigation!';
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
