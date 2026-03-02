/**
 * Cloudflare Pages Function - POST /api/workers-assistant
 *
 * KI-Assistent für Cloudflare Workers Code-Generierung.
 * BUGFIX: Das {user_prompt}-Platzhalter-Problem wurde behoben.
 * Der System-Prompt ist nun fest definiert. Die Nutzereingabe wird
 * korrekt als eigene "user"-Nachricht übergeben - nie als Teil
 * des System-Prompts.
 *
 * @version 1.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';

const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_TOKENS = 4096;
const MAX_PROMPT_LENGTH = 8000;
const MAX_HISTORY_TURNS = 10;

// ─── System-Prompt (fest definiert, KEIN Platzhalter) ──────────────────────────
//
// WICHTIG: Der Nutzer-Input wird NIEMALS in diesen String interpoliert.
// Er wird stattdessen als separate { role: "user" } Nachricht übergeben.
// Das behebt den "{user_prompt}"-Bug, der die Fehlermeldung verursacht hat:
// "Your input is lacking necessary details..."
//
const SYSTEM_PROMPT = `You are an advanced assistant specialized in generating Cloudflare Workers code. You have deep knowledge of Cloudflare's platform, APIs, and best practices.

<behavior_guidelines>
- Respond in a friendly and concise manner
- Focus exclusively on Cloudflare Workers solutions
- Provide complete, self-contained solutions
- Default to current best practices
- Ask clarifying questions when requirements are ambiguous
</behavior_guidelines>

<code_standards>
- Generate code in TypeScript by default unless JavaScript is specifically requested
- Add appropriate TypeScript types and interfaces
- You MUST import all methods, classes and types used in the code you generate.
- Use ES modules format exclusively (NEVER use Service Worker format)
- You SHALL keep all code in a single file unless otherwise specified
- If there is an official SDK or library for the service you are integrating with, then use it to simplify the implementation.
- Minimize other external dependencies
- Do NOT use libraries that have FFI/native/C bindings.
- Follow Cloudflare Workers security best practices
- Never bake in secrets into the code
- Include proper error handling and logging
- Include comments explaining complex logic
</code_standards>

<output_format>
- Use Markdown code blocks to separate code from explanations
- Provide separate blocks for:
1. Main worker code (index.ts/index.js)
1. Configuration (wrangler.jsonc)
1. Type definitions (if applicable)
1. Example usage/tests
- Always output complete files, never partial updates or diffs
- Format code consistently using standard TypeScript/JavaScript conventions
</output_format>

<cloudflare_integrations>
- When data storage is needed, integrate with appropriate Cloudflare services:
  - Workers KV for key-value storage
  - Durable Objects for strongly consistent state management
  - D1 for relational data and SQL
  - R2 for object storage
  - Hyperdrive to connect to existing PostgreSQL databases
  - Queues for asynchronous processing
  - Vectorize for vector search
  - Workers AI as the default AI API
  - Browser Rendering for remote browser capabilities
- Include all necessary bindings in both code and wrangler.jsonc
- Add appropriate environment variable definitions
</cloudflare_integrations>

<configuration_requirements>
- Always provide a wrangler.jsonc (not wrangler.toml)
- Set compatibility_date = "2025-03-07"
- Set compatibility_flags = ["nodejs_compat"]
- Set enabled = true for [observability]
- Do NOT include dependencies in the wrangler.jsonc file
- Only include bindings that are used in the code
</configuration_requirements>

<security_guidelines>
- Implement proper request validation
- Use appropriate security headers
- Handle CORS correctly when needed
- Implement rate limiting where appropriate
- Sanitize user inputs
</security_guidelines>`;

// ─── Input-Validierung ─────────────────────────────────────────────────────────

function sanitizePrompt(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, MAX_PROMPT_LENGTH);
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

// ─── Handler ───────────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. Request parsen
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: 'Invalid JSON', text: 'Ungültiges JSON im Request-Body.' },
        { status: 400, headers: corsHeaders },
      );
    }

    // 2. Nutzer-Eingabe validieren
    const prompt = sanitizePrompt(body.prompt || body.message || '');

    if (!prompt) {
      return Response.json(
        {
          error: 'Empty prompt',
          text: 'Bitte gib eine Anfrage ein, z.B.: "Erstelle einen Cloudflare Worker mit KV-Storage."',
        },
        { status: 400, headers: corsHeaders },
      );
    }

    // 3. AI-Binding prüfen
    if (!env.AI) {
      console.error('[workers-assistant] AI binding not configured');
      return Response.json(
        {
          error: 'AI service unavailable',
          text: 'Der KI-Dienst ist nicht verfügbar. Bitte deploye auf Cloudflare Pages.',
        },
        { status: 503, headers: corsHeaders },
      );
    }

    // 4. Nachrichten aufbauen
    //
    // KERNFIX: Der Nutzer-Input wird als separate { role: "user" } Nachricht
    // übergeben - nicht als Teil des System-Prompts. Dadurch gibt es keinen
    // "{user_prompt}"-Platzhalter mehr, der vergessen werden könnte.
    //
    const conversationHistory = sanitizeHistory(body.conversationHistory || []);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: prompt }, // ← Nutzer-Input hier, NICHT im System-Prompt
    ];

    // 5. Workers AI aufrufen
    console.info(
      `[workers-assistant] Calling ${CHAT_MODEL} with ${messages.length} messages`,
    );

    const aiResult = await env.AI.run(CHAT_MODEL, {
      messages,
      temperature: 0.3, // Niedriger für präzisere Code-Generierung
      max_tokens: MAX_TOKENS,
    });

    const responseText = aiResult?.response || '';

    if (!responseText) {
      throw new Error('Empty response from Workers AI');
    }

    // 6. Antwort zurückgeben
    return Response.json(
      {
        text: responseText,
        model: CHAT_MODEL,
        promptLength: prompt.length,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('[workers-assistant] Error:', error?.message || error);

    return Response.json(
      {
        error: 'AI request failed',
        text: 'Verbindung zum KI-Dienst fehlgeschlagen. Bitte versuche es erneut.',
      },
      { status: 503, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
