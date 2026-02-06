/**
 * Cloudflare Pages Function — POST /api/ai
 * Proxies AI requests to Groq API.
 *
 * Required env var: GROQ_API_KEY (set in Cloudflare Pages Settings → Environment Variables)
 */

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** Handle CORS preflight */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Handle POST /api/ai */
export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // Parse body safely
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body', status: 400 }, 400);
    }

    // Validate
    if (
      !body ||
      !body.prompt ||
      typeof body.prompt !== 'string' ||
      body.prompt.trim().length === 0
    ) {
      return jsonResponse(
        { error: 'Missing or invalid prompt', status: 400 },
        400,
      );
    }
    if (body.prompt.length > 10000) {
      return jsonResponse(
        { error: 'Prompt too long (max 10000 chars)', status: 400 },
        400,
      );
    }

    // Check API key
    const apiKey = env && env.GROQ_API_KEY;
    if (!apiKey) {
      return jsonResponse(
        { error: 'GROQ_API_KEY not configured', status: 500 },
        500,
      );
    }

    const systemInstruction =
      body.systemInstruction ||
      'Du bist ein hilfreicher Assistent, antworte prägnant und informativ.';

    // Build messages
    const messages = [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: body.prompt },
    ];

    // Call Groq
    let groqRes;
    try {
      groqRes = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 2048,
          top_p: 0.95,
          stream: false,
        }),
      });
    } catch (fetchErr) {
      return jsonResponse(
        {
          error: 'Failed to reach Groq API',
          message: fetchErr.message,
          status: 502,
        },
        502,
      );
    }

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => 'unknown error');
      return jsonResponse(
        {
          error: 'Groq API error',
          message: `${groqRes.status}: ${errText.slice(0, 500)}`,
          status: 502,
        },
        502,
      );
    }

    let groqData;
    try {
      groqData = await groqRes.json();
    } catch {
      return jsonResponse(
        { error: 'Invalid response from Groq API', status: 502 },
        502,
      );
    }

    const text =
      groqData.choices && groqData.choices[0] && groqData.choices[0].message
        ? groqData.choices[0].message.content
        : 'No response generated';

    return jsonResponse({
      text,
      sources: [],
      usedRAG: false,
      model: GROQ_MODEL,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: 'Unexpected server error',
        message: String((error && error.message) || error),
        status: 500,
      },
      500,
    );
  }
}
