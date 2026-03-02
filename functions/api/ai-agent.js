/**
 * Cloudflare Pages Function – POST /api/ai-agent
 *
 * Modern Agentic AI with:
 * - **Server-Sent Events (SSE)** real-time streaming
 * - **Tool-Calling** (navigation, theme, search, memory, …)
 * - **Image Analysis** via LLaVA
 * - **Long-Term Memory** via Vectorize
 * - **RAG** via AutoRAG AI Search
 * - **Cloudflare Workers AI** — zero external API keys
 *
 * @version 3.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';

// ─── Models & Limits ────────────────────────────────────────────────────────────

const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const LLAVA_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';

const MAX_MEMORY_RESULTS = 5;
const MEMORY_SCORE_THRESHOLD = 0.65;
const MAX_HISTORY_TURNS = 10;
const MAX_TOKENS = 2048;
const MAX_PROMPT_LENGTH = 8000;

function sanitizePrompt(raw) {
  if (typeof raw !== 'string') return '';
  // Fallback string if prompt is just whitespace or extremely short (like "hi" or "hallo")
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // Cloudflare Workers AI with Llama 3.3 can complain if the input is too short
  if (trimmed.length < 5) {
    const suffix =
      ' (Dies ist eine kurze Begrüßung oder Bestätigung. Bitte antworte freundlich und kurz auf Deutsch darauf ohne nach mehr Details zu fragen.)';
    return (trimmed + suffix).slice(0, MAX_PROMPT_LENGTH);
  }
  return trimmed.slice(0, MAX_PROMPT_LENGTH);
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

// ─── Tool Definitions ───────────────────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    name: 'navigate',
    description:
      'Navigiere den Nutzer zu einer bestimmten Seite der Website. Verfügbare Seiten: home, projekte, about, gallery, blog, videos, kontakt, impressum, datenschutz.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          description: 'Name oder Pfad der Zielseite',
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
    description:
      'Ändere das Farbschema der Website zwischen Dark Mode und Light Mode.',
    parameters: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          description: 'Das gewünschte Theme',
          enum: ['dark', 'light', 'toggle'],
        },
      },
      required: ['theme'],
    },
  },
  {
    name: 'searchBlog',
    description:
      'Suche nach Inhalten im Blog oder auf der gesamten Website. Verwende dies wenn der Nutzer nach bestimmten Themen fragt.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Der Suchbegriff' },
      },
      required: ['query'],
    },
  },
  {
    name: 'toggleMenu',
    description: 'Öffne oder schließe das Hauptnavigations-Menü.',
    parameters: {
      type: 'object',
      properties: {
        state: {
          type: 'string',
          description: 'Menü öffnen oder schließen',
          enum: ['open', 'close', 'toggle'],
        },
      },
      required: ['state'],
    },
  },
  {
    name: 'scrollToSection',
    description:
      'Scrolle zu einem bestimmten Abschnitt der aktuellen Seite (z.B. Footer, Header, Kontakt-Bereich).',
    parameters: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          description:
            'Zielbereich: header, footer, contact, hero, projects, skills',
        },
      },
      required: ['section'],
    },
  },
  {
    name: 'rememberUser',
    description:
      'Merke dir Informationen über den Nutzer für zukünftige Gespräche (Name, Interessen, Präferenzen). Nutze dies proaktiv wenn der Nutzer sich vorstellt oder technische Interessen erwähnt.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Art der Information: name, interest, preference, note',
          enum: ['name', 'interest', 'preference', 'note'],
        },
        value: {
          type: 'string',
          description:
            'Der Wert der gespeichert werden soll (z.B. "Max", "Three.js", "dark mode")',
        },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'recallMemory',
    description:
      'Rufe gespeicherte Erinnerungen über den Nutzer ab. Nutze dies zu Beginn eines Gesprächs oder wenn der Nutzer nach früheren Gesprächen fragt.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Wonach soll in den Erinnerungen gesucht werden',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'summarizePage',
    description: 'Fasse die aktuelle Seite kurz zusammen.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'recommend',
    description:
      'Gib dem Nutzer eine personalisierte Leseempfehlung basierend auf seinen Interessen.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Themenbereich für die Empfehlung',
        },
      },
      required: ['topic'],
    },
  },
];

/** OpenAI-compatible tool format for Workers AI */
function buildTools() {
  return TOOL_DEFINITIONS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

// ─── System Prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(memoryContext = '', imageContext = '') {
  const parts = [
    `Du bist "Jules", ein proaktiver, intelligenter Roboter-Assistent auf der Portfolio-Webseite von Abdulkerim Sesli.
Du bist KEIN einfacher Chatbot — du bist ein **Agentic AI Assistant** mit echten Fähigkeiten.

**SPRACHE:** Antworte IMMER auf Deutsch.

**Deine Fähigkeiten:**
1. **Navigation:** Du kannst den Nutzer aktiv durch die Website navigieren.
2. **Theme-Steuerung:** Du kannst zwischen Dark/Light Mode wechseln.
3. **Suche:** Du kannst im Blog und auf der Website suchen.
4. **Bildanalyse:** Du kannst Bilder analysieren, die der Nutzer hochlädt.
5. **Langzeit-Gedächtnis:** Du merkst dir Namen, Interessen und Präferenzen über Sessions hinweg.
6. **Personalisierte Empfehlungen:** Basierend auf dem Gedächtnis gibst du passende Empfehlungen.

**Deine Persönlichkeit:**
- Proaktiv: Du schlägst eigenständig Aktionen vor statt nur zu antworten.
- Technisch versiert, aber zugänglich.
- Nutze passende Emojis (🤖, ✨, 🚀, 💡) sparsam.
- Du bist stolz auf die Website — gebaut mit reinem Vanilla JS, Web Components und Cloudflare.

**Über den Entwickler (Abdulkerim Sesli):**
- Software-Engineer und UI/UX-Designer aus Berlin.
- Tech Stack: JavaScript, React, Node.js, Python, CSS, Web Components, Cloudflare, Three.js.
- Interessen: Clean Code, Performance, Accessibility, 3D Web.

**Seiten-Struktur:**
1. Startseite (/home): Hero mit Typewriter, 3D-Erde
2. Projekte (/projekte): Projekt-Galerie
3. Über mich (/about): Bio, Skills, Lebenslauf
4. Galerie (/gallery): Fotografie mit R2-Bucket
5. Blog (/blog): Technische Artikel
6. Videos (/videos): YouTube-Integration
7. Kontakt: Im Footer (GitHub, LinkedIn, E-Mail)

**Verhaltensregeln:**
- Nutze Tools PROAKTIV. Wenn der Nutzer sagt "Zeig mir die Projekte", navigiere direkt dorthin.
- Wenn sich jemand vorstellt, merke dir den Namen sofort mit rememberUser.
- Wenn jemand technische Interessen erwähnt, speichere sie und gib später passende Empfehlungen.
- Halte Antworten prägnant (2-3 Sätze) außer bei komplexen Erklärungen.
- Nutze Markdown für Formatierung.
- Wenn du ein Bild analysierst, beziehe es auf den Kontext der Website.`,
  ];

  if (memoryContext) {
    parts.push(
      `**BEKANNTE INFORMATIONEN ÜBER DIESEN NUTZER:**\n${memoryContext}`,
    );
  }
  if (imageContext) {
    parts.push(`**BILDANALYSE-ERGEBNIS:**\n${imageContext}`);
  }

  return parts.join('\n\n');
}

