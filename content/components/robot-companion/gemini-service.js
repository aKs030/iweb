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
        // Send origin/referrer safely to satisfy Google's domain check
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

        // Log detailed error for debugging (internal only)
        if (errorData.error && errorData.error.message) {
             console.warn('Gemini API Warning:', errorData.error.message);
        }

        // DEBUG MODE: Return exact error to user
        const debugMsg = errorData.error && errorData.error.message
            ? `API Error (${response.status}): ${errorData.error.message}`
            : `API Error (${response.status}): Unknown error`;

        if (response.status === 403) {
             console.warn('Gemini API Key blocked or restricted.');
             return this.fallbackResponse(prompt);
        }

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
      if (lower.includes('hallo') || lower.includes('hi')) return 'Hallo! Der Service ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.';
      if (lower.includes('wer bist du')) return 'Ich bin ein virtueller Assistent. Momentan kann ich leider keine weiteren Informationen bereitstellen.';
      if (lower.includes('hilfe')) return 'Der Assistent ist aktuell nicht erreichbar. Bitte nutzen Sie die verfügbaren Optionen zur Navigation.';
      if (lower.includes('witz')) return 'Der Service ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.';
      return 'Der Assistent ist momentan nicht erreichbar. Bitte nutzen Sie die Navigationsoptionen oder versuchen Sie es später erneut.';
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
