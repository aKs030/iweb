/**
 * Cloudflare Pages Function — POST /api/ai
 * Proxies AI requests to Groq API with optional RAG augmentation.
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
    const { request, env } = context;

    try {
        const body = await request.json();

        // Validate
        if (!body?.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
            return jsonResponse({ error: 'Missing or invalid prompt', status: 400 }, 400);
        }
        if (body.prompt.length > 10_000) {
            return jsonResponse({ error: 'Prompt too long (max 10 000 chars)', status: 400 }, 400);
        }

        // Check API key
        if (!env.GROQ_API_KEY) {
            return jsonResponse({ error: 'GROQ_API_KEY not configured', status: 500 }, 500);
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
        const groqRes = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${env.GROQ_API_KEY}`,
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

        if (!groqRes.ok) {
            const errText = await groqRes.text();
            return jsonResponse(
                { error: 'AI request failed', message: `Groq ${groqRes.status}: ${errText}`, status: 502 },
                502,
            );
        }

        const groqData = await groqRes.json();
        const text = groqData.choices?.[0]?.message?.content || 'No response generated';

        return jsonResponse({
            text,
            sources: [],
            usedRAG: false,
            model: GROQ_MODEL,
        });
    } catch (error) {
        return jsonResponse(
            { error: 'AI request failed', message: error.message, status: 500 },
            500,
        );
    }
}