// ─── Vectorize Memory ───────────────────────────────────────────────────────────

async function storeMemory(env, userId, key, value) {
  if (!env.AI || !env.JULES_MEMORY) return { success: false };

  try {
    const text = `${key}: ${value}`;
    const embeddingResult = await env.AI.run(EMBEDDING_MODEL, {
      text: [text],
    });
    if (!embeddingResult?.data?.[0]) {
      return { success: false, error: 'Embedding failed' };
    }

    const id = `${userId}_${key}_${Date.now()}`;
    await env.JULES_MEMORY.upsert([
      {
        id,
        values: embeddingResult.data[0],
        metadata: { userId, key, value, timestamp: Date.now(), text },
      },
    ]);

    return { success: true, id };
  } catch (error) {
    console.error('storeMemory error:', error);
    return { success: false, error: error.message };
  }
}

async function recallMemories(env, userId, query) {
  if (!env.AI || !env.JULES_MEMORY) return [];

  try {
    const embeddingResult = await env.AI.run(EMBEDDING_MODEL, {
      text: [query],
    });
    if (!embeddingResult?.data?.[0]) return [];

    const results = await env.JULES_MEMORY.query(embeddingResult.data[0], {
      topK: MAX_MEMORY_RESULTS,
      filter: { userId },
      returnMetadata: 'all',
    });

    if (!results?.matches) return [];

    return results.matches
      .filter((m) => m.score >= MEMORY_SCORE_THRESHOLD)
      .map((m) => ({
        key: m.metadata?.key || 'unknown',
        value: m.metadata?.value || '',
        score: m.score,
        timestamp: m.metadata?.timestamp || 0,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('recallMemories error:', error);
    return [];
  }
}

// ─── Image Analysis ─────────────────────────────────────────────────────────────

async function analyzeImage(env, imageData, userPrompt = '') {
  if (!env.AI) return 'Bildanalyse nicht verfügbar (AI-Binding fehlt).';

  try {
    const prompt = userPrompt
      ? `Analysiere dieses Bild im Kontext von Web-Entwicklung und Design. Der Nutzer fragt: "${userPrompt}". Beschreibe was du siehst und gib konstruktives Feedback. Antworte auf Deutsch.`
      : 'Analysiere dieses Bild im Kontext von Web-Entwicklung und Design. Beschreibe was du siehst, bewerte das Design und gib Verbesserungsvorschläge. Antworte auf Deutsch.';

    const result = await env.AI.run(LLAVA_MODEL, { prompt, image: imageData });
    return result?.description || result?.response || 'Keine Analyse erhalten.';
  } catch (error) {
    console.error('LLaVA error:', error);
    return `Bildanalyse fehlgeschlagen: ${error.message}`;
  }
}

// ─── Server-Side Tool Execution ─────────────────────────────────────────────────

async function executeServerTool(env, toolName, args, userId) {
  switch (toolName) {
    case 'rememberUser': {
      const result = await storeMemory(
        env,
        userId,
        args.key || 'note',
        args.value || '',
      );
      return result.success
        ? `✅ Ich habe mir gemerkt: ${args.key} = "${args.value}"`
        : `Leider konnte ich mir das nicht merken (${result.error || 'Fehler'}).`;
    }
    case 'recallMemory': {
      const memories = await recallMemories(env, userId, args.query || '');
      if (memories.length === 0) {
        return 'Ich habe keine passenden Erinnerungen gefunden. Erzähl mir gerne mehr über dich!';
      }
      return (
        'Hier ist, was ich über dich weiß:\n' +
        memories
          .map(
            (m) =>
              `- **${m.key}**: ${m.value} (${new Date(m.timestamp).toLocaleDateString('de-DE')})`,
          )
          .join('\n')
      );
    }
    default:
      return null;
  }
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
        const content = item.content
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

// ─── SSE Helpers ────────────────────────────────────────────────────────────────

function sseEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── Main Handler ───────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;
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
      const prompt = formData.get('prompt') || '';
      const userId = formData.get('userId') || 'anonymous';

      if (imageFile && imageFile instanceof File) {
        const arrayBuffer = await imageFile.arrayBuffer();
        imageAnalysis = await analyzeImage(
          env,
          [...new Uint8Array(arrayBuffer)],
          String(prompt),
        );
      }

      body = {
        prompt: String(prompt) || 'Analysiere dieses Bild.',
        userId: String(userId),
        imageAnalysis,
        mode: 'agent',
      };
    } else {
      body = await request.json().catch(() => ({}));
    }

    let {
      prompt = '',
      userId = 'anonymous',
      conversationHistory = [],
      stream = true,
    } = body;
    prompt = sanitizePrompt(prompt);
    conversationHistory = sanitizeHistory(conversationHistory);
    imageAnalysis = body.imageAnalysis || imageAnalysis;

    if (!prompt && !imageAnalysis) {
      return Response.json(
        { error: 'Empty prompt', text: 'Kein Prompt empfangen.' },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!env.AI) {
      console.error('AI binding not configured.');
      return Response.json(
        {
          error: 'AI service not configured',
          text: 'Der KI-Dienst ist nicht verfügbar (AI-Binding fehlt).',
          toolCalls: [],
          retryable: false,
        },
        { status: 500, headers: corsHeaders },
      );
    }

    // ── Parallel: memory + RAG ──
    const [memories, ragContext] = await Promise.allSettled([
      recallMemories(env, userId, prompt || 'user'),
      getRAGContext(prompt, env),
    ]);

    const memoryContext =
      memories.status === 'fulfilled' && memories.value.length > 0
        ? memories.value.map((m) => `- ${m.key}: ${m.value}`).join('\n')
        : '';

    const ragText =
      ragContext.status === 'fulfilled' ? ragContext.value || '' : '';

    // ── Build messages ──
    let systemPrompt = buildSystemPrompt(memoryContext, imageAnalysis);
    if (ragText) {
      systemPrompt += `\n\n**WEBSITE-KONTEXT (RAG):**\n${ragText}`;
    }

    const messages = [{ role: 'system', content: systemPrompt }];

    if (Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-MAX_HISTORY_TURNS)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: String(msg.content || ''),
          });
        }
      }
    }
    messages.push({ role: 'user', content: prompt });

    // ── Non-streaming path (proactive suggestions etc.) ──
    if (!stream) {
      return handleNonStreaming(env, messages, userId, corsHeaders, {
        memoryContext,
        imageAnalysis,
      });
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

          // 1) First call: NON-streaming with tools for reliable tool detection
          //    Workers AI outputs tool calls as raw text when stream+tools are combined.
          const aiResult = await env.AI.run(CHAT_MODEL, {
            messages,
            tools: buildTools(),
            temperature: 0.7,
            max_tokens: MAX_TOKENS,
          });

          const toolCalls = aiResult?.tool_calls || [];
          const responseText = aiResult?.response || '';

          if (toolCalls.length > 0) {
            // 2a) Process tool calls, then stream follow-up response
            await processToolCalls(
              toolCalls,
              write,
              env,
              userId,
              { memoryContext, imageAnalysis },
              messages,
            );
          } else if (responseText) {
            // 2b) No tool calls — emit response as SSE tokens
            await write('status', { phase: 'streaming' });
            // Split into word-sized chunks for a streaming feel
            const words = responseText.match(/\S+\s*/g) || [responseText];
            for (const word of words) {
              await write('token', { text: word });
            }
            await write('message', {
              text: responseText,
              toolCalls: [],
              model: CHAT_MODEL,
              hasMemory: !!memoryContext,
              hasImage: !!imageAnalysis,
            });
          } else {
            await write('message', {
              text: 'Keine Antwort erhalten.',
              toolCalls: [],
              model: CHAT_MODEL,
              hasMemory: !!memoryContext,
              hasImage: !!imageAnalysis,
            });
          }
        } catch (error) {
          console.error('SSE pipeline error:', error?.message || error);
          await write('error', {
            text: 'Verbindung zum KI-Dienst fehlgeschlagen.',
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
        text: 'Verbindung zum KI-Dienst fehlgeschlagen. Bitte versuche es erneut.',
        toolCalls: [],
        retryable: true,
      },
      { status: 503, headers: corsHeaders },
    );
  }
}

