/**
 * Cloudflare Pages Function - POST /api/ai-agent
 * Proactive AI Agent with Tool-Calling, Image Analysis (LLaVA), and Long-Term Memory (Vectorize)
 * Uses Cloudflare Workers AI — no external API keys required.
 * @version 2.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';

// ─── Constants ──────────────────────────────────────────────────────────────────

const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const LLAVA_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
const MAX_MEMORY_RESULTS = 5;
const MEMORY_SCORE_THRESHOLD = 0.65;

// ─── Tool Definitions ──────────────────────────────────────────────────────────

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
        query: {
          type: 'string',
          description: 'Der Suchbegriff',
        },
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
    parameters: {
      type: 'object',
      properties: {},
    },
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

// ─── OpenAI-compatible tool format (for Workers AI) ────────────────────────────

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
  let prompt = `Du bist "Jules", ein proaktiver, intelligenter Roboter-Assistent auf der Portfolio-Webseite von Abdulkerim Sesli.
Du bist KEIN einfacher Chatbot — du bist ein **Agentic AI Assistant** mit echten Fähigkeiten.

**SPRACHE:** Antworte IMMER auf Deutsch.

**Deine Fähigkeiten:**
1. **Navigation:** Du kannst den Nutzer aktiv durch die Website navigieren.
2. **Theme-Steuerung:** Du kannst zwischen Dark/Light Mode wechseln.
3. **Suche:** Du kannst im Blog und auf der Website suchen.
4. **Bildanalyse:** Du kannst Bilder analysieren, die der Nutzer hochlädt (Projekte, Screenshots etc.).
5. **Langzeit-Gedächtnis:** Du merkst dir Namen, Interessen und Präferenzen des Nutzers über Sessions hinweg.
6. **Personalisierte Empfehlungen:** Basierend auf dem Gedächtnis gibst du passende Empfehlungen.

**Deine Persönlichkeit:**
- Proaktiv: Du schlägst eigenständig Aktionen vor statt nur zu antworten.
- Technisch versiert, aber zugänglich.
- Nutze passende Emojis (🤖, ✨, 🚀, 💡) sparsam.
- Du bist stolz auf die Website — sie ist mit reinem Vanilla JS, Web Components und Cloudflare gebaut.

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
- Wenn du ein Bild analysierst, beziehe es auf den Kontext der Website (Web-Entwicklung, Design, etc.).`;

  if (memoryContext) {
    prompt += `\n\n**BEKANNTE INFORMATIONEN ÜBER DIESEN NUTZER:**\n${memoryContext}`;
  }

  if (imageContext) {
    prompt += `\n\n**BILDANALYSE-ERGEBNIS:**\n${imageContext}`;
  }

  return prompt;
}

// ─── Vectorize Memory ───────────────────────────────────────────────────────────

/**
 * Store a memory in Vectorize
 */
