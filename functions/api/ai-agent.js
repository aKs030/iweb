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
const FALLBACK_MEMORY_PREFIX = 'robot-memory:';
const FALLBACK_MEMORY_LIMIT = 60;
const USER_ID_COOKIE = 'jules_uid';

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

function readCookieValue(cookieHeader, key) {
  const header = String(cookieHeader || '');
  if (!header) return '';
  const needle = `${key}=`;
  const parts = header.split(';');
  for (const part of parts) {
    const token = part.trim();
    if (!token.startsWith(needle)) continue;
    try {
      return decodeURIComponent(token.slice(needle.length));
    } catch {
      return token.slice(needle.length);
    }
  }
  return '';
}

function createUserId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `u_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }
  const array = new Uint32Array(2);
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    crypto.getRandomValues(array);
    return `u_${Date.now().toString(36)}_${array[0].toString(36)}${array[1].toString(36)}`;
  }
  // Fallback for extremely old environments without crypto (unlikely in CF Workers)
  return `u_${Date.now().toString(36)}_${Date.now().toString(36).slice(2, 10)}`;
}

function extractNameFromPrompt(promptText) {
  const text = String(promptText || '');
  if (!text.trim()) return '';

  const patterns = [
    /(?:\bich\s+hei(?:ss|ß)e\b|\bmein\s+name\s+ist\b|\bnenn\s+mich\b|\bdu\s+kannst\s+mich\b)\s+([^\n.,;:!?]{2,60})/i,
    /(?:\bich\s+bin\b|\bich\s+bin's\b|\bich\s+bins\b)\s+([^\n.,;:!?]{2,60})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const name = normalizeNameCandidate(match[1]);
    if (name && name.toLowerCase() !== 'jules') return name;
  }

  return '';
}

function normalizeExtractedValue(value, maxLength = 120) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.,;:!?]+$/g, '')
    .slice(0, maxLength);
}

const NAME_CONTEXT_STOPWORDS = new Set([
  'aus',
  'von',
  'und',
  'aber',
  'im',
  'in',
  'mit',
  'bei',
  'als',
  'ein',
  'eine',
  'einer',
  'einem',
  'eines',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'bin',
  'heisse',
  'heiße',
  'nenne',
  'nennen',
  'arbeite',
  'komme',
  'wohne',
  'mag',
  'liebe',
  'interessiere',
  'interessiert',
  'habe',
  'hab',
  'will',
  'moechte',
  'möchte',
]);

const NON_NAME_SINGLE_WORDS = new Set([
  'muede',
  'müde',
  'hungrig',
  'bereit',
  'hier',
  'da',
  'neu',
  'krank',
  'ok',
  'okay',
  'gut',
  'schlecht',
  'traurig',
  'verwirrt',
  'gespannt',
  'froh',
  'cool',
  'fertig',
]);

function isLikelyNameToken(token) {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’-]{0,29}$/.test(token);
}

function normalizeNameCandidate(candidate) {
  const cleaned = normalizeExtractedValue(candidate, 60);
  if (!cleaned) return '';

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (!tokens.length) return '';

  const selected = [];
  for (const rawToken of tokens) {
    const token = rawToken.replace(/^['’`]+|['’`]+$/g, '');
    const lower = token.toLowerCase();

    if (!token) continue;
    if (selected.length === 0 && NAME_CONTEXT_STOPWORDS.has(lower)) continue;
    if (selected.length > 0 && NAME_CONTEXT_STOPWORDS.has(lower)) break;
    if (!isLikelyNameToken(token)) break;

    selected.push(token);
    if (selected.length >= 3) break;
  }

  if (!selected.length) return '';
  if (
    selected.length === 1 &&
    NON_NAME_SINGLE_WORDS.has(selected[0].toLowerCase())
  ) {
    return '';
  }

  const name = selected.join(' ').trim();
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’ -]{1,39}$/.test(name)) {
    return '';
  }
  return name;
}

function getFallbackMemoryKV(env) {
  if (env.JULES_MEMORY_KV) return env.JULES_MEMORY_KV;
  if (env.RATE_LIMIT_KV) return env.RATE_LIMIT_KV;
  if (env.SITEMAP_CACHE_KV) return env.SITEMAP_CACHE_KV;
  return null;
}

function sanitizeNameKey(name) {
  return `username:${String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9à-öø-ÿ]/g, '')}`;
}