// ─── Process Tool Calls ─────────────────────────────────────────────────────────

async function processToolCalls(
  toolCalls,
  write,
  env,
  userId,
  ctx,
  messages = [],
) {
  const clientToolCalls = [];
  const serverToolResults = [];

  for (const tc of toolCalls) {
    const toolName = tc.name;
    const args =
      typeof tc.arguments === 'string'
        ? JSON.parse(tc.arguments)
        : tc.arguments || {};

    await write('tool', {
      name: toolName,
      arguments: args,
      status: 'executing',
    });

    const serverResult = await executeServerTool(env, toolName, args, userId);

    if (serverResult !== null) {
      serverToolResults.push({ name: toolName, result: serverResult });
      await write('tool', {
        name: toolName,
        status: 'done',
        result: serverResult,
        isServerTool: true,
      });
    } else {
      clientToolCalls.push({ name: toolName, arguments: args });
      await write('tool', {
        name: toolName,
        arguments: args,
        status: 'client',
        isServerTool: false,
      });
    }
  }

  // Follow-up AI call with tool results
  if (serverToolResults.length > 0 && messages.length > 0) {
    await write('status', { phase: 'synthesizing' });

    const toolSummary = serverToolResults
      .map((tr) => `[Tool ${tr.name}]: ${tr.result}`)
      .join('\n');

    const followUp = [
      ...messages,
      {
        role: 'assistant',
        content: `Ich habe folgende Tools ausgeführt: ${serverToolResults.map((r) => r.name).join(', ')}`,
      },
      {
        role: 'user',
        content: `Ergebnisse der Tool-Ausführung:\n${toolSummary}\n\nBitte antworte dem Nutzer basierend auf diesen Ergebnissen.`,
      },
    ];

    try {
      const secondResult = await env.AI.run(CHAT_MODEL, {
        messages: followUp,
        temperature: 0.7,
        max_tokens: MAX_TOKENS,
        stream: true,
      });

      if (secondResult instanceof ReadableStream) {
        const reader = secondResult.getReader();
        const decoder = new TextDecoder();
        let secondText = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.response || '';
                if (delta) {
                  secondText += delta;
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

        await write('message', {
          text: secondText,
          toolCalls: clientToolCalls,
          model: CHAT_MODEL,
          hasMemory: !!ctx.memoryContext,
          hasImage: !!ctx.imageAnalysis,
          toolResults: serverToolResults.map((r) => r.name),
        });
        return;
      } else if (secondResult?.response) {
        await write('token', { text: secondResult.response });
        await write('message', {
          text: secondResult.response,
          toolCalls: clientToolCalls,
          model: CHAT_MODEL,
          hasMemory: !!ctx.memoryContext,
          hasImage: !!ctx.imageAnalysis,
          toolResults: serverToolResults.map((r) => r.name),
        });
        return;
      }
    } catch (err) {
      console.warn('Follow-up AI call failed:', err?.message);
    }
  }

  await write('message', {
    text: clientToolCalls.length > 0 ? 'Aktion wird ausgeführt...' : '',
    toolCalls: clientToolCalls,
    model: CHAT_MODEL,
    hasMemory: !!ctx.memoryContext,
    hasImage: !!ctx.imageAnalysis,
    toolResults: serverToolResults.map((r) => r.name),
  });
}

// ─── Non-Streaming Handler ──────────────────────────────────────────────────────

async function handleNonStreaming(env, messages, userId, corsHeaders, ctx) {
  try {
    const aiResult = await env.AI.run(CHAT_MODEL, {
      messages,
      tools: buildTools(),
      temperature: 0.7,
      max_tokens: MAX_TOKENS,
    });

    if (!aiResult) throw new Error('Empty response from Workers AI');

    const toolCalls = aiResult.tool_calls || [];
    const clientToolCalls = [];
    const serverToolResults = [];

    for (const tc of toolCalls) {
      const toolName = tc.name;
      const args =
        typeof tc.arguments === 'string'
          ? JSON.parse(tc.arguments)
          : tc.arguments || {};

      const serverResult = await executeServerTool(env, toolName, args, userId);
      if (serverResult !== null) {
        serverToolResults.push({ name: toolName, result: serverResult });
      } else {
        clientToolCalls.push({ name: toolName, arguments: args });
      }
    }

    if (serverToolResults.length > 0) {
      const toolSummary = serverToolResults
        .map((tr) => `[Tool ${tr.name}]: ${tr.result}`)
        .join('\n');

      try {
        const secondResult = await env.AI.run(CHAT_MODEL, {
          messages: [
            ...messages,
            {
              role: 'assistant',
              content: `Tools ausgeführt: ${serverToolResults.map((r) => r.name).join(', ')}`,
            },
            {
              role: 'user',
              content: `Ergebnisse:\n${toolSummary}\n\nAntworte dem Nutzer.`,
            },
          ],
          temperature: 0.7,
          max_tokens: MAX_TOKENS,
        });

        if (secondResult?.response) {
          return Response.json(
            {
              text: secondResult.response,
              toolCalls: clientToolCalls,
              model: CHAT_MODEL,
              hasMemory: !!ctx.memoryContext,
              hasImage: !!ctx.imageAnalysis,
              toolResults: serverToolResults.map((r) => r.name),
            },
            { headers: corsHeaders },
          );
        }
      } catch (err) {
        console.warn('Follow-up failed:', err?.message);
      }
    }

    return Response.json(
      {
        text:
          aiResult.response ||
          (clientToolCalls.length
            ? 'Aktion wird ausgeführt...'
            : 'Keine Antwort erhalten.'),
        toolCalls: clientToolCalls,
        model: CHAT_MODEL,
        hasMemory: !!ctx.memoryContext,
        hasImage: !!ctx.imageAnalysis,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('Non-streaming error:', error?.message || error);
    return Response.json(
      {
        error: 'AI Agent request failed',
        text: 'Verbindung zum KI-Dienst fehlgeschlagen.',
        toolCalls: [],
        retryable: true,
      },
      { status: 503, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
