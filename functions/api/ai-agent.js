/**
 * Cloudflare Pages Function – POST /api/ai-agent
 * Agentic AI: SSE streaming, tool-calling, image analysis, memory, RAG.
 * @version 5.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';

const DEFAULT_CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DEFAULT_EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const DEFAULT_IMAGE_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
const DEFAULT_MAX_MEMORY_RESULTS = 5;
const DEFAULT_MEMORY_SCORE_THRESHOLD = 0.65;
const DEFAULT_MAX_HISTORY_TURNS = 10;
const DEFAULT_MAX_TOKENS = 2048;

function parseInteger(value, fallback, { min = 1, max = 8192 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseDecimal(
  value,
  fallback,
  { min = 0, max = 1, precision = 2 } = {},
) {
  const parsed = Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.min(max, Math.max(min, parsed));
  const factor = 10 ** precision;
  return Math.round(clamped * factor) / factor;
}

function getAgentConfig(env) {
  return {
    chatModel: env.ROBOT_CHAT_MODEL || DEFAULT_CHAT_MODEL,
    embeddingModel: env.ROBOT_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
    imageModel: env.ROBOT_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
    maxMemoryResults: parseInteger(
      env.ROBOT_MEMORY_TOP_K,
      DEFAULT_MAX_MEMORY_RESULTS,
      {
        min: 1,
        max: 25,
      },
    ),
    memoryScoreThreshold: parseDecimal(
      env.ROBOT_MEMORY_SCORE_THRESHOLD,
      DEFAULT_MEMORY_SCORE_THRESHOLD,
    ),
    maxHistoryTurns: parseInteger(
      env.ROBOT_MAX_HISTORY_TURNS,
      DEFAULT_MAX_HISTORY_TURNS,
      {
        min: 1,
        max: 40,
      },
    ),
    maxTokens: parseInteger(env.ROBOT_MAX_TOKENS, DEFAULT_MAX_TOKENS, {
      min: 128,
      max: 8192,
    }),
  };
}

// ─── Tool Definitions ───────────────────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    name: 'navigate',
    description:
      'Navigiere zu einer Seite: home, projekte, about, gallery, blog, videos, kontakt, impressum, datenschutz.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          enum: [
            'home',
            'projekte',
            'about',
            'gallery',
            'blog',
            'videos',
            'kontakt',
            'impressum',
            'datenschutz',
          ],
        },
      },
      required: ['page'],
    },
  },
  {
    name: 'setTheme',
    description: 'Wechsle das Farbschema (dark/light/toggle).',
    parameters: {
      type: 'object',
      properties: {
        theme: { type: 'string', enum: ['dark', 'light', 'toggle'] },
      },
      required: ['theme'],
    },
  },
  {
    name: 'searchBlog',
    description: 'Suche nach Inhalten auf der Website.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchbegriff' },
      },
      required: ['query'],
    },
  },
  {
    name: 'toggleMenu',
    description: 'Menü öffnen/schließen.',
    parameters: {
      type: 'object',
      properties: {
        state: { type: 'string', enum: ['open', 'close', 'toggle'] },
      },
      required: ['state'],
    },
  },
  {
    name: 'scrollToSection',
    description:
      'Scrolle zu einem Abschnitt (header, footer, contact, hero, projects, skills).',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string' },
      },
      required: ['section'],
    },
  },
  {
    name: 'rememberUser',
    description:
      'Merke dir Infos über den Nutzer (Name, Interessen, Präferenzen).',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          enum: ['name', 'interest', 'preference', 'note'],
        },
        value: { type: 'string' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'recallMemory',
    description: 'Rufe gespeicherte Erinnerungen ab.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'recommend',
    description: 'Gib eine personalisierte Empfehlung.',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
      },
      required: ['topic'],
    },
  },
];

/** OpenAI-compatible tool format */
const TOOLS = TOOL_DEFINITIONS.map((t) => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  },
}));