async function lookupUserIdByName(env, name) {
  const kv = getFallbackMemoryKV(env);
  if (!kv?.get || !name) {
    console.log('[lookupUserIdByName] Missing KV or Name', {
      hasKV: !!kv?.get,
      name,
    });
    return null;
  }
  try {
    const key = sanitizeNameKey(name);
    const result = await kv.get(key);
    console.log(`[lookupUserIdByName] Key: ${key} -> Result: ${result}`);
    return result;
  } catch (err) {
    console.error('[lookupUserIdByName] Error:', err);
    return null;
  }
}

async function linkUserByName(env, name, userId) {
  const kv = getFallbackMemoryKV(env);
  if (!kv?.put || !name || !userId) {
    console.log('[linkUserByName] Missing KV, name or userId', {
      hasKV: !!kv?.put,
      name,
      userId,
    });
    return false;
  }
  if (name.toLowerCase() === 'jules') {
    return false;
  }
  try {
    const key = sanitizeNameKey(name);
    await kv.put(key, userId);
    console.log(
      `[linkUserByName] Successfully linked Key: ${key} to UserId: ${userId}`,
    );
    return true;
  } catch (err) {
    console.error('[linkUserByName] Error:', err);
    return false;
  }
}

async function resolveUserIdentity(
  request,
  requestedUserId = '',
  prompt = '',
  env = null,
) {
  const cookieUserId = normalizeUserId(
    readCookieValue(request.headers.get('cookie'), USER_ID_COOKIE),
  );
  const headerUserId = normalizeUserId(request.headers.get('X-Jules-User-Id'));
  const bodyUserId = normalizeUserId(requestedUserId);

  let nameMatchUserId = null;
  let extractedName = null;

  if (prompt && env) {
    extractedName = extractNameFromPrompt(prompt);
    if (extractedName) {
      console.log(
        `[resolveUserIdentity] Extracted name from prompt: "${extractedName}"`,
      );
      nameMatchUserId = await lookupUserIdByName(env, extractedName);
      console.log(
        `[resolveUserIdentity] User ID for name "${extractedName}": ${nameMatchUserId}`,
      );
    }
  }

  const resolvedUserId =
    nameMatchUserId ||
    bodyUserId ||
    headerUserId ||
    cookieUserId ||
    createUserId();

  // Wenn ein Name gesagt wurde, aber wir ihn noch NICHT im KV hatten (nameMatchUserId === null),
  // verknüpfen wir die gerade ermittelte/neu generierte ID SOFORT mit dem Namen im KV.
  if (extractedName && !nameMatchUserId && env) {
    console.log(
      `[resolveUserIdentity] New name "${extractedName}" detected, linking to resolved ID: ${resolvedUserId}`,
    );
    await linkUserByName(env, extractedName, resolvedUserId);
  }

  return {
    userId: resolvedUserId,
    shouldSetCookie: false,
  };
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

function withUserCookie(headers, request, userId) {
  const out = new Headers(headers);
  if (userId) {
    out.set('X-Jules-User-Id', userId);
    appendExposeHeader(out, 'X-Jules-User-Id');
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
    name: 'getSiteAnalytics',
    description:
      'Analysiere Seiteninformationen oder Statistiken (mocked/simuliert für Analytics-Demo).',
    parameters: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          description: 'Die angeforderte Metrik (z.B. views, performance)',
        },
      },
      required: ['metric'],
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
2. AUSNAHME: Wenn der Nutzer persönliche Infos teilt (Name, Interessen, Lieblingsfarbe etc.), MUSST du technisch die Funktion "rememberUser" aufrufen — auch wenn die Info nur in einem Wort (z.B. "Grün") steht. Behaupte NIEMALS nur im Text, dass du es tust, sondern nutze exklusiv den Function Call!
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
    prompt += `\n\n**DEIN WISSEN ÜBER DEN NUTZER:**\nInhalte aus deinem Langzeit-Gedächtnis:\n${memoryContext}`;
  }
  if (imageContext) {
    prompt += `\n\n**AKTUELLE BILDANALYSE (Vom Nutzer hochgeladen):**\nDies ist das Bild, über das der Nutzer spricht:\n${imageContext}`;
  }

  prompt += `\n\nWenn du RAG-Informationen (Suchergebnisse) erhältst, verwende sie, um Fragen zur Website, zum Portfolio oder zu bestimmten Unterseiten von Abdulkerim Sesli detailliert und freundlich zu beantworten. Falls du einen relativen Link bekommst, nutze Markdown, um ihn darzustellen (z.B. [Name](/pfad)). Beende Listen oder Sätze immer ordentlich.`;

  return prompt;
}

