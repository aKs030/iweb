/**
 * Cloudflare Pages Function — POST /api/workers-assistant
 * KI-Assistent für Cloudflare Workers Code-Generierung.
 * @version 2.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';

const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_TOKENS = 4096;
const MAX_PROMPT_LENGTH = 8000;
const MAX_HISTORY_TURNS = 10;

const SYSTEM_PROMPT = `You are an advanced assistant specialized in generating Cloudflare Workers code.

<behavior_guidelines>
- Respond concisely, focus on Cloudflare Workers solutions
- Provide complete, self-contained solutions using current best practices
- Ask clarifying questions when requirements are ambiguous
</behavior_guidelines>

<code_standards>
- TypeScript by default unless JavaScript requested
- ES modules format exclusively (never Service Worker format)
- Import all used methods/classes/types
- Keep code in a single file unless specified otherwise
- Use official SDKs when available, minimize external dependencies
- No FFI/native/C binding libraries
- Include error handling, logging, and comments for complex logic
</code_standards>

<output_format>
- Use Markdown code blocks for: main worker code, wrangler.jsonc, types, examples
- Always output complete files, never partial diffs
</output_format>

<cloudflare_integrations>
- KV for key-value, Durable Objects for state, D1 for SQL, R2 for objects
- Hyperdrive for PostgreSQL, Queues for async, Vectorize for vectors
- Workers AI as default AI API, Browser Rendering for browser capabilities
- Include all necessary bindings in code and wrangler.jsonc
</cloudflare_integrations>

<configuration_requirements>
- Always provide wrangler.jsonc (not .toml)
- compatibility_date = "2025-03-07", compatibility_flags = ["nodejs_compat"]
- enabled = true for [observability]
- No dependencies in wrangler.jsonc, only used bindings
</configuration_requirements>

<security_guidelines>
- Validate requests, use security headers, handle CORS, rate limit where appropriate
- Sanitize inputs, never bake in secrets
</security_guidelines>`;

function sanitizePrompt(raw) {
  return typeof raw === 'string' ? raw.trim().slice(0, MAX_PROMPT_LENGTH) : '';
}

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-MAX_HISTORY_TURNS)
    .filter(
      (msg) =>
        msg &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        typeof msg.content === 'string',
    )
    .map((msg) => ({
      role: msg.role,
      content: String(msg.content).slice(0, 2000),
    }));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return Response.json(
        { error: 'Invalid JSON', text: 'Ungültiges JSON.' },
        { status: 400, headers: corsHeaders },
      );
    }

    const prompt = sanitizePrompt(body.prompt || body.message || '');
    if (!prompt) {
      return Response.json(
        { error: 'Empty prompt', text: 'Bitte eine Anfrage eingeben.' },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!env.AI) {
      return Response.json(
        { error: 'AI unavailable', text: 'KI-Dienst nicht verfügbar.' },
        { status: 503, headers: corsHeaders },
      );
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...sanitizeHistory(body.conversationHistory || []),
      { role: 'user', content: prompt },
    ];

    const aiResult = await env.AI.run(CHAT_MODEL, {
      messages,
      temperature: 0.3,
      max_tokens: MAX_TOKENS,
    });

    const text = aiResult?.response || '';
    if (!text) throw new Error('Empty AI response');

    return Response.json(
      { text, model: CHAT_MODEL, promptLength: prompt.length },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('[workers-assistant] Error:', error?.message || error);
    return Response.json(
      { error: 'AI request failed', text: 'KI-Dienst fehlgeschlagen.' },
      { status: 503, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