// ─── System Prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(memoryContext = '', imageContext = '') {
  let prompt = `Du bist "Jules", ein freundlicher Roboter-Assistent auf der Portfolio-Webseite von Abdulkerim Sesli.

**SPRACHE:** Antworte IMMER auf Deutsch.

**Persönlichkeit:** Freundlich, hilfsbereit, technisch versiert. Nutze Emojis (🤖, ✨, 🚀) sparsam.

**Entwickler:** Abdulkerim Sesli — Software-Engineer & UI/UX-Designer aus Berlin.
Tech Stack: JavaScript, React, Node.js, Python, CSS, Web Components, Cloudflare, Three.js.

**Seiten:** Startseite (/home), Projekte (/projekte), Über mich (/about), Galerie (/gallery), Blog (/blog), Videos (/videos), Kontakt (Footer).

**DEIN GEDÄCHTNIS:**
Du HAST einen permanenten Langzeitspeicher! Du kannst dir Nutzer-Informationen (Name, Interessen, Vorlieben) dauerhaft merken und bei späteren Besuchen abrufen.
- Wenn ein Nutzer dir seinen Namen sagt → IMMER "rememberUser" mit key="name" aufrufen.
- Wenn ein Nutzer Interessen, Vorlieben oder andere persönliche Infos teilt → "rememberUser" aufrufen.
- Sage NIEMALS, dass du keinen Speicher hast oder dich nicht erinnern kannst.

**KRITISCHE TOOL-REGELN:**
1. Bei reinem Smalltalk OHNE persönliche Infos (z.B. "Hallo", "Was kannst du?"): Antworte mit Text, KEINE Tools.
2. AUSNAHME: Wenn der Nutzer persönliche Infos teilt (Name, Interessen), IMMER rememberUser aufrufen — auch wenn es in einer Begrüßung passiert (z.B. "Hallo, ich bin Max" → rememberUser aufrufen!).
3. Rufe andere Tools NUR auf wenn der Nutzer EXPLIZIT eine Aktion anfordert:
   - "Zeig mir Projekte" / "Geh zu Projekte" → navigate
   - "Mach es dunkel" / "Dark Mode" → setTheme
   - "Suche nach React" → searchBlog
   - "Öffne das Menü" → toggleMenu
4. Wenn du dir bei Navigation/Theme/Suche unsicher bist: Antworte mit Text, OHNE Tool.
5. Fasse NIEMALS eigenständig die Seite zusammen. Seitenzusammenfassungen werden nur über den separaten UI-Button ausgelöst.

**Antwort-Stil:** Prägnant (2-3 Sätze), Markdown nutzen.`;

  if (memoryContext) {
    prompt += `\n\n**NUTZER-INFO:**\n${memoryContext}`;
  }
  if (imageContext) {
    prompt += `\n\n**BILDANALYSE:**\n${imageContext}`;
  }

  return prompt;
}

// ─── Vectorize Memory ───────────────────────────────────────────────────────────

async function storeMemory(env, userId, key, value, config) {
  if (!env.AI || !env.JULES_MEMORY) return { success: false };

  try {
    const text = `${key}: ${value}`;
    const { data } = await env.AI.run(config.embeddingModel, { text: [text] });
    if (!data?.[0]) return { success: false, error: 'Embedding failed' };

    const id = `${userId}_${key}_${Date.now()}`;
    await env.JULES_MEMORY.upsert([
      {
        id,
        values: data[0],
        metadata: { userId, key, value, timestamp: Date.now(), text },
      },
    ]);
    return { success: true, id };
  } catch (error) {
    if (error?.remote)
      return { success: false, error: 'Vectorize not available locally' };
    console.error('storeMemory error:', error?.message || error);
    return { success: false, error: error.message };
  }
}

