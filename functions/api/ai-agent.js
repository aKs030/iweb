/**
 * Cloudflare Pages Function – POST /api/ai-agent
 * Agentic AI: SSE streaming, tool-calling, image analysis, memory, RAG.
 * @version 5.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  extractPromptMemoryFacts,
  inferClientToolCallsFromPrompt,
  promptNeedsMemoryRecall,
  promptNeedsTools,
  sanitizeAssistantText,
} from './_ai-agent-intent.js';
import {
  buildAgentMessagePayload,
  hasMeaningfulAgentText,
  sseEvent,
  streamToSSE,
} from './_ai-agent-sse.js';
import { jsonResponse } from './_response.js';
import { createLogger } from '../../content/core/logger.js';
import {
  CACHE_CONTROL_NO_STORE,
  mergeHeaders,
} from '../_shared/http-headers.js';

// debug logger (level controlled by environment / query params)
const log = createLogger('ai-agent');

const DEFAULT_CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DEFAULT_EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const DEFAULT_IMAGE_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
const DEFAULT_MAX_MEMORY_RESULTS = 5;
const DEFAULT_MEMORY_SCORE_THRESHOLD = 0.65;
const DEFAULT_MAX_HISTORY_TURNS = 10;
const DEFAULT_MAX_TOKENS = 2048;
const FALLBACK_MEMORY_PREFIX = 'robot-memory:';
const FALLBACK_MEMORY_LIMIT = 60;
const USER_ID_HEADER = 'X-Jules-User-Id';

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

function normalizeUserId(raw) {
  const value = String(raw || '').trim();
  if (!value || value === 'anonymous') return '';
  if (!/^[A-Za-z0-9_-]{3,120}$/.test(value)) return '';
  return value;
}

function createUserId(prefix = 'anon') {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }

  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const randomPart = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  )
    .join('')
    .slice(0, 24);
  return `${prefix}_${randomPart}`;
}

function resolveUserIdentity(request, requestedUserId = '') {
  // Name-only Identität: kein Bearer/JWT-Mapping im Request-Path.
  let nameId = normalizeUserId(requestedUserId);
  if (!nameId) {
    try {
      const url = new URL(request.url);
      nameId = normalizeUserId(url.searchParams.get('name') || '');
    } catch {
      nameId = '';
    }
  }
  if (nameId) {
    // if the value already includes a prefix we respect it; otherwise
    // treat it as a bare name and prefix with "name_".
    const hasPrefix = /^(?:name_|jwt_|u_|anon_)/.test(nameId);
    return {
      userId: hasPrefix ? nameId : `name_${nameId}`,
    };
  }

  // Kein Name angegeben: ephemere Session-ID (nicht persistent).
  return { userId: createUserId('anon') };
}

function appendExposeHeader(headers, name) {
  if (!name) return;
  const current = headers.get('Access-Control-Expose-Headers') || '';
  const values = current
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!values.includes(name)) {
    values.push(name);
    headers.set('Access-Control-Expose-Headers', values.join(', '));
  }
}

function withUserIdentityHeader(headers, userId) {
  const out = new Headers(headers);
  if (userId) {
    out.set(USER_ID_HEADER, userId);
    appendExposeHeader(out, USER_ID_HEADER);
  }
  return out;
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
    name: 'openSearch',
    description: 'Öffne die Website-Suche.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'closeSearch',
    description: 'Schließe die Website-Suche.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'focusSearch',
    description:
      'Fokussiere die Suche. Optional kann ein Suchbegriff gesetzt werden.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
    },
  },
  {
    name: 'scrollTop',
    description: 'Scrolle zum Seitenanfang.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'copyCurrentUrl',
    description: 'Kopiere den aktuellen Seitenlink.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'openImageUpload',
    description: 'Öffne den Bild-Upload im Chat.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'clearChatHistory',
    description:
      'Lösche den lokalen Chatverlauf (nur auf Nutzerwunsch verwenden).',
    parameters: {
      type: 'object',
      properties: {},
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
   - "Suche nach React" → searchBlog oder focusSearch
   - "Öffne das Menü" / "Schließe das Menü" → toggleMenu
   - "Scroll nach oben" → scrollTop
   - "Kopiere den Link" → copyCurrentUrl
   - "Öffne Bild-Upload" → openImageUpload
   - "Lösch den Chatverlauf" → clearChatHistory
4. Wenn du dir bei einer Aktion unsicher bist: Stelle eine kurze Rückfrage statt ein falsches Tool aufzurufen.
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

function getFallbackMemoryKV(env) {
  if (env.JULES_MEMORY_KV) return env.JULES_MEMORY_KV;
  if (env.RATE_LIMIT_KV) return env.RATE_LIMIT_KV;
  if (env.SITEMAP_CACHE_KV) return env.SITEMAP_CACHE_KV;
  return null;
}

function getFallbackMemoryKey(userId) {
  return `${FALLBACK_MEMORY_PREFIX}${String(userId || 'anonymous')}`;
}

function normalizeMemoryText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadFallbackMemories(env, userId) {
  const kv = getFallbackMemoryKV(env);
  if (!kv?.get) return [];

  try {
    const raw = await kv.get(getFallbackMemoryKey(userId));
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        key: String(entry?.key || 'note'),
        value: normalizeMemoryText(entry?.value || ''),
        timestamp:
          typeof entry?.timestamp === 'number' ? entry.timestamp : Date.now(),
      }))
      .filter((entry) => entry.value.length > 0)
      .slice(-FALLBACK_MEMORY_LIMIT);
  } catch {
    return [];
  }
}

async function saveFallbackMemory(env, userId, key, value) {
  const kv = getFallbackMemoryKV(env);
  if (!kv?.get || !kv?.put) return false;

  const cleanedKey = String(key || 'note');
  const cleanedValue = normalizeMemoryText(value);
  if (!cleanedValue) return false;

  try {
    const existing = await loadFallbackMemories(env, userId);
    const now = Date.now();
    const duplicateIndex = existing.findIndex(
      (item) =>
        item.key === cleanedKey &&
        item.value.toLowerCase() === cleanedValue.toLowerCase(),
    );

    if (duplicateIndex >= 0) {
      existing[duplicateIndex] = {
        ...existing[duplicateIndex],
        timestamp: now,
      };
    } else {
      existing.push({
        key: cleanedKey,
        value: cleanedValue,
        timestamp: now,
      });
    }

    await kv.put(
      getFallbackMemoryKey(userId),
      JSON.stringify(existing.slice(-FALLBACK_MEMORY_LIMIT)),
    );
    return true;
  } catch {
    return false;
  }
}

function scoreFallbackMemoryEntry(entry, query) {
  const haystack = `${entry.key} ${entry.value}`.toLowerCase();
  const normalizedQuery = normalizeMemoryText(query).toLowerCase();
  if (!normalizedQuery) return 0.5;

  if (haystack.includes(normalizedQuery)) return 1;

  const terms = normalizedQuery.split(/\s+/).filter((term) => term.length >= 2);
  if (terms.length === 0) return 0.4;

  let hits = 0;
  for (const term of terms) {
    if (haystack.includes(term)) hits += 1;
  }
  return hits / terms.length;
}

async function recallMemoriesFromFallback(
  env,
  userId,
  query,
  { topK = DEFAULT_MAX_MEMORY_RESULTS, scoreThreshold = 0 } = {},
) {
  const entries = await loadFallbackMemories(env, userId);
  if (!entries.length) return [];

  return entries
    .map((entry) => ({
      ...entry,
      score: scoreFallbackMemoryEntry(entry, query),
    }))
    .filter((entry) => entry.score >= scoreThreshold)
    .sort((a, b) =>
      b.score === a.score ? b.timestamp - a.timestamp : b.score - a.score,
    )
    .slice(0, topK);
}

async function storeMemory(env, userId, key, value, config) {
  log.debug('storeMemory called', { userId, key, value });
  const kvStored = await saveFallbackMemory(env, userId, key, value);
  if (!env.AI || !env.JULES_MEMORY) {
    return kvStored
      ? { success: true, id: `kv_${Date.now()}`, storage: 'kv' }
      : { success: false };
  }

  try {
    const text = `${key}: ${value}`;
    const { data } = await env.AI.run(config.embeddingModel, { text: [text] });
    if (!data?.[0]) {
      return kvStored
        ? { success: true, id: `kv_${Date.now()}`, storage: 'kv' }
        : { success: false, error: 'Embedding failed' };
    }

    const id = `${userId}_${key}_${Date.now()}`;
    await env.JULES_MEMORY.upsert([
      {
        id,
        values: data[0],
        metadata: { userId, key, value, timestamp: Date.now(), text },
      },
    ]);
    return {
      success: true,
      id,
      storage: kvStored ? 'vectorize+kv' : 'vectorize',
    };
  } catch (error) {
    if (error?.remote) {
      return kvStored
        ? { success: true, id: `kv_${Date.now()}`, storage: 'kv' }
        : { success: false, error: 'Vectorize not available locally' };
    }
    log.error('storeMemory error:', error?.message || error);
    return kvStored
      ? { success: true, id: `kv_${Date.now()}`, storage: 'kv' }
      : { success: false, error: error.message };
  }
}

async function recallMemories(env, userId, query, config, options = {}) {
  log.debug('recallMemories', { userId, query, options });
  const topK = Number.isFinite(options.topK)
    ? Math.max(1, Math.floor(options.topK))
    : config.maxMemoryResults;
  const scoreThreshold =
    typeof options.scoreThreshold === 'number'
      ? options.scoreThreshold
      : config.memoryScoreThreshold;

  if (!env.AI || !env.JULES_MEMORY) {
    return recallMemoriesFromFallback(env, userId, query, {
      topK,
      scoreThreshold,
    });
  }

  try {
    const { data } = await env.AI.run(config.embeddingModel, { text: [query] });
    if (!data?.[0]) {
      return recallMemoriesFromFallback(env, userId, query, {
        topK,
        scoreThreshold,
      });
    }

    const results = await env.JULES_MEMORY.query(data[0], {
      topK,
      filter: { userId },
      returnMetadata: 'all',
    });

    const vectorMemories = (results?.matches || [])
      .filter((m) => m.score >= scoreThreshold)
      .map((m) => ({
        key: m.metadata?.key || 'unknown',
        value: m.metadata?.value || '',
        score: m.score,
        timestamp: m.metadata?.timestamp || 0,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    if (vectorMemories.length > 0) return vectorMemories;

    return recallMemoriesFromFallback(env, userId, query, {
      topK,
      scoreThreshold,
    });
  } catch (error) {
    if (!error?.remote)
      log.warn('recallMemories error:', error?.message || error);
    return recallMemoriesFromFallback(env, userId, query, {
      topK,
      scoreThreshold,
    });
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
    log.error('LLaVA error:', error);
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

function parseToolArguments(rawArguments, toolName) {
  if (!rawArguments) return {};
  if (typeof rawArguments === 'object' && !Array.isArray(rawArguments)) {
    return rawArguments;
  }
  if (typeof rawArguments !== 'string') return {};

  const trimmed = rawArguments.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    log.warn(
      `Failed to parse tool arguments for "${toolName || 'unknown'}":`,
      error?.message || error,
    );
    return {};
  }
}

async function classifyToolCalls(env, toolCalls, userId, config) {
  const clientToolCalls = [];
  const serverToolResults = [];
  for (const tc of toolCalls) {
    const args = parseToolArguments(tc?.arguments, tc?.name);
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

async function persistPromptMemories(env, userId, prompt, config) {
  const facts = extractPromptMemoryFacts(prompt);
  if (!facts.length) return [];

  const results = await Promise.allSettled(
    facts.map((fact) => storeMemory(env, userId, fact.key, fact.value, config)),
  );

  return facts
    .map((fact, index) => ({ fact, result: results[index] }))
    .filter(
      (entry) =>
        entry.result.status === 'fulfilled' && entry.result.value?.success,
    )
    .map((entry) => ({
      key: entry.fact.key,
      value: entry.fact.value,
      score: 1,
      timestamp: Date.now(),
    }));
}

async function resolveMemoryContext(env, userId, prompt, config) {
  const nameMem = await recallMemories(env, userId, 'name', config);
  if (nameMem.length > 0) return nameMem;

  const primary = await recallMemories(env, userId, prompt || 'user', config);
  if (primary.length > 0) return primary;

  if (!promptNeedsMemoryRecall(prompt)) return [];

  const recallQueries = [
    'name',
    'interests',
    'preferences',
    'notes about this user',
  ];

  for (const query of recallQueries) {
    const fallback = await recallMemories(env, userId, query, config, {
      topK: Math.max(12, config.maxMemoryResults),
      scoreThreshold: 0,
    });
    if (fallback.length > 0) return fallback;
  }

  return [];
}

function mergeMemoryEntries(recalled = [], stored = []) {
  const merged = [...recalled];
  const seen = new Set(
    merged.map((entry) => `${entry.key}:${String(entry.value).toLowerCase()}`),
  );

  for (const item of stored) {
    const hash = `${item.key}:${String(item.value).toLowerCase()}`;
    if (seen.has(hash)) continue;
    seen.add(hash);
    merged.push(item);
  }

  return merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

// ─── Main Handler ───────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;
  const config = getAgentConfig(env);
  const corsHeaders = getCorsHeaders(request, env);

  const sseHeaders = mergeHeaders(corsHeaders, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });

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
      userId: requestedUserId = 'anonymous',
      conversationHistory = [],
      stream = true,
    } = body;
    imageAnalysis = body.imageAnalysis || imageAnalysis;

    const identity = resolveUserIdentity(request, requestedUserId);
    const userId = identity.userId;
    log.debug('request', { userId, prompt, requestedUserId });
    // if identity is a simple name and we haven't explicitly stored it before,
    // save it now so even passive visits (query string only) are remembered.
    if (userId && userId.startsWith('name_')) {
      const nameVal = userId.slice(5);
      // fire-and-forget, ignore errors
      storeMemory(env, userId, 'name', nameVal, config).catch(() => {});
    }
    const jsonHeaders = withUserIdentityHeader(
      mergeHeaders(corsHeaders, {
        'Cache-Control': CACHE_CONTROL_NO_STORE,
      }),
      userId,
    );
    const sseResponseHeaders = withUserIdentityHeader(sseHeaders, userId);

    if (!prompt && !imageAnalysis) {
      return jsonResponse(
        { error: 'Empty prompt', text: 'Kein Prompt empfangen.' },
        { status: 400, headers: jsonHeaders },
      );
    }

    if (!env.AI) {
      return jsonResponse(
        {
          error: 'AI service not configured',
          text: 'KI-Dienst nicht verfügbar.',
          toolCalls: [],
          retryable: false,
        },
        { status: 500, headers: jsonHeaders },
      );
    }

    // ── Parallel: memory + RAG + deterministic memory persistence ──
    const [memResult, ragResult, storedPromptMemoriesResult] =
      await Promise.allSettled([
        resolveMemoryContext(env, userId, prompt, config),
        getRAGContext(prompt, env),
        persistPromptMemories(env, userId, prompt, config),
      ]);

    const recalledMemories =
      memResult.status === 'fulfilled' ? memResult.value : [];
    const storedPromptMemories =
      storedPromptMemoriesResult.status === 'fulfilled'
        ? storedPromptMemoriesResult.value
        : [];
    const mergedMemories = mergeMemoryEntries(
      recalledMemories,
      storedPromptMemories,
    );

    const memoryContext =
      mergedMemories.length > 0
        ? mergedMemories
            .slice(0, Math.max(config.maxMemoryResults, 8))
            .map((m) => `- ${m.key}: ${m.value}`)
            .join('\n')
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
        jsonHeaders,
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

          let toolCalls = Array.isArray(aiResult?.tool_calls)
            ? aiResult.tool_calls
            : [];
          const responseText = sanitizeAssistantText(aiResult?.response || '');

          if (useTools && toolCalls.length === 0) {
            toolCalls = inferClientToolCallsFromPrompt(prompt);
          }

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
            await write(
              'message',
              buildAgentMessagePayload(
                responseText,
                [],
                [],
                { memoryContext, imageAnalysis },
                config,
              ),
            );
          } else {
            await write(
              'message',
              buildAgentMessagePayload(
                'Keine Antwort erhalten.',
                [],
                [],
                { memoryContext, imageAnalysis },
                config,
              ),
            );
          }
        } catch (error) {
          log.error('SSE pipeline error:', error?.message || error);
          const fallbackToolCalls = inferClientToolCallsFromPrompt(prompt);
          for (const toolCall of fallbackToolCalls) {
            await write('tool', {
              name: toolCall.name,
              arguments: toolCall.arguments,
              status: 'client',
              isServerTool: false,
              degraded: true,
            });
          }

          await write('message', {
            ...buildAgentMessagePayload(
              fallbackToolCalls.length > 0
                ? 'Der KI-Dienst ist gerade nicht erreichbar. Ich habe die angefragte Aktion trotzdem lokal ausgefuehrt.'
                : 'Der KI-Dienst ist gerade nicht erreichbar. Bitte versuche es in ein paar Sekunden erneut.',
              fallbackToolCalls,
              [],
              { memoryContext, imageAnalysis },
              config,
            ),
            degraded: true,
            retryable: true,
          });
        } finally {
          await write('done', { ts: Date.now() });
          await writer.close();
        }
      })(),
    );

    return new Response(readable, { headers: sseResponseHeaders });
  } catch (error) {
    log.error('AI Agent error:', error?.message || error);
    return jsonResponse(
      {
        error: 'AI Agent request failed',
        text: 'KI-Dienst fehlgeschlagen. Bitte erneut versuchen.',
        toolCalls: [],
        retryable: true,
      },
      {
        status: 503,
        headers: mergeHeaders(corsHeaders, {
          'Cache-Control': CACHE_CONTROL_NO_STORE,
        }),
      },
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
    const followUpMessages = [
      ...messages,
      {
        role: 'assistant',
        content: `Tools: ${serverToolResults.map((r) => r.name).join(', ')}`,
      },
      {
        role: 'user',
        content: `Ergebnisse:\n${summary}\n\nAntworte dem Nutzer.`,
      },
    ];
    try {
      const result = await env.AI.run(config.chatModel, {
        messages: followUpMessages,
        temperature: 0.7,
        max_tokens: config.maxTokens,
        stream: true,
      });
      const text = sanitizeAssistantText(await streamToSSE(result, write));
      if (hasMeaningfulAgentText(text)) {
        await write(
          'message',
          buildAgentMessagePayload(
            text,
            clientToolCalls,
            serverToolResults,
            ctx,
            config,
          ),
        );
        return;
      }

      // Local dev fallback: if stream parsing produced only fragments, force full non-stream answer.
      const fallback = await env.AI.run(config.chatModel, {
        messages: followUpMessages,
        temperature: 0.7,
        max_tokens: config.maxTokens,
      });
      const fallbackText = sanitizeAssistantText(fallback?.response || '');
      if (hasMeaningfulAgentText(fallbackText)) {
        await write('message', {
          ...buildAgentMessagePayload(
            fallbackText,
            clientToolCalls,
            serverToolResults,
            ctx,
            config,
          ),
          forcedFromNonStreamFallback: true,
        });
        return;
      }
    } catch (err) {
      log.warn('Follow-up failed:', err?.message);
    }
  }

  // Follow-up for client-only tools without text
  if (
    clientToolCalls.length > 0 &&
    !hasMeaningfulAgentText(existingText) &&
    messages.length > 0
  ) {
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
      const followUpText = sanitizeAssistantText(r?.response || '');
      if (followUpText) {
        for (const w of followUpText.match(/\S+\s*/g) || [followUpText])
          await write('token', { text: w });
        await write(
          'message',
          buildAgentMessagePayload(
            followUpText,
            clientToolCalls,
            serverToolResults,
            ctx,
            config,
          ),
        );
        return;
      }
    } catch (err) {
      log.warn('Follow-up for client tools failed:', err?.message);
    }
  }

  // Fallback
  await write(
    'message',
    buildAgentMessagePayload(
      hasMeaningfulAgentText(existingText)
        ? existingText
        : clientToolCalls.length > 0
          ? 'Aktion wird ausgeführt…'
          : serverToolResults.length > 0
            ? 'Ich habe deine Infos geprüft. Frag mich gern noch einmal.'
            : 'Keine Antwort erhalten.',
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

    let toolCalls = Array.isArray(aiResult.tool_calls)
      ? aiResult.tool_calls
      : [];
    if (useTools && toolCalls.length === 0) {
      toolCalls = inferClientToolCallsFromPrompt(
        messages[messages.length - 1]?.content || '',
      );
    }

    const { clientToolCalls, serverToolResults } = await classifyToolCalls(
      env,
      toolCalls,
      userId,
      config,
    );

    // Follow-up for server tools
    let responseText = sanitizeAssistantText(aiResult.response || '');
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
        const followUpText = sanitizeAssistantText(followUp?.response || '');
        if (followUpText) responseText = followUpText;
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
        const followUpText = sanitizeAssistantText(r?.response || '');
        if (followUpText) responseText = followUpText;
      } catch {
        /* ignore */
      }
    }

    return jsonResponse(
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
    log.error('Non-streaming error:', error?.message || error);
    const prompt = String(messages[messages.length - 1]?.content || '');
    const fallbackToolCalls = inferClientToolCallsFromPrompt(prompt);
    return jsonResponse(
      {
        text:
          fallbackToolCalls.length > 0
            ? 'Der KI-Dienst ist gerade nicht erreichbar. Ich habe die angefragte Aktion trotzdem lokal ausgefuehrt.'
            : 'Der KI-Dienst ist gerade nicht erreichbar. Bitte versuche es in ein paar Sekunden erneut.',
        toolCalls: fallbackToolCalls,
        model: config.chatModel,
        hasMemory: !!ctx.memoryContext,
        hasImage: !!ctx.imageAnalysis,
        retryable: true,
        degraded: true,
      },
      { headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
