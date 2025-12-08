import { config } from './config.js';

export class GeminiService {
  constructor() {
    this.apiKey = config.geminiApiKey;
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
      return 'Ich benötige einen API-Key für Google Gemini, um antworten zu können. Bitte konfiguriere ihn in den Einstellungen.';
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

        console.error('Gemini API Error:', errorData);
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
      return 'Es gab ein Problem bei der Verbindung zu meinem Gehirn (API Error).';
    }
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
