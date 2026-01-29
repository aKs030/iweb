/**
 * Gemini API Service
 * Handles communication with Google Gemini API
 */

const MODEL = 'gemini-2.5-flash-preview-09-2025';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Calls Google Gemini API
 * @param {string} prompt - User prompt
 * @param {string} systemInstruction - System instruction
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<string>} Generated text
 */
export async function callGeminiAPI(prompt, systemInstruction, apiKey) {
  const url = `${API_BASE}/${MODEL}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction || '' }] },
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const json = await response.json();

  // Extract text from response
  const text =
    json.text ||
    json.candidates?.[0]?.content?.parts?.[0]?.text ||
    'No response generated';

  return text;
}