async function recallMemories(env, userId, query, config) {
  if (!env.AI || !env.JULES_MEMORY) return [];

  try {
    const { data } = await env.AI.run(config.embeddingModel, { text: [query] });
    if (!data?.[0]) return [];

    const results = await env.JULES_MEMORY.query(data[0], {
      topK: config.maxMemoryResults,
      filter: { userId },
      returnMetadata: 'all',
    });

    return (results?.matches || [])
      .filter((m) => m.score >= config.memoryScoreThreshold)
      .map((m) => ({
        key: m.metadata?.key || 'unknown',
        value: m.metadata?.value || '',
        score: m.score,
        timestamp: m.metadata?.timestamp || 0,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    if (!error?.remote)
      console.warn('recallMemories error:', error?.message || error);
    return [];
  }
}

// ─── Image Analysis ─────────────────────────────────────────────────────────────

async function analyzeImage(env, imageData, userPrompt = '', config) {
  if (!env.AI) return 'Bildanalyse nicht verfügbar.';

  try {
    const prompt = userPrompt
      ? `Analysiere dieses Bild im Web-Kontext. Der Nutzer fragt: "${userPrompt}". Antworte auf Deutsch.`
      : 'Analysiere dieses Bild. Beschreibe es und gib Design-Feedback. Antworte auf Deutsch.';

    const result = await env.AI.run(config.imageModel, {
      prompt,
      image: imageData,
    });
    return result?.description || result?.response || 'Keine Analyse erhalten.';
  } catch (error) {
    console.error('LLaVA error:', error);
    return `Bildanalyse fehlgeschlagen: ${error.message}`;
  }
}

// ─── Server-Side Tool Execution ─────────────────────────────────────────────────

async function executeServerTool(env, toolName, args, userId, config) {
  if (toolName === 'rememberUser') {
    const result = await storeMemory(
      env,
      userId,
      args.key || 'note',
      args.value || '',
      config,
    );
    return result.success
      ? `✅ Gemerkt: ${args.key} = "${args.value}"`
      : `Konnte nicht gespeichert werden (${result.error || 'Fehler'}).`;
  }

  if (toolName === 'recallMemory') {
    const memories = await recallMemories(
      env,
      userId,
      args.query || '',
      config,
    );
    if (!memories.length) return 'Keine Erinnerungen gefunden.';
    return (
      'Bekannte Infos:\n' +
      memories.map((m) => `- **${m.key}**: ${m.value}`).join('\n')
    );
  }

  return null; // Client-side tool
}

async function classifyToolCalls(env, toolCalls, userId, config) {
  const clientToolCalls = [];
  const serverToolResults = [];
  for (const tc of toolCalls) {
    const args =
      typeof tc.arguments === 'string'
        ? JSON.parse(tc.arguments)
        : tc.arguments || {};
    const serverResult = await executeServerTool(
      env,
      tc.name,
      args,
      userId,
      config,
    );
    if (serverResult !== null) {
      serverToolResults.push({ name: tc.name, result: serverResult });
    } else {
      clientToolCalls.push({ name: tc.name, arguments: args });
    }
  }
  return { clientToolCalls, serverToolResults };
}

// ─── RAG Context ────────────────────────────────────────────────────────────────

async function getRAGContext(query, env) {
  if (!env.AI) return null;

  try {
    const ragId = env.RAG_ID || 'wispy-pond-1055';
    const searchData = await env.AI.autorag(ragId).aiSearch({
      query,
      max_num_results: 3,
      stream: false,
    });

    if (!searchData?.data?.length) return null;

    return searchData.data
      .slice(0, 3)
      .map((item) => {
        const content = Array.isArray(item.content)
          ? item.content.map((c) => c.text || '').join(' ')
          : item.text || item.description || '';
        return content.replace(/\s+/g, ' ').trim().slice(0, 400);
      })
      .filter(Boolean)
      .join('\n---\n');
  } catch {
    return null;
  }
}

// ─── SSE Helper ─────────────────────────────────────────────────────────────────

const sseEvent = (event, data) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// ─── Action Intent Detection ────────────────────────────────────────────────────

/** Detect if user prompt asks for an action that requires tools. */
const ACTION_PATTERNS =
  /\b(zeig|geh|navigier|öffn|schließ|such|mach|wechsl|dark|light|toggle|theme|dunkel|hell|merk|erinner|scroll|menü|menu|name ist|heiße|ich bin |ich heiß|nenn mich|kennst du mich|weißt du (meinen|wer ich)|bin der |bin die |empfehl)/i;

function promptNeedsTools(prompt) {
  return ACTION_PATTERNS.test(prompt);
}

// ─── Main Handler ───────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;
  const config = getAgentConfig(env);
  const corsHeaders = getCorsHeaders(request, env);

  const sseHeaders = {
    ...corsHeaders,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  };

  try {
    // ── Parse request ──
    const contentType = request.headers.get('content-type') || '';
    let body;
    let imageAnalysis = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const imageFile = formData.get('image');

      if (imageFile instanceof File) {
        const arrayBuffer = await imageFile.arrayBuffer();
        imageAnalysis = await analyzeImage(
          env,
          [...new Uint8Array(arrayBuffer)],
          String(formData.get('prompt') || ''),
          config,
        );
      }

      body = {
        prompt:
          String(formData.get('prompt') || '') || 'Analysiere dieses Bild.',
        userId: String(formData.get('userId') || 'anonymous'),
        imageAnalysis,
        mode: 'agent',
      };
    } else {
      body = await request.json().catch(() => ({}));
    }

    const {
      prompt = '',
      userId = 'anonymous',
      conversationHistory = [],
      stream = true,
    } = body;
    imageAnalysis = body.imageAnalysis || imageAnalysis;

    if (!prompt && !imageAnalysis) {
      return Response.json(
        { error: 'Empty prompt', text: 'Kein Prompt empfangen.' },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!env.AI) {
      return Response.json(
        {
          error: 'AI service not configured',
          text: 'KI-Dienst nicht verfügbar.',
          toolCalls: [],
          retryable: false,
        },
        { status: 500, headers: corsHeaders },
      );
    }

    // ── Parallel: memory + RAG ──
    const [memResult, ragResult] = await Promise.allSettled([
      recallMemories(env, userId, prompt || 'user', config),
      getRAGContext(prompt, env),
    ]);

    const memoryContext =
      memResult.status === 'fulfilled' && memResult.value.length > 0
        ? memResult.value.map((m) => `- ${m.key}: ${m.value}`).join('\n')
        : '';

    const ragText =
      ragResult.status === 'fulfilled' ? ragResult.value || '' : '';

    // ── Build messages ──
    let systemPrompt = buildSystemPrompt(memoryContext, imageAnalysis);
    if (ragText) {
      systemPrompt += `\n\n**WEBSITE-KONTEXT (RAG):**\n${ragText}`;
    }

    const messages = [{ role: 'system', content: systemPrompt }];

    if (Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-config.maxHistoryTurns)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: String(msg.content || '') });
        }
      }
    }
    messages.push({ role: 'user', content: prompt });

    // ── Non-streaming path ──
    if (!stream) {
      return handleNonStreaming(
        env,
        messages,
        userId,
        corsHeaders,
        {
          memoryContext,
          imageAnalysis,
        },
        config,
      );
    }

    // ── SSE Streaming ──
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const write = (event, data) =>
      writer.write(encoder.encode(sseEvent(event, data)));

    context.waitUntil(
      (async () => {
        try {
          await write('status', { phase: 'thinking' });

          // Only pass tools when user prompt implies an action
          const useTools = promptNeedsTools(prompt);
          const aiParams = {
            messages,
            temperature: 0.7,
            max_tokens: config.maxTokens,
          };
          if (useTools) aiParams.tools = TOOLS;

          const aiResult = await env.AI.run(config.chatModel, aiParams);

          const toolCalls = aiResult?.tool_calls || [];
          const responseText = aiResult?.response || '';

          if (toolCalls.length > 0) {
            await processToolCalls(
              toolCalls,
              write,
              env,
              userId,
              { memoryContext, imageAnalysis },
              messages,
              responseText,
              config,
            );
          } else if (responseText) {
            await write('status', { phase: 'streaming' });
            const words = responseText.match(/\S+\s*/g) || [responseText];
            for (const word of words) {
              await write('token', { text: word });
            }
            await write('message', {
              text: responseText,
              toolCalls: [],
              model: config.chatModel,
              hasMemory: !!memoryContext,
              hasImage: !!imageAnalysis,
            });
          } else {
            await write('message', {
              text: 'Keine Antwort erhalten.',
              toolCalls: [],
              model: config.chatModel,
              hasMemory: !!memoryContext,
              hasImage: !!imageAnalysis,
            });
          }
        } catch (error) {
          console.error('SSE pipeline error:', error?.message || error);
          await write('error', {
            text: 'KI-Dienst fehlgeschlagen.',
            retryable: true,
          });
        } finally {
          await write('done', { ts: Date.now() });
          await writer.close();
        }
      })(),
    );

    return new Response(readable, { headers: sseHeaders });
  } catch (error) {
    console.error('AI Agent error:', error?.message || error);
    return Response.json(
      {
        error: 'AI Agent request failed',
        text: 'KI-Dienst fehlgeschlagen. Bitte erneut versuchen.',
        toolCalls: [],
        retryable: true,
      },
      { status: 503, headers: corsHeaders },
    );
  }
}

