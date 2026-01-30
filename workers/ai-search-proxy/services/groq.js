/**
 * Groq API Service
 * Free, fast AI inference with Llama models
 * https://groq.com/
 */

// Available free models:
// - llama-3.3-70b-versatile (recommended - best quality)
// - llama-3.1-8b-instant (fastest)
// - mixtral-8x7b-32768 (good for long context)
const MODEL = 'llama-3.3-70b-versatile';
const API_BASE = 'https://api.groq.com/openai/v1';

/**
 * Calls Groq API (OpenAI-compatible)
 * @param {string} prompt - User prompt
 * @param {string} systemInstruction - System instruction
 * @param {string} apiKey - Groq API key
 * @returns {Promise<string>} Generated text
 */
export async function callGroqAPI(prompt, systemInstruction, apiKey) {
  const url = `${API_BASE}/chat/completions`;

  const messages = [];

  // Add system message if provided
  if (systemInstruction) {
    messages.push({
      role: 'system',
      content: systemInstruction,
    });
  }

  // Add user message
  messages.push({
    role: 'user',
    content: prompt,
  });

  const payload = {
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 0.95,
    stream: false,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  const json = await response.json();

  // Extract text from OpenAI-compatible response
  const text = json.choices?.[0]?.message?.content || 'No response generated';

  return text;
}

/**
 * Alternative: Hugging Face Inference API (also free)
 * Uncomment to use instead of Groq
 */
/*
export async function callHuggingFaceAPI(prompt, systemInstruction, apiKey) {
  const MODEL = 'meta-llama/Llama-3.2-3B-Instruct';
  const url = `https://api-inference.huggingface.co/models/${MODEL}`;

  const fullPrompt = systemInstruction 
    ? `${systemInstruction}\n\nUser: ${prompt}\nAssistant:`
    : `User: ${prompt}\nAssistant:`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      inputs: fullPrompt,
      parameters: {
        max_new_tokens: 2048,
        temperature: 0.7,
        top_p: 0.95,
        return_full_text: false,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hugging Face API error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const text = json[0]?.generated_text || 'No response generated';
  
  return text;
}
*/
