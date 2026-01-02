/**
 * Optimierter Gemini API Service
 * Implementiert Exponential Backoff und striktes Error-Handling.
 */

const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";
const getBaseUrl = (apiKey) => `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey || ""}`; // server-only: pass API key when calling from server side

/**
 * Sendet eine Anfrage an die Gemini API mit Exponential Backoff.
 * @param {string} prompt - Die Benutzereingabe.
 * @param {string} systemInstruction - Anweisungen für das System.
 * @returns {Promise<string>} - Die Antwort der KI.
 */
async function getGeminiResponse(prompt, systemInstruction = "Du bist ein hilfreicher Roboter-Begleiter.") {
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] }
    };

    const maxRetries = 5;
    let delay = 1000; // Start mit 1 Sekunde

    const isRunningInBrowser = () => globalThis.fetch !== undefined && globalThis.window !== undefined;

    const doBrowserRequest = async (promptArg, systemArg) => {
        const r = await fetch("/api/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: promptArg, systemInstruction: systemArg }),
        });
        if (!r.ok) {
            const txt = await r.text();
            throw new Error(`Proxy Error: ${r.status} ${txt}`);
        }
        return r.json();
    };

    const doServerRequest = async (payloadArg) => {
        // Server-side request: dynamically import config to avoid bundling secrets into browser code
        const { config } = await import("./config.js");
        const apiKey = config.getGeminiApiKey();
        const r = await fetch(getBaseUrl(apiKey), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadArg),
        });
        if (!r.ok) {
            const txt = await r.text();
            throw new Error(`Server Error: ${r.status} ${txt}`);
        }
        return r.json();
    };

    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = isRunningInBrowser()
                ? await doBrowserRequest(prompt, systemInstruction)
                : await doServerRequest(payload);

            const text = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("Keine Antwort vom Modell erhalten.");
            return text;
        } catch (error) {
            if (i === maxRetries - 1) {
                // Letzter Versuch fehlgeschlagen
                console.error("Gemini API Fehler nach Max Retries:", error);
                return "Entschuldigung, ich habe gerade Verbindungsprobleme. Bitte versuche es später noch einmal.";
            }

            // Exponential Backoff (1s, 2s, 4s, 8s, 16s)
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
}

// Provide a thin class wrapper so callers can use `new GeminiService()` in the app
export class GeminiService {
  async generateResponse(prompt, _history = []) {
    // _history is available to craft system instructions later if needed
    const system = "Du bist ein hilfreicher Roboter-Begleiter.";
    return await getGeminiResponse(prompt, system);
  }

  async summarizePage(content) {
    const trimmed = String(content || "").slice(0, 4800);
    const prompt = `Fasse den folgenden Text kurz und präzise zusammen:\n\n${trimmed}`;
    const system = "Fasse kurz zusammen. Maximal 3 Sätze.";
    return await getGeminiResponse(prompt, system);
  }

  async getSuggestion(behavior) {
    const prompt = `Gib eine kurze, konkrete Empfehlung für den Nutzer basierend auf:\n${JSON.stringify(behavior)}`;
    const system = "Sei prägnant, maximal 2 Sätze.";
    return await getGeminiResponse(prompt, system);
  }
}