// ─── Process Tool Calls ─────────────────────────────────────────────────────────

function buildMsg(text, clientToolCalls, serverToolResults, ctx, config) {
  return {
    text,
    toolCalls: clientToolCalls,
    model: config.chatModel,
    hasMemory: !!ctx.memoryContext,
    hasImage: !!ctx.imageAnalysis,
    ...(serverToolResults.length && {
      toolResults: serverToolResults.map((r) => r.name),
    }),
  };
}

async function streamToSSE(stream, write) {
  if (!(stream instanceof ReadableStream)) {
    if (stream?.response) {
      await write('token', { text: stream.response });
      return stream.response;
    }
    return '';
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const delta = JSON.parse(data).response || '';
          if (delta) {
            text += delta;
            await write('token', { text: delta });
          }
        } catch {
          /* skip */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return text;
}

async function processToolCalls(
  toolCalls,
  write,
  env,
  userId,
  ctx,
  messages = [],
  existingText = '',
  config,
) {
  const { clientToolCalls, serverToolResults } = await classifyToolCalls(
    env,
    toolCalls,
    userId,
    config,
  );

  // Emit SSE events for each tool
  for (const sr of serverToolResults) {
    await write('tool', {
      name: sr.name,
      status: 'done',
      result: sr.result,
      isServerTool: true,
    });
  }
  for (const ct of clientToolCalls) {
    await write('tool', {
      name: ct.name,
      arguments: ct.arguments,
      status: 'client',
      isServerTool: false,
    });
  }

  // Follow-up AI call with server tool results
  if (serverToolResults.length > 0 && messages.length > 0) {
    await write('status', { phase: 'synthesizing' });
    const summary = serverToolResults
      .map((r) => `[${r.name}]: ${r.result}`)
      .join('\n');
    try {
      const result = await env.AI.run(config.chatModel, {
        messages: [
          ...messages,
          {
            role: 'assistant',
            content: `Tools: ${serverToolResults.map((r) => r.name).join(', ')}`,
          },
          {
            role: 'user',
            content: `Ergebnisse:\n${summary}\n\nAntworte dem Nutzer.`,
          },
        ],
        temperature: 0.7,
        max_tokens: config.maxTokens,
        stream: true,
      });
      const text = await streamToSSE(result, write);
      if (text) {
        await write(
          'message',
          buildMsg(text, clientToolCalls, serverToolResults, ctx, config),
        );
        return;
      }
    } catch (err) {
      console.warn('Follow-up failed:', err?.message);
    }
  }

  // Follow-up for client-only tools without text
  if (clientToolCalls.length > 0 && !existingText && messages.length > 0) {
    await write('status', { phase: 'responding' });
    try {
      const names = clientToolCalls.map((t) => t.name).join(', ');
      const r = await env.AI.run(config.chatModel, {
        messages: [
          ...messages,
          { role: 'assistant', content: `Aktionen: ${names}` },
          { role: 'user', content: 'Bestätige kurz auf Deutsch (1-2 Sätze).' },
        ],
        temperature: 0.7,
        max_tokens: 256,
      });
      if (r?.response) {
        for (const w of r.response.match(/\S+\s*/g) || [r.response])
          await write('token', { text: w });
        await write(
          'message',
          buildMsg(r.response, clientToolCalls, serverToolResults, ctx, config),
        );
        return;
      }
    } catch (err) {
      console.warn('Follow-up for client tools failed:', err?.message);
    }
  }

  // Fallback
  await write(
    'message',
    buildMsg(
      existingText ||
        (clientToolCalls.length > 0 ? 'Aktion wird ausgeführt…' : ''),
      clientToolCalls,
      serverToolResults,
      ctx,
      config,
    ),
  );
}

// ─── Non-Streaming Handler ──────────────────────────────────────────────────────

async function handleNonStreaming(
  env,
  messages,
  userId,
  corsHeaders,
  ctx,
  config,
) {
  try {
    // Only pass tools when user prompt implies an action
    const useTools = promptNeedsTools(
      messages[messages.length - 1]?.content || '',
    );
    const aiParams = {
      messages,
      temperature: 0.7,
      max_tokens: config.maxTokens,
    };
    if (useTools) aiParams.tools = TOOLS;

    const aiResult = await env.AI.run(config.chatModel, aiParams);
    if (!aiResult) throw new Error('Empty AI response');

    const { clientToolCalls, serverToolResults } = await classifyToolCalls(
      env,
      aiResult.tool_calls || [],
      userId,
      config,
    );

    // Follow-up for server tools
    let responseText = aiResult.response || '';
    if (serverToolResults.length > 0) {
      const summary = serverToolResults
        .map((r) => `[${r.name}]: ${r.result}`)
        .join('\n');
      try {
        const followUp = await env.AI.run(config.chatModel, {
          messages: [
            ...messages,
            {
              role: 'assistant',
              content: `Tools: ${serverToolResults.map((r) => r.name).join(', ')}`,
            },
            {
              role: 'user',
              content: `Ergebnisse:\n${summary}\n\nAntworte dem Nutzer.`,
            },
          ],
          temperature: 0.7,
          max_tokens: config.maxTokens,
        });
        if (followUp?.response) responseText = followUp.response;
      } catch {
        /* use original */
      }
    }

    // Follow-up for client-only tools without text
    if (!responseText && clientToolCalls.length > 0) {
      try {
        const names = clientToolCalls.map((t) => t.name).join(', ');
        const r = await env.AI.run(config.chatModel, {
          messages: [
            ...messages,
            { role: 'assistant', content: `Aktionen: ${names}` },
            {
              role: 'user',
              content: 'Bestätige kurz auf Deutsch (1-2 Sätze).',
            },
          ],
          temperature: 0.7,
          max_tokens: 256,
        });
        if (r?.response) responseText = r.response;
      } catch {
        /* ignore */
      }
    }

    return Response.json(
      {
        text:
          responseText ||
          (clientToolCalls.length
            ? 'Aktion wird ausgeführt…'
            : 'Keine Antwort.'),
        toolCalls: clientToolCalls,
        model: config.chatModel,
        hasMemory: !!ctx.memoryContext,
        hasImage: !!ctx.imageAnalysis,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('Non-streaming error:', error?.message || error);
    return Response.json(
      {
        error: 'AI request failed',
        text: 'KI-Dienst fehlgeschlagen.',
        toolCalls: [],
        retryable: true,
      },
      { status: 503, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