// ─── Vectorize Memory ───────────────────────────────────────────────────────────

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
  if (key === 'name' && value && value.toLowerCase() === 'jules') {
    return {
      success: false,
      error: "Cannot use assistant's name as user name",
    };
  }
  const kvStored = await saveFallbackMemory(env, userId, key, value);
  if (key === 'name' && value) {
    await linkUserByName(env, value, userId);
  }
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
    console.error('storeMemory error:', error?.message || error);
    return kvStored
      ? { success: true, id: `kv_${Date.now()}`, storage: 'kv' }
      : { success: false, error: error.message };
  }
}

async function recallMemories(env, userId, query, config, options = {}) {
  const topK = Number.isFinite(options.topK)
    ? Math.max(1, Math.floor(options.topK))
    : config.maxMemoryResults;
  const scoreThreshold =
    typeof options.scoreThreshold === 'number'
      ? options.scoreThreshold
      : config.memoryScoreThreshold;

  // Always load KV memories — this is the complete set for the user.
  const kvMemories = await recallMemoriesFromFallback(env, userId, query, {
    topK,
    scoreThreshold,
  });

  if (!env.AI || !env.JULES_MEMORY) {
    return kvMemories;
  }

  try {
    const { data } = await env.AI.run(config.embeddingModel, { text: [query] });
    if (!data?.[0]) {
      return kvMemories;
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

    // Merge both sources — KV may have entries that Vectorize missed
    // (e.g. when embedding failed at store time).
    return mergeMemoryEntries(vectorMemories, kvMemories);
  } catch (error) {
    if (!error?.remote)
      console.warn('recallMemories error:', error?.message || error);
    return kvMemories;
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

  if (toolName === 'getSiteAnalytics') {
    const metric = String(args.metric || '').toLowerCase();
    if (metric.includes('perf')) {
      return 'Performance Score: 100/100 (Core Web Vitals optimiert, Zero-Build Architektur, Cloudflare Edge Caching).';
    }
    return `Website Status: Online. Portfolio-Aufrufe steigen kontinuierlich an. Cloudflare Pages Functions sind aktiv.`;
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
    console.warn(
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
      max_num_results: 4,
      stream: false,
    });

    if (!searchData?.data?.length) return null;

    return searchData.data
      .slice(0, 4)
      .map((item) => {
        const url = item.filename || item.url || '';
        const title = item.title || 'Seite';
        const content = Array.isArray(item.content)
          ? item.content.map((c) => c.text || '').join(' ')
          : item.text || item.description || '';
        const safeUrl = url.startsWith('/') ? url : `/${url}`;
        return `Titel: ${title}\nURL: ${safeUrl}\nInhalt: ${content.replace(/\s+/g, ' ').trim().slice(0, 500)}`;
      })
      .filter(Boolean)
      .join('\n\n---\n\n');
  } catch (error) {
    console.warn('RAG Context Error:', error?.message);
    return null;
  }
}

// ─── SSE Helper ─────────────────────────────────────────────────────────────────

const sseEvent = (event, data) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// ─── Action Intent Detection ────────────────────────────────────────────────────

/** Detect if user prompt asks for an action that requires tools. */
function promptNeedsTools(_prompt) {
  // We now always return true so the AI agent has access to `rememberUser`
  // even if the user answers with a single word like "Grün" or "Hunde".
  return true;
}

const TOOL_LEAK_INLINE_PATTERN =
  /\s+tools?\s*:\s*(?:navigate|setTheme|searchBlog|toggleMenu|scrollToSection|openSearch|closeSearch|focusSearch|scrollTop|copyCurrentUrl|openImageUpload|clearChatHistory|rememberUser|recallMemory|recommend)\b[^\n]*/gi;
const TOOL_LEAK_LINE_PATTERN = /(?:^|\n)\s*tools?\s*:[^\n]*(?=\n|$)/gi;

function sanitizeAssistantText(rawText) {
  const input = String(rawText || '');
  if (!input) return '';

  return input
    .replace(TOOL_LEAK_INLINE_PATTERN, '')
    .replace(TOOL_LEAK_LINE_PATTERN, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractPromptMemoryFacts(prompt) {
  const text = String(prompt || '');
  if (!text.trim()) return [];

  const extracted = [];

  const extractedName = extractNameFromPrompt(text);
  if (extractedName) {
    extracted.push({ key: 'name', value: extractedName });
  }

  const interestMatch = text.match(
    /(?:\bich\s+(?:mag|liebe|interessiere mich(?: sehr)? (?:fuer|für)|arbeite(?:\s+gern)?\s+mit)\b)\s+([^\n.!?]{3,120})/i,
  );
  if (interestMatch?.[1]) {
    const cleanedInterest = normalizeExtractedValue(interestMatch[1], 120);
    if (cleanedInterest.length >= 3) {
      extracted.push({ key: 'interest', value: cleanedInterest });
    }
  }

  const preferenceMatch = text.match(
    /(?:\bich\s+(?:bevorzuge|nutze am liebsten)\b|\bbitte immer\b)\s+([^\n.!?]{3,120})/i,
  );
  if (preferenceMatch?.[1]) {
    const cleanedPreference = normalizeExtractedValue(preferenceMatch[1], 120);
    if (cleanedPreference.length >= 3) {
      extracted.push({ key: 'preference', value: cleanedPreference });
    }
  }

  const unique = [];
  const seen = new Set();
  for (const item of extracted) {
    const hash = `${item.key}:${item.value.toLowerCase()}`;
    if (seen.has(hash)) continue;
    seen.add(hash);
    unique.push(item);
  }

  return unique;
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

async function resolveMemoryContext(env, userId, _prompt, config) {
  // Always load ALL memories for this user with no score threshold.
  // Users typically have < 20 personal memories, so loading everything
  // is cheap and guarantees the LLM never misses stored context.
  const all = await recallMemories(env, userId, 'user info', config, {
    topK: Math.max(20, config.maxMemoryResults),
    scoreThreshold: 0,
  });

  if (all.length > 0) return all;

  // Fallback: try common category queries (helps when KV is empty
  // but Vectorize has entries under specific terms).
  const recallQueries = ['name', 'interests', 'preferences', 'notes'];
  for (const query of recallQueries) {
    const fallback = await recallMemories(env, userId, query, config, {
      topK: Math.max(20, config.maxMemoryResults),
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

function inferClientToolCallsFromPrompt(prompt) {
  const text = String(prompt || '').toLowerCase();
  if (!text.trim()) return [];

  const inferred = [];
  const addTool = (name, args = {}) => {
    if (inferred.some((item) => item.name === name)) return;
    inferred.push({ name, arguments: args });
  };

  if (
    /(chatverlauf|verlauf|history).*(lösch|loesch|clear|zurueck)|(\blösch|\bloesch).*(chatverlauf|verlauf|history)/i.test(
      text,
    )
  ) {
    addTool('clearChatHistory');
  }

  if (/(kopier|copy).*(link|url)|(link|url).*(kopier|copy)/i.test(text)) {
    addTool('copyCurrentUrl');
  }

  if (
    /(scroll|geh).*(nach oben|ganz nach oben|top)|\bscroll top\b|seite nach oben/i.test(
      text,
    )
  ) {
    addTool('scrollTop');
  }

  if (
    /(öffn|oeffn|aufmachen|mach auf).*(menü|menu)|(menü|menu).*(öffn|oeffn|aufmachen|mach auf)/i.test(
      text,
    )
  ) {
    addTool('toggleMenu', { state: 'open' });
  } else if (
    /(schließ|schliess|schließe|schliesse|zu machen|zumachen).*(menü|menu)|(menü|menu).*(schließ|schliess|schließe|schliesse|zu machen|zumachen)/i.test(
      text,
    )
  ) {
    addTool('toggleMenu', { state: 'close' });
  }

  if (
    /(öffn|oeffn|zeige).*(suche|search)|(suche|search).*(öffn|oeffn|auf)/i.test(
      text,
    )
  ) {
    addTool('openSearch');
  } else if (
    /(schließ|schliess|schließe|schliesse).*(suche|search)|(suche|search).*(schließ|schliess|schließe|schliesse|zu)/i.test(
      text,
    )
  ) {
    addTool('closeSearch');
  }

  const searchMatch = text.match(
    /(?:suche(?:\s+nach)?|search(?:\s+for)?)\s+([a-z0-9äöüß .,_-]{2,80})/i,
  );
  if (searchMatch?.[1]) {
    const query = searchMatch[1]
      .trim()
      .replace(/[.,;:!?]+$/g, '')
      .slice(0, 80);
    if (
      query &&
      !/^(oeffnen|öffnen|schließen|schliessen|schliessen|zu|auf)$/.test(query)
    ) {
      addTool('searchBlog', { query });
    }
  }

  if (/\b(dark mode|dunkel|nachtmodus)\b/i.test(text)) {
    addTool('setTheme', { theme: 'dark' });
  } else if (/\b(light mode|hell(?:es)? thema|hell)\b/i.test(text)) {
    addTool('setTheme', { theme: 'light' });
  } else if (/\b(theme|thema).*(wechsel|toggle)|toggle.*theme\b/i.test(text)) {
    addTool('setTheme', { theme: 'toggle' });
  }

  if (/(geh|navigier|zeige|öffn|oeffn).*(projekt|projekte)\b/i.test(text)) {
    addTool('navigate', { page: 'projekte' });
  } else if (
    /(geh|navigier|zeige|öffn|oeffn).*(about|über mich|ueber mich)\b/i.test(
      text,
    )
  ) {
    addTool('navigate', { page: 'about' });
  } else if (
    /(geh|navigier|zeige|öffn|oeffn).*(galerie|gallery|fotos)\b/i.test(text)
  ) {
    addTool('navigate', { page: 'gallery' });
  } else if (/(geh|navigier|zeige|öffn|oeffn).*(blog)\b/i.test(text)) {
    addTool('navigate', { page: 'blog' });
  } else if (/(geh|navigier|zeige|öffn|oeffn).*(videos)\b/i.test(text)) {
    addTool('navigate', { page: 'videos' });
  } else if (
    /(geh|navigier|zeige|öffn|oeffn).*(kontakt|contact|footer)\b/i.test(text)
  ) {
    addTool('navigate', { page: 'kontakt' });
  } else if (/(geh|navigier|zeige|öffn|oeffn).*(start|home)\b/i.test(text)) {
    addTool('navigate', { page: 'home' });
  }

  return inferred;
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
      userId: requestedUserId = 'anonymous',
      conversationHistory = [],
      stream = true,
    } = body;
    imageAnalysis = body.imageAnalysis || imageAnalysis;

    const identity = await resolveUserIdentity(
      request,
      requestedUserId,
      prompt,
      env,
    );
    const userId = identity.userId;
    const jsonHeaders = withUserCookie(corsHeaders, request, userId);
    const sseResponseHeaders = withUserCookie(sseHeaders, request, userId);

    if (!prompt && !imageAnalysis) {
      return Response.json(
        { error: 'Empty prompt', text: 'Kein Prompt empfangen.' },
        { status: 400, headers: jsonHeaders },
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
          await write('identity', { userId });
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

    return new Response(readable, { headers: sseResponseHeaders });
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

function hasMeaningfulText(text, minLength = 4) {
  return (
    String(text || '')
      .replace(/\s+/g, ' ')
      .trim().length >= minLength
  );
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
  let lineBuffer = '';
  let eventDataLines = [];

  const flushEvent = async () => {
    if (eventDataLines.length === 0) return;

    const payload = eventDataLines.join('\n').trim();
    eventDataLines = [];
    if (!payload || payload === '[DONE]') return;

    let delta = '';
    try {
      const parsed = JSON.parse(payload);
      if (typeof parsed?.response === 'string') {
        delta = parsed.response;
      } else if (typeof parsed?.text === 'string') {
        delta = parsed.text;
      }
    } catch {
      // Fallback for providers that send plain text in data lines.
      delta = payload;
    }

    if (!delta) return;
    text += delta;
    await write('token', { text: delta });
  };

  const consumeChunk = async (chunk, isFinal = false) => {
    if (chunk) lineBuffer += chunk;

    let newlineIndex = lineBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const rawLine = lineBuffer.slice(0, newlineIndex);
      lineBuffer = lineBuffer.slice(newlineIndex + 1);
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

      if (!line) {
        await flushEvent();
      } else if (line.startsWith('data:')) {
        eventDataLines.push(line.slice(5).trimStart());
      }

      newlineIndex = lineBuffer.indexOf('\n');
    }

    if (!isFinal) return;

    const tail = lineBuffer.endsWith('\r')
      ? lineBuffer.slice(0, -1)
      : lineBuffer;
    if (tail && tail.startsWith('data:')) {
      eventDataLines.push(tail.slice(5).trimStart());
    }
    lineBuffer = '';
    await flushEvent();
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await consumeChunk(decoder.decode(value, { stream: true }));
    }
    await consumeChunk(decoder.decode(), true);
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
      if (hasMeaningfulText(text)) {
        await write(
          'message',
          buildMsg(text, clientToolCalls, serverToolResults, ctx, config),
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
      if (hasMeaningfulText(fallbackText)) {
        await write('message', {
          ...buildMsg(
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
      console.warn('Follow-up failed:', err?.message);
    }
  }

  // Follow-up for client-only tools without text
  if (
    clientToolCalls.length > 0 &&
    !hasMeaningfulText(existingText) &&
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
          buildMsg(
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
      console.warn('Follow-up for client tools failed:', err?.message);
    }
  }

  // Fallback
  await write(
    'message',
    buildMsg(
      hasMeaningfulText(existingText)
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

    return Response.json(
      {
        userId,
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
        text: 'Es gab ein technisches Problem mit der Verbindung. Bitte versuche es noch einmal.',
        toolCalls: [],
        retryable: true,
      },
      { status: 503, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
