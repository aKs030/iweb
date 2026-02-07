/**
 * Groq API Service – Free, fast AI inference
 * https://groq.com/
 */

export const MODEL = 'llama-3.3-70b-versatile';
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * @param {string} prompt
 * @param {string} systemInstruction
 * @param {string} apiKey
 * @returns {Promise<string>}
 */
export async function callGroqAPI(prompt, systemInstruction, apiKey) {
  const messages = [
    ...(systemInstruction
      ? [{ role: 'system', content: systemInstruction }]
      : []),
    { role: 'user', content: prompt },
  ];

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 0.95,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || 'No response generated';
}