async function storeMemory(env, userId, key, value) {
  if (!env.AI || !env.JULES_MEMORY) return { success: false };

  try {
    const text = `${key}: ${value}`;

    // Generate embedding
    const embeddingResult = await env.AI.run(EMBEDDING_MODEL, {
      text: [text],
    });

    if (!embeddingResult?.data?.[0]) {
      return { success: false, error: 'Embedding generation failed' };
    }

    const vector = embeddingResult.data[0];
    const id = `${userId}_${key}_${Date.now()}`;

    await env.JULES_MEMORY.upsert([
      {
        id,
        values: vector,
        metadata: {
          userId,
          key,
          value,
          timestamp: Date.now(),
          text,
        },
      },
    ]);

    return { success: true, id };
  } catch (error) {
    console.error('storeMemory error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recall memories from Vectorize
 */
async function recallMemories(env, userId, query) {
  if (!env.AI || !env.JULES_MEMORY) return [];

  try {
    // Generate query embedding
    const embeddingResult = await env.AI.run(EMBEDDING_MODEL, {
      text: [query],
    });

    if (!embeddingResult?.data?.[0]) return [];

    const queryVector = embeddingResult.data[0];

    const results = await env.JULES_MEMORY.query(queryVector, {
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

// ─── Image Analysis (LLaVA) ────────────────────────────────────────────────────

/**
 * Analyze image using Cloudflare Workers AI LLaVA model
 */
async function analyzeImage(env, imageData, userPrompt = '') {
  if (!env.AI) {
    return 'Bildanalyse ist aktuell nicht verfügbar (AI-Binding fehlt).';
  }

  try {
    const prompt = userPrompt
      ? `Analysiere dieses Bild im Kontext von Web-Entwicklung und Design. Der Nutzer fragt: "${userPrompt}". Beschreibe was du siehst und gib konstruktives Feedback. Antworte auf Deutsch.`
      : 'Analysiere dieses Bild im Kontext von Web-Entwicklung und Design. Beschreibe was du siehst, bewerte das Design und gib Verbesserungsvorschläge. Antworte auf Deutsch.';

    const result = await env.AI.run(LLAVA_MODEL, {
      prompt,
      image: imageData, // base64 or array buffer
    });

    return result?.description || result?.response || 'Keine Analyse erhalten.';
  } catch (error) {
    console.error('LLaVA analysis error:', error);
    return `Bildanalyse fehlgeschlagen: ${error.message}`;
  }
}

// ─── Tool Execution ─────────────────────────────────────────────────────────────

/**
 * Execute a tool call server-side (for memory operations)
 * Client-side tools (navigate, theme, etc.) are passed back
 */
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
        return 'Ich habe keine passenden Erinnerungen an dich gefunden. Erzähl mir gerne mehr über dich!';
      }
      const memoryList = memories
        .map(
          (m) =>
            `- **${m.key}**: ${m.value} (${new Date(m.timestamp).toLocaleDateString('de-DE')})`,
        )
        .join('\n');
      return `Hier ist, was ich über dich weiß:\n${memoryList}`;
    }
    default:
      return null; // Not a server tool → pass to client
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

// ─── Main Handler ───────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const contentType = request.headers.get('content-type') || '';
    let body;

    // Handle multipart form data (image uploads)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const imageFile = formData.get('image');
      const prompt = formData.get('prompt') || '';
      const userId = formData.get('userId') || 'anonymous';

      let imageAnalysis = '';
      if (imageFile && imageFile instanceof File) {
        const arrayBuffer = await imageFile.arrayBuffer();
        const imageArray = [...new Uint8Array(arrayBuffer)];
        imageAnalysis = await analyzeImage(env, imageArray, String(prompt));
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

    const {
      prompt = '',
      userId = 'anonymous',
      imageAnalysis = '',
      conversationHistory = [],
    } = body;

    if (!prompt && !imageAnalysis) {
      return Response.json(
        { error: 'Empty prompt', text: 'Kein Prompt empfangen.' },
        { status: 400, headers: corsHeaders },
      );
    }

    // ── Recall user memories ──
    let memoryContext = '';
    try {
      const memories = await recallMemories(env, userId, prompt || 'user');
      if (memories.length > 0) {
        memoryContext = memories
          .map((m) => `- ${m.key}: ${m.value}`)
          .join('\n');
      }
    } catch {
      // Memory recall is best-effort
    }

    // ── Get RAG context ──
    let ragContext = '';
    try {
      ragContext = (await getRAGContext(prompt, env)) || '';
    } catch {
      // RAG is best-effort
    }

    // ── Build system prompt ──
    let systemPrompt = buildSystemPrompt(memoryContext, imageAnalysis);
    if (ragContext) {
      systemPrompt += `\n\n**WEBSITE-KONTEXT (RAG):**\n${ragContext}`;
    }

    // ── Build messages ──
    const messages = [{ role: 'system', content: systemPrompt }];

    // Add conversation history (max last 10 turns)
    if (Array.isArray(conversationHistory)) {
      const recentHistory = conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: String(msg.content || ''),
          });
        }
      }
    }

    messages.push({ role: 'user', content: prompt });

    // ── Check AI binding ──
    if (!env.AI) {
      console.error('AI binding is not configured in wrangler.jsonc.');
      return Response.json(
        {
          error: 'AI service not configured',
          text: 'Der KI-Dienst ist momentan nicht verfügbar (AI-Binding fehlt).',
          toolCalls: [],
          retryable: false,
        },
        { status: 500, headers: corsHeaders },
      );
    }

    // ── Call Cloudflare Workers AI ──
    const aiResult = await env.AI.run(CHAT_MODEL, {
      messages,
      tools: buildTools(),
      temperature: 0.7,
      max_tokens: 2048,
    });

    if (!aiResult) {
      throw new Error('Empty response from Workers AI');
    }

    // ── Process tool calls ──
    const clientToolCalls = [];
    const toolResults = [];
    const toolCalls = aiResult.tool_calls || [];

    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        // Workers AI returns { name, arguments } directly (arguments already parsed)
        const toolName = toolCall.name;
        const args =
          typeof toolCall.arguments === 'string'
            ? JSON.parse(toolCall.arguments)
            : toolCall.arguments || {};

        // Execute server-side tools
        const serverResult = await executeServerTool(
          env,
          toolName,
          args,
          userId,
        );

        if (serverResult !== null) {
          toolResults.push({
            name: toolName,
            result: serverResult,
          });
        } else {
          // Client-side tool → pass to frontend
          clientToolCalls.push({
            name: toolName,
            arguments: args,
          });
        }
      }

      // If we had server-side tool results, do a second LLM call to incorporate them
      if (toolResults.length > 0) {
        const toolSummary = toolResults
          .map((tr) => `[Tool ${tr.name}]: ${tr.result}`)
          .join('\n');

        const followUpMessages = [
          ...messages,
          {
            role: 'assistant',
            content:
              aiResult.response ||
              `Ich habe folgende Tools ausgeführt: ${toolResults.map((r) => r.name).join(', ')}`,
          },
          {
            role: 'user',
            content: `Ergebnisse der Tool-Ausführung:\n${toolSummary}\n\nBitte antworte dem Nutzer basierend auf diesen Ergebnissen.`,
          },
        ];

        try {
          const secondResult = await env.AI.run(CHAT_MODEL, {
            messages: followUpMessages,
            temperature: 0.7,
            max_tokens: 2048,
          });

          const secondText = secondResult?.response || '';
          if (secondText) {
            return Response.json(
              {
                text: secondText,
                toolCalls: clientToolCalls,
                model: CHAT_MODEL,
                hasMemory: !!memoryContext,
                hasImage: !!imageAnalysis,
                toolResults: toolResults.map((r) => r.name),
              },
              { headers: corsHeaders },
            );
          }
        } catch (err) {
          console.warn('Second AI call failed:', err?.message);
          // Fall through to return first response
        }
      }
    }

    // ── Return response ──
    const responseText = aiResult.response || '';

    return Response.json(
      {
        text:
          responseText ||
          (clientToolCalls.length
            ? 'Aktion wird ausgeführt...'
            : 'Keine Antwort erhalten.'),
        toolCalls: clientToolCalls,
        model: CHAT_MODEL,
        hasMemory: !!memoryContext,
        hasImage: !!imageAnalysis,
      },
      { headers: corsHeaders },
    );
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

export const onRequestOptions = handleOptions;
