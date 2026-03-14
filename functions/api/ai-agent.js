import { TOOL_DEFINITIONS } from './_ai-tools.js';
import { buildSystemPrompt } from './_ai-prompts.js';
import { analyzeImage } from './_ai-vision.js';
import { getSiteContentRagContext } from './_content-rag.js';
import {
  USER_ID_HEADER_NAME,
  appendSetCookie,
  buildUserIdCookie,
  normalizeUserId as normalizeSharedUserId,
  readUserIdFromCookieHeader,
} from './_user-identity.js';
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
const DEFAULT_MEMORY_RETENTION_DAYS = 180;
const DEFAULT_MAX_HISTORY_TURNS = 10;
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_CONTEXT_TIMEOUT_MS = 3500;
const FALLBACK_MEMORY_PREFIX = 'robot-memory:';
const FALLBACK_MEMORY_LIMIT = 60;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ENABLED_INTEGRATIONS = ['links', 'social', 'email', 'calendar'];
const CONTENT_RAG_PREFERRED_WAIT_MS = 900;
const SINGLETON_MEMORY_KEYS = new Set([
  'name',
  'location',
  'occupation',
  'company',
  'language',
  'birthday',
  'timezone',
  'availability',
]);
const USERNAME_LOOKUP_PREFIX = 'username:';
const USERNAME_LOOKUP_CONFLICT = '__conflict__';

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

function parseCsvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseIntegrationSet(
  value,
  fallbackList = DEFAULT_ENABLED_INTEGRATIONS,
) {
  const raw = String(value || '').trim();
  if (!raw) return new Set(fallbackList);
  if (raw.toLowerCase() === 'all') return new Set(DEFAULT_ENABLED_INTEGRATIONS);
  if (['none', 'off', 'false', '0'].includes(raw.toLowerCase())) {
    return new Set();
  }
  return new Set(parseCsvList(raw).map((item) => item.toLowerCase()));
}

async function withTimeout(
  taskFactory,
  ms,
  { fallbackValue = null, onTimeout = null, onError = null } = {},
) {
  let timeoutId = null;
  const taskPromise = Promise.resolve()
    .then(() => taskFactory())
    .then(
      (value) => ({ status: 'fulfilled', value }),
      (error) => ({ status: 'rejected', error }),
    );

  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ status: 'timeout' });
    }, ms);
  });

  const outcome = await Promise.race([taskPromise, timeoutPromise]);
  if (timeoutId) clearTimeout(timeoutId);

  if (outcome.status === 'fulfilled') {
    return outcome.value;
  }

  if (outcome.status === 'rejected') {
    onError?.(outcome.error);
    return fallbackValue;
  }

  onTimeout?.();
  return fallbackValue;
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
    memoryRetentionDays: parseInteger(
      env.ROBOT_MEMORY_RETENTION_DAYS,
      DEFAULT_MEMORY_RETENTION_DAYS,
      {
        min: 1,
        max: 3650,
      },
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
    contextTimeoutMs: parseInteger(
      env.ROBOT_CONTEXT_TIMEOUT_MS,
      DEFAULT_CONTEXT_TIMEOUT_MS,
      {
        min: 250,
        max: 10000,
      },
    ),
    toolTrustedIds: parseUserIdSet(env.ROBOT_TOOL_TRUSTED_IDS),
    toolAdminIds: parseUserIdSet(env.ROBOT_TOOL_ADMIN_IDS),
    enabledIntegrations: parseIntegrationSet(env.ROBOT_ENABLED_INTEGRATIONS),
  };
}

function normalizeUserId(raw) {
  return normalizeSharedUserId(raw);
}

function parseUserIdSet(value) {
  return new Set(
    parseCsvList(value)
      .map((id) => normalizeUserId(id))
      .filter(Boolean),
  );
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
    /(?:\bich\s+hei(?:ss|ß)e\s+jetzt\b|\bmein\s+name\s+ist\s+jetzt\b|\bmein\s+neuer\s+name\s+ist\b|\bnenn\s+mich\s+ab\s+jetzt\b|\bdu\s+kannst\s+mich\s+ab\s+jetzt\b|\b(?:bitte\s+)?(?:ändere|aendere)\s+meinen\s+namen\s+(?:zu|auf)\b)\s+([^\n.,;:!?]{2,60})/i,
    /(?:\bich\s+hei(?:ss|ß)e\b|\bmein\s+name\s+ist\b|\bnenn\s+mich\b|\bdu\s+kannst\s+mich\b)\s+([^\n.,;:!?]{2,60})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const candidatePrefix = normalizeExtractedValue(match[1], 40).toLowerCase();
    if (/^(aus|in|von)\b/.test(candidatePrefix)) continue;
    const name = normalizeNameCandidate(match[1]);
    if (name && name.toLowerCase() !== 'jules') return name;
  }

  return '';
}

function extractRecoveryLookupNameFromPrompt(promptText) {
  const text = String(promptText || '');
  if (!text.trim()) return '';

  const patterns = [/(?:\bich\s+bin\b)\s+([^\n.,;:!?]{2,60})/i];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const candidatePrefix = normalizeExtractedValue(match[1], 40).toLowerCase();
    if (/^(aus|in|von)\b/.test(candidatePrefix)) continue;
    const name = normalizeNameCandidate(match[1]);
    if (name && name.toLowerCase() !== 'jules') return name;
  }

  return '';
}

function extractExplicitNameOverwrite(promptText) {
  const text = String(promptText || '');
  if (!text.trim()) return '';

  const patterns = [
    /(?:\bich\s+hei(?:ss|ß)e\s+jetzt\b|\bmein\s+name\s+ist\s+jetzt\b|\bmein\s+neuer\s+name\s+ist\b|\bnenn\s+mich\s+ab\s+jetzt\b|\bdu\s+kannst\s+mich\s+ab\s+jetzt\b|\b(?:bitte\s+)?(?:ändere|aendere)\s+meinen\s+namen\s+(?:zu|auf)\b)\s+([^\n.,;:!?]{2,60})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const name = normalizeNameCandidate(match[1]);
    if (name && name.toLowerCase() !== 'jules') return name;
  }

  return '';
}

function isExplicitSelfNamePrompt(promptText, proposedName = '') {
  const extractedName = extractNameFromPrompt(promptText);
  if (!extractedName) return false;

  const normalizedProposedName = normalizeNameCandidate(proposedName);
  if (!normalizedProposedName) return true;

  return extractedName.toLowerCase() === normalizedProposedName.toLowerCase();
}

function isExplicitNameOverwritePrompt(promptText, proposedName = '') {
  const explicitName = extractExplicitNameOverwrite(promptText);
  if (!explicitName) return false;

  const normalizedProposedName = normalizeNameCandidate(proposedName);
  if (!normalizedProposedName) return true;

  return explicitName.toLowerCase() === normalizedProposedName.toLowerCase();
}

function normalizeExtractedValue(value, maxLength = 120) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.,;:!?]+$/g, '')
    .slice(0, maxLength);
}

function stripChainedMemoryClause(value) {
  return String(value || '')
    .replace(/\s+\b(?:und|aber)\s+(?:ich|mein(?:e|er|es)?|wir)\b[\s\S]*$/i, '')
    .trim();
}

function normalizePromptForMemoryExtraction(promptText) {
  return String(promptText || '')
    .replace(
      /\s+(?:und|außerdem|ausserdem)\s+(?=(?:ich|mein(?:e|er|es)?|wir)\b)/gi,
      '; ',
    )
    .replace(
      /\s+(?:und|außerdem|ausserdem)\s+(?=(?:wohne|lebe|komme|arbeite|spreche|rede|mag|liebe|interessiere|bevorzuge|nutze|will|möchte|moechte|kann|habe|hasse|vermeide|bin)\b)/gi,
      '; ',
    )
    .replace(/\s*,\s*(?=(?:ich|mein(?:e|er|es)?|wir)\b)/gi, '; ');
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

function getUserNameLookupKey(name) {
  const normalizedName = normalizeNameCandidate(name);
  if (!normalizedName) return '';
  return `${USERNAME_LOOKUP_PREFIX}${normalizedName.toLowerCase()}`;
}

function getFallbackMemoryKV(env) {
  if (env.JULES_MEMORY_KV) return env.JULES_MEMORY_KV;
  if (env.RATE_LIMIT_KV) return env.RATE_LIMIT_KV;
  if (env.SITEMAP_CACHE_KV) return env.SITEMAP_CACHE_KV;
  return null;
}

async function readUserNameLookup(env, name) {
  const kv = getFallbackMemoryKV(env);
  if (!kv?.get) {
    return { status: 'none', userId: '', name: normalizeNameCandidate(name) };
  }

  const normalizedName = normalizeNameCandidate(name);
  const lookupKey = getUserNameLookupKey(normalizedName);
  if (!lookupKey) {
    return { status: 'none', userId: '', name: '' };
  }

  try {
    const rawValue = String((await kv.get(lookupKey)) || '').trim();
    if (!rawValue) {
      return { status: 'none', userId: '', name: normalizedName };
    }
    if (rawValue === USERNAME_LOOKUP_CONFLICT) {
      return { status: 'conflict', userId: '', name: normalizedName };
    }

    return {
      status: 'resolved',
      userId: normalizeUserId(rawValue),
      name: normalizedName,
    };
  } catch {
    return { status: 'none', userId: '', name: normalizedName };
  }
}

async function syncUserNameLookup(env, userId, nextName, previousName = '') {
  const kv = getFallbackMemoryKV(env);
  const normalizedUserId = normalizeUserId(userId);
  if (!kv?.get || !kv?.put || !normalizedUserId) {
    return { linked: false, conflict: false };
  }

  const nextKey = getUserNameLookupKey(nextName);
  const previousKey = getUserNameLookupKey(previousName);

  try {
    if (previousKey && previousKey !== nextKey && kv?.delete) {
      const previousMappedUserId = normalizeUserId(await kv.get(previousKey));
      if (previousMappedUserId === normalizedUserId) {
        await kv.delete(previousKey);
      }
    }

    if (!nextKey) {
      return { linked: false, conflict: false };
    }

    const existingValue = String((await kv.get(nextKey)) || '').trim();
    const existingUserId = normalizeUserId(existingValue);
    if (
      existingValue === USERNAME_LOOKUP_CONFLICT ||
      (existingUserId && existingUserId !== normalizedUserId)
    ) {
      await kv.put(nextKey, USERNAME_LOOKUP_CONFLICT);
      return { linked: false, conflict: true };
    }

    await kv.put(nextKey, normalizedUserId);
    return { linked: true, conflict: false };
  } catch {
    return { linked: false, conflict: false };
  }
}

async function resolveUserIdentity(
  request,
  requestedUserId = '',
  promptText = '',
  env = null,
  config = getAgentConfig(env || {}),
) {
  const headerUserId = normalizeUserId(
    request.headers.get(USER_ID_HEADER_NAME),
  );
  const bodyUserId = normalizeUserId(requestedUserId);
  const cookieUserId = readUserIdFromCookieHeader(
    request.headers.get('Cookie'),
  );
  const currentUserId = headerUserId || bodyUserId || cookieUserId || '';
  const explicitName = extractNameFromPrompt(promptText);
  const recoveryLookupName =
    explicitName || extractRecoveryLookupNameFromPrompt(promptText);
  const currentStoredName =
    currentUserId && env
      ? normalizeNameCandidate(
          (await getStoredFallbackNameEntry(env, currentUserId, config))
            ?.value || '',
        )
      : '';

  // Priority:
  // 1) Explicit request identity from the current browser runtime
  // 2) First-party cookie fallback across reloads/visits
  // 3) Explicit self-identification by a previously stored name
  // 4) Fresh generated ID when no identity signal exists
  const recoveryLookup =
    recoveryLookupName && (!currentUserId || !currentStoredName)
      ? await readUserNameLookup(env, recoveryLookupName)
      : { status: 'none', userId: '', name: recoveryLookupName };
  const needsRecoveryConfirmation = recoveryLookup.status === 'resolved';
  const recoveryConflict = recoveryLookup.status === 'conflict';
  let resolvedUserId = currentUserId || createUserId();
  const recoveredUserId = normalizeUserId(recoveryLookup.userId);
  const shouldOfferRecovery =
    needsRecoveryConfirmation &&
    recoveredUserId &&
    recoveredUserId !== resolvedUserId &&
    (!currentStoredName ||
      currentStoredName.toLowerCase() !==
        (recoveryLookup.name || '').toLowerCase());

  // Auto-Recovery Feature: Recognize users automatically when they say their name
  let wasAutoRecovered = false;
  if (shouldOfferRecovery) {
    resolvedUserId = recoveredUserId;
    wasAutoRecovered = true;
  }

  return {
    userId: resolvedUserId,
    wasAutoRecovered,
    recovery: recoveryConflict
      ? {
          status: 'conflict',
          name: recoveryLookup.name || explicitName || '',
          candidateUserId: '',
        }
      : null,
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

function withUserIdHeader(headers, userId) {
  const out = new Headers(headers);
  if (userId) {
    out.set(USER_ID_HEADER_NAME, userId);
    appendExposeHeader(out, USER_ID_HEADER_NAME);
  }
  return out;
}

// ─── Tool Definitions ───────────────────────────────────────────────────────────

const TOOL_ROLE_LEVELS = {
  user: 1,
  trusted: 2,
  admin: 3,
};
const DEFAULT_TOOL_ROLE = 'user';

const TOOL_DEFINITION_BY_NAME = new Map(
  TOOL_DEFINITIONS.map((tool) => [tool.name, tool]),
);

function toOpenAiTool(toolDefinition) {
  return {
    type: 'function',
    function: {
      name: toolDefinition.name,
      description: toolDefinition.description,
      parameters: toolDefinition.parameters,
    },
  };
}

export function normalizeToolRole(rawRole) {
  const role = String(rawRole || DEFAULT_TOOL_ROLE).toLowerCase();
  return Object.hasOwn(TOOL_ROLE_LEVELS, role) ? role : DEFAULT_TOOL_ROLE;
}

function getToolRoleLevel(role) {
  const normalized = normalizeToolRole(role);
  return TOOL_ROLE_LEVELS[normalized] || TOOL_ROLE_LEVELS[DEFAULT_TOOL_ROLE];
}

function resolveUserToolRole(config, userId) {
  const id = normalizeUserId(userId);
  if (id && config.toolAdminIds.has(id)) return 'admin';
  if (id && config.toolTrustedIds.has(id)) return 'trusted';
  return DEFAULT_TOOL_ROLE;
}

function isToolAllowedForRole(toolDefinition, role) {
  const required = normalizeToolRole(toolDefinition?.minRole);
  return getToolRoleLevel(role) >= getToolRoleLevel(required);
}

function isIntegrationEnabled(toolDefinition, config) {
  const integration = String(toolDefinition?.integration || '').toLowerCase();
  if (!integration) return true;
  return config.enabledIntegrations.has(integration);
}

function isExplicitUserMemoryRequest(promptText) {
  const text = String(promptText || '')
    .toLowerCase()
    .trim();
  if (!text) return false;

  return [
    /\bwie\s+hei(?:ss|ß)e\s+ich\b/,
    /\bwas\s+wei(?:ss|ß)t\s+du\s+über\s+mich\b/,
    /\bwas\s+wei(?:ss|ß)t\s+du\s+noch\s+über\s+mich\b/,
    /\berinner(?:e|st)\s+du\s+dich\s+an\s+mich\b/,
    /\bwei(?:ss|ß)t\s+du\s+noch\b/,
    /\bmeine?\s+(?:infos?|informationen|vorlieben|interessen|ziele|daten)\b/,
    /\bwas\s+habe\s+ich\s+dir\s+gesagt\b/,
    /\bwas\s+hast\s+du\s+dir\s+über\s+mich\s+gemerkt\b/,
  ].some((pattern) => pattern.test(text));
}

function isToolAllowedForPrompt(toolDefinition, promptText) {
  if (toolDefinition?.name === 'recallMemory') {
    return isExplicitUserMemoryRequest(promptText);
  }
  return true;
}

function getAllowedToolDefinitions(config, userRole, promptText = '') {
  return TOOL_DEFINITIONS.filter(
    (tool) =>
      isToolAllowedForRole(tool, userRole) &&
      isIntegrationEnabled(tool, config) &&
      isToolAllowedForPrompt(tool, promptText),
  );
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

const MEMORY_KEY_METADATA = {
  name: { category: 'identity', priority: 100 },
  preference: { category: 'preference', priority: 90 },
  occupation: { category: 'profile', priority: 88 },
  company: { category: 'profile', priority: 86 },
  location: { category: 'profile', priority: 84 },
  language: { category: 'profile', priority: 82 },
  interest: { category: 'interest', priority: 80 },
  skill: { category: 'ability', priority: 78 },
  goal: { category: 'goal', priority: 76 },
  project: { category: 'project', priority: 74 },
  birthday: { category: 'identity', priority: 72 },
  dislike: { category: 'preference', priority: 70 },
  availability: { category: 'availability', priority: 68 },
  timezone: { category: 'availability', priority: 66 },
  note: { category: 'note', priority: 40 },
};
const DEFAULT_MEMORY_CATEGORY = 'note';
const DEFAULT_MEMORY_PRIORITY = 20;

function normalizeMemoryKey(rawKey) {
  return String(rawKey || 'note')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 30);
}

function getMemoryRetentionMs(config) {
  const retentionDays = Number.isFinite(config?.memoryRetentionDays)
    ? Math.max(1, Math.floor(config.memoryRetentionDays))
    : DEFAULT_MEMORY_RETENTION_DAYS;
  return retentionDays * DAY_IN_MS;
}

function isMemoryExpired(timestamp, config, now = Date.now()) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return now - ts > getMemoryRetentionMs(config);
}

function resolveMemoryMetadata(key, category, priority) {
  const normalizedKey = normalizeMemoryKey(key) || 'note';
  const fallback = MEMORY_KEY_METADATA[normalizedKey] || {
    category: DEFAULT_MEMORY_CATEGORY,
    priority: DEFAULT_MEMORY_PRIORITY,
  };

  const normalizedCategory =
    normalizeMemoryText(category || fallback.category).toLowerCase() ||
    fallback.category;

  const numericPriority = Number.parseInt(String(priority ?? ''), 10);
  const normalizedPriority = Number.isFinite(numericPriority)
    ? Math.min(100, Math.max(0, numericPriority))
    : fallback.priority;

  return {
    key: normalizedKey,
    category: normalizedCategory,
    priority: normalizedPriority,
  };
}

function normalizeMemoryEntry(entry, config, now = Date.now()) {
  const cleanedValue = normalizeMemoryText(entry?.value || '');
  const ts = Number(entry?.timestamp);
  const timestamp = Number.isFinite(ts) && ts > 0 ? ts : now;
  const metadata = resolveMemoryMetadata(
    entry?.key,
    entry?.category,
    entry?.priority,
  );
  const expiresAt = timestamp + getMemoryRetentionMs(config);

  return {
    ...metadata,
    value: cleanedValue,
    timestamp,
    expiresAt,
  };
}

function getLatestMemoryEntry(entries, key) {
  const normalizedKey = normalizeMemoryKey(key);
  let latestEntry = null;

  for (const entry of entries || []) {
    if (normalizeMemoryKey(entry?.key) !== normalizedKey) continue;
    if (
      !latestEntry ||
      entry.timestamp > latestEntry.timestamp ||
      (entry.timestamp === latestEntry.timestamp &&
        entry.priority > latestEntry.priority)
    ) {
      latestEntry = entry;
    }
  }

  return latestEntry;
}

function compactMemoryEntries(entries, config, now = Date.now()) {
  const unique = new Map();

  for (const rawEntry of entries) {
    const entry = normalizeMemoryEntry(rawEntry, config, now);
    if (!entry.value) continue;
    if (isMemoryExpired(entry.timestamp, config, now)) continue;

    const hash = SINGLETON_MEMORY_KEYS.has(entry.key)
      ? entry.key
      : `${entry.key}:${entry.value.toLowerCase()}`;
    const existing = unique.get(hash);

    if (
      !existing ||
      entry.timestamp > existing.timestamp ||
      (entry.timestamp === existing.timestamp &&
        entry.priority > existing.priority)
    ) {
      unique.set(hash, entry);
    }
  }

  return [...unique.values()]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-FALLBACK_MEMORY_LIMIT);
}

async function loadFallbackMemories(
  env,
  userId,
  config,
  { persistPruned = false } = {},
) {
  const kv = getFallbackMemoryKV(env);
  if (!kv?.get) return [];

  try {
    const raw = await kv.get(getFallbackMemoryKey(userId));
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    const compacted = compactMemoryEntries(parsed, config, now);

    if (persistPruned && kv?.put) {
      const compactedJson = JSON.stringify(compacted);
      if ((raw || '[]') !== compactedJson) {
        await kv.put(getFallbackMemoryKey(userId), compactedJson);
      }
    }

    return compacted;
  } catch {
    return [];
  }
}

async function saveFallbackMemory(env, userId, key, value, config) {
  const kv = getFallbackMemoryKV(env);
  if (!kv?.get || !kv?.put) return false;

  const cleanedValue = normalizeMemoryText(value);
  if (!cleanedValue) return false;
  const metadata = resolveMemoryMetadata(key);

  try {
    const existing = await loadFallbackMemories(env, userId, config, {
      persistPruned: true,
    });
    const now = Date.now();
    const duplicateIndex = existing.findIndex(
      (item) =>
        item.key === metadata.key &&
        item.value.toLowerCase() === cleanedValue.toLowerCase(),
    );

    if (duplicateIndex >= 0) {
      existing[duplicateIndex] = {
        ...existing[duplicateIndex],
        ...metadata,
        timestamp: now,
        expiresAt: now + getMemoryRetentionMs(config),
      };
    } else {
      existing.push({
        ...metadata,
        value: cleanedValue,
        timestamp: now,
        expiresAt: now + getMemoryRetentionMs(config),
      });
    }

    const compacted = compactMemoryEntries(existing, config, now);
    await kv.put(getFallbackMemoryKey(userId), JSON.stringify(compacted));
    return true;
  } catch {
    return false;
  }
}

async function saveFallbackMemoriesBatch(env, userId, entries, config) {
  const kv = getFallbackMemoryKV(env);
  if (!kv?.get || !kv?.put) return false;
  if (!Array.isArray(entries) || entries.length === 0) return false;

  try {
    const existing = await loadFallbackMemories(env, userId, config, {
      persistPruned: true,
    });
    const now = Date.now();
    const merged = [...existing];

    for (const rawEntry of entries) {
      const entry = normalizeMemoryEntry(rawEntry, config, now);
      if (!entry.value) continue;

      const duplicateIndex = merged.findIndex(
        (item) =>
          item.key === entry.key &&
          item.value.toLowerCase() === entry.value.toLowerCase(),
      );

      if (duplicateIndex >= 0) {
        merged[duplicateIndex] = {
          ...merged[duplicateIndex],
          ...entry,
        };
        continue;
      }

      merged.push(entry);
    }

    const compacted = compactMemoryEntries(merged, config, now);
    await kv.put(getFallbackMemoryKey(userId), JSON.stringify(compacted));
    return true;
  } catch {
    return false;
  }
}

async function getStoredNameEntry(env, userId, config) {
  const fallbackEntries = await loadFallbackMemories(env, userId, config, {
    persistPruned: true,
  });
  const fallbackName = getLatestMemoryEntry(fallbackEntries, 'name');
  if (fallbackName?.value) return fallbackName;

  if (!env.AI || !env.JULES_MEMORY) {
    return null;
  }

  try {
    const { data } = await env.AI.run(config.embeddingModel, {
      text: ['name'],
    });
    if (!data?.[0]) return null;

    const results = await env.JULES_MEMORY.query(data[0], {
      topK: 5,
      filter: { userId, key: 'name' },
      returnMetadata: 'all',
    });

    const now = Date.now();
    const vectorEntries = (results?.matches || [])
      .map((match) =>
        normalizeMemoryEntry(
          {
            key: match.metadata?.key || 'name',
            value: match.metadata?.value || '',
            category: match.metadata?.category,
            priority: match.metadata?.priority,
            timestamp: match.metadata?.timestamp,
          },
          config,
          now,
        ),
      )
      .filter(
        (entry) => entry.value && !isMemoryExpired(entry.timestamp, config),
      );

    return getLatestMemoryEntry(vectorEntries, 'name');
  } catch (error) {
    if (!error?.remote) {
      console.warn('getStoredNameEntry error:', error?.message || error);
    }
    return null;
  }
}

async function getStoredFallbackNameEntry(env, userId, config) {
  const fallbackEntries = await loadFallbackMemories(env, userId, config, {
    persistPruned: true,
  });
  return getLatestMemoryEntry(fallbackEntries, 'name');
}

async function filterProtectedNameEntries(
  env,
  userId,
  entries,
  config,
  { allowNameOverwrite = false } = {},
) {
  const hasNameEntry = entries.some((entry) => entry.key === 'name');
  if (!hasNameEntry) {
    return {
      entries,
      existingName: null,
      skippedNameEntries: [],
    };
  }

  const existingName = await getStoredNameEntry(env, userId, config);
  if (!existingName?.value) {
    return {
      entries,
      existingName: null,
      skippedNameEntries: [],
    };
  }

  const keptEntries = [];
  const skippedNameEntries = [];

  for (const entry of entries) {
    if (entry.key !== 'name') {
      keptEntries.push(entry);
      continue;
    }

    if (
      allowNameOverwrite &&
      entry.value.toLowerCase() !== existingName.value.toLowerCase()
    ) {
      keptEntries.push(entry);
      continue;
    }

    skippedNameEntries.push(entry);
  }

  return {
    entries: keptEntries,
    existingName,
    skippedNameEntries,
  };
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
  config,
  { topK = DEFAULT_MAX_MEMORY_RESULTS, scoreThreshold = 0 } = {},
) {
  const entries = await loadFallbackMemories(env, userId, config, {
    persistPruned: true,
  });
  if (!entries.length) return [];

  return entries
    .map((entry) => ({
      ...entry,
      score: scoreFallbackMemoryEntry(entry, query),
    }))
    .filter((entry) => entry.score >= scoreThreshold)
    .sort((a, b) =>
      b.score === a.score
        ? b.priority === a.priority
          ? b.timestamp - a.timestamp
          : b.priority - a.priority
        : b.score - a.score,
    )
    .slice(0, topK);
}

async function storeMemory(env, userId, key, value, config, options = {}) {
  const metadata = resolveMemoryMetadata(key);
  const cleanedValue = normalizeMemoryText(value);

  if (metadata.key === 'name' && cleanedValue.toLowerCase() === 'jules') {
    return {
      success: false,
      error: "Cannot use assistant's name as user name",
    };
  }

  if (!cleanedValue) {
    return { success: false, error: 'Empty memory value' };
  }

  if (metadata.key === 'name') {
    const existingName = await getStoredNameEntry(env, userId, config);
    if (existingName?.value) {
      if (existingName.value.toLowerCase() === cleanedValue.toLowerCase()) {
        await syncUserNameLookup(env, userId, existingName.value);
        return {
          success: true,
          id: `name_existing_${userId}`,
          storage: 'existing',
          skipped: true,
          message: `Name bleibt "${existingName.value}".`,
        };
      }

      if (options.allowNameOverwrite !== true) {
        return {
          success: false,
          skipped: true,
          error: `Name already stored as "${existingName.value}"`,
        };
      }
    }
  }

  const now = Date.now();
  const previousName =
    metadata.key === 'name'
      ? (await getStoredNameEntry(env, userId, config))?.value || ''
      : '';
  const kvStored = await saveFallbackMemory(
    env,
    userId,
    metadata.key,
    cleanedValue,
    config,
  );

  if (!env.AI || !env.JULES_MEMORY) {
    if (metadata.key === 'name' && kvStored) {
      await syncUserNameLookup(env, userId, cleanedValue, previousName);
    }
    return kvStored
      ? { success: true, id: `kv_${Date.now()}`, storage: 'kv' }
      : { success: false };
  }

  try {
    const text = `${metadata.key}: ${cleanedValue}`;
    const { data } = await env.AI.run(config.embeddingModel, { text: [text] });
    if (!data?.[0]) {
      return kvStored
        ? { success: true, id: `kv_${Date.now()}`, storage: 'kv' }
        : { success: false, error: 'Embedding failed' };
    }

    const id = `${userId}_${metadata.key}_${now}`;
    await env.JULES_MEMORY.upsert([
      {
        id,
        values: data[0],
        metadata: {
          userId,
          key: metadata.key,
          value: cleanedValue,
          category: metadata.category,
          priority: metadata.priority,
          timestamp: now,
          expiresAt: now + getMemoryRetentionMs(config),
          text,
        },
      },
    ]);
    if (metadata.key === 'name') {
      await syncUserNameLookup(env, userId, cleanedValue, previousName);
    }
    return {
      success: true,
      id,
      storage: kvStored ? 'vectorize+kv' : 'vectorize',
    };
  } catch (error) {
    if (metadata.key === 'name' && kvStored) {
      await syncUserNameLookup(env, userId, cleanedValue, previousName);
    }
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
  const kvMemories = await recallMemoriesFromFallback(
    env,
    userId,
    query,
    config,
    {
      topK,
      scoreThreshold,
    },
  );

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

    const now = Date.now();
    const vectorMemories = (results?.matches || [])
      .filter((m) => m.score >= scoreThreshold)
      .map((m) => {
        const normalized = normalizeMemoryEntry(
          {
            key: m.metadata?.key || 'note',
            value: m.metadata?.value || '',
            category: m.metadata?.category,
            priority: m.metadata?.priority,
            timestamp: m.metadata?.timestamp,
          },
          config,
          now,
        );
        return {
          ...normalized,
          score: m.score,
        };
      })
      .filter((entry) => !isMemoryExpired(entry.timestamp, config, now))
      .sort((a, b) =>
        b.score === a.score
          ? b.priority === a.priority
            ? b.timestamp - a.timestamp
            : b.priority - a.priority
          : b.score - a.score,
      );

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

// ─── Server-Side Tool Execution ─────────────────────────────────────────────────

async function executeServerTool(
  env,
  toolName,
  args,
  userId,
  config,
  promptText = '',
) {
  if (toolName === 'rememberUser') {
    const normalizedKey = normalizeMemoryKey(args.key || 'note');
    const normalizedValue = normalizeMemoryText(args.value || '');
    const allowNameOverwrite =
      normalizedKey === 'name' &&
      isExplicitNameOverwritePrompt(promptText, normalizedValue);

    if (
      normalizedKey === 'name' &&
      !allowNameOverwrite &&
      !isExplicitSelfNamePrompt(promptText, normalizedValue)
    ) {
      const existingName = await getStoredNameEntry(env, userId, config);
      if (
        existingName?.value &&
        existingName.value.toLowerCase() ===
          normalizeNameCandidate(normalizedValue).toLowerCase()
      ) {
        return `Name bleibt "${existingName.value}".`;
      }
      return 'Konnte nicht gespeichert werden (Name nur bei klarer Selbstvorstellung speichern).';
    }

    const result = await storeMemory(
      env,
      userId,
      normalizedKey,
      normalizedValue,
      config,
      {
        allowNameOverwrite,
      },
    );
    if (result.success) {
      return (
        result.message || `✅ Gemerkt: ${normalizedKey} = "${normalizedValue}"`
      );
    }
    return `Konnte nicht gespeichert werden (${result.error || 'Fehler'}).`;
  }

  if (toolName === 'recallMemory') {
    const queryText = normalizeMemoryText(args.query || '');
    const wantsAllMemories =
      !queryText ||
      /^(?:all(?:\s+memories)?|alles?|user\s*info)$/i.test(queryText);

    const memories = wantsAllMemories
      ? await withTimeout(
          () => resolveMemoryContext(env, userId, 'user info', config),
          config.contextTimeoutMs,
          {
            fallbackValue: [],
          },
        )
      : await withTimeout(
          () => recallMemories(env, userId, queryText, config),
          config.contextTimeoutMs,
          {
            fallbackValue: [],
          },
        );

    if (!memories.length) return 'Keine Erinnerungen gefunden.';
    return (
      'Bekannte Infos:\n' +
      memories
        .map(
          (m) =>
            `- **${m.key}** (${m.category}, Priorität ${m.priority}): ${m.value}`,
        )
        .join('\n')
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

const SERVER_TOOL_NAMES = new Set([
  'rememberUser',
  'recallMemory',
  'getSiteAnalytics',
]);

function buildToolConfirmMessage(toolName, args, toolDefinition) {
  if (toolDefinition?.confirmMessage) return toolDefinition.confirmMessage;

  switch (toolName) {
    case 'openExternalLink':
      return `Soll dieser externe Link geöffnet werden?\n${String(args?.url || '').trim()}`;
    case 'composeEmail':
      return `Soll ein E-Mail-Entwurf an ${String(args?.to || '').trim() || 'den Empfänger'} geöffnet werden?`;
    case 'createCalendarReminder':
      return `Soll ein Kalender-Eintrag für "${String(args?.title || 'Erinnerung')}" erstellt werden?`;
    case 'clearChatHistory':
      return 'Soll der lokale Chatverlauf wirklich gelöscht werden?';
    default:
      return 'Soll diese Aktion wirklich ausgeführt werden?';
  }
}

function buildClientToolMeta(toolDefinition, args, userRole) {
  const requiresConfirm = !!toolDefinition?.requiresConfirm;
  const meta = {
    category: String(toolDefinition?.category || 'general'),
    requiredRole: normalizeToolRole(toolDefinition?.minRole),
    currentRole: normalizeToolRole(userRole),
    integration: toolDefinition?.integration
      ? String(toolDefinition.integration)
      : '',
    requiresConfirm,
  };

  if (requiresConfirm) {
    meta.confirmTitle = String(
      toolDefinition?.confirmTitle || 'Aktion bestätigen',
    );
    meta.confirmMessage = buildToolConfirmMessage(
      toolDefinition?.name,
      args,
      toolDefinition,
    );
  }

  return meta;
}

function validateToolPermission(toolDefinition, userRole, config) {
  if (!toolDefinition) {
    return {
      allowed: false,
      reason: 'Tool ist nicht bekannt.',
    };
  }

  if (!isToolAllowedForRole(toolDefinition, userRole)) {
    return {
      allowed: false,
      reason: `Tool "${toolDefinition.name}" erfordert Rolle "${normalizeToolRole(toolDefinition.minRole)}".`,
    };
  }

  if (!isIntegrationEnabled(toolDefinition, config)) {
    return {
      allowed: false,
      reason: `Integration "${toolDefinition.integration}" ist deaktiviert.`,
    };
  }

  return { allowed: true };
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

async function classifyToolCalls(
  env,
  toolCalls,
  userId,
  config,
  userRole,
  promptText = '',
) {
  const clientToolCalls = [];
  const serverToolResults = [];

  for (const tc of toolCalls) {
    const toolName = String(tc?.name || '').trim();
    if (!toolName) continue;

    const toolDefinition = TOOL_DEFINITION_BY_NAME.get(toolName);
    const permission = validateToolPermission(toolDefinition, userRole, config);
    if (!permission.allowed) {
      serverToolResults.push({
        name: toolName,
        result: `❌ ${permission.reason}`,
      });
      continue;
    }

    const args = parseToolArguments(tc?.arguments, toolName);
    if (SERVER_TOOL_NAMES.has(toolName)) {
      const serverResult = await executeServerTool(
        env,
        toolName,
        args,
        userId,
        config,
        promptText,
      );
      if (serverResult !== null) {
        serverToolResults.push({ name: toolName, result: serverResult });
      }
    } else {
      clientToolCalls.push({
        name: toolName,
        arguments: args,
        meta: buildClientToolMeta(toolDefinition, args, userRole),
      });
    }
  }
  return { clientToolCalls, serverToolResults };
}

// ─── RAG Context ────────────────────────────────────────────────────────────────

async function getAutoRAGContext(query, env) {
  if (!env.AI) return null;

  try {
    const ragId = env.RAG_ID || 'wispy-pond-1055';
    const searchData = await env.AI.autorag(ragId).aiSearch({
      query,
      max_num_results: 4,
      stream: false,
    });

    if (!searchData?.data?.length) return null;

    const matches = searchData.data
      .slice(0, 4)
      .map((item) => {
        const url = item.filename || item.url || '';
        const title = item.title || 'Seite';
        const content = Array.isArray(item.content)
          ? item.content.map((c) => c.text || '').join(' ')
          : item.text || item.description || '';
        const safeUrl = url.startsWith('/') ? url : `/${url}`;
        return {
          title,
          url: safeUrl,
          content: content.replace(/\s+/g, ' ').trim().slice(0, 500),
        };
      })
      .filter((item) => item.title && item.url && item.content);

    if (!matches.length) return null;

    return {
      prompt: matches
        .map(
          (item) =>
            `Titel: ${item.title}\nURL: ${item.url}\nInhalt: ${item.content}`,
        )
        .join('\n\n---\n\n'),
      sources: [],
      matches,
    };
  } catch (error) {
    console.warn('RAG Context Error:', error?.message);
    return null;
  }
}

function createSettledTask(taskFactory) {
  let settled = false;
  const promise = Promise.resolve()
    .then(() => taskFactory())
    .then((value) => {
      settled = true;
      return value;
    });

  return {
    promise,
    isSettled: () => settled,
  };
}

async function getRAGContext(query, env, config) {
  const timeoutMs = config.contextTimeoutMs;
  const contentTask = createSettledTask(() =>
    withTimeout(() => getSiteContentRagContext(query, env), timeoutMs, {
      fallbackValue: null,
    }),
  );
  const autoTask = createSettledTask(() =>
    withTimeout(() => getAutoRAGContext(query, env), timeoutMs, {
      fallbackValue: null,
    }),
  );

  const preferredContent = await withTimeout(
    () => contentTask.promise,
    Math.min(CONTENT_RAG_PREFERRED_WAIT_MS, timeoutMs),
    {
      fallbackValue: null,
    },
  );
  if (preferredContent) {
    return preferredContent;
  }

  if (autoTask.isSettled()) {
    const autoValue = await autoTask.promise;
    if (autoValue) return autoValue;
  }

  const firstAvailable = await Promise.race([
    contentTask.promise.then((value) => ({ source: 'content', value })),
    autoTask.promise.then((value) => ({ source: 'auto', value })),
  ]);

  if (firstAvailable.value) {
    if (firstAvailable.source === 'content') {
      return firstAvailable.value;
    }

    if (contentTask.isSettled()) {
      const contentValue = await contentTask.promise;
      if (contentValue) return contentValue;
    }

    return firstAvailable.value;
  }

  const [contentValue, autoValue] = await Promise.all([
    contentTask.promise,
    autoTask.promise,
  ]);
  return contentValue || autoValue || null;
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
  /\s+tools?\s*:\s*(?:navigate|setTheme|searchBlog|toggleMenu|scrollToSection|openSearch|closeSearch|focusSearch|scrollTop|copyCurrentUrl|openImageUpload|clearChatHistory|rememberUser|recallMemory|recommend|openExternalLink|openSocialProfile|composeEmail|createCalendarReminder|getSiteAnalytics)\b[^\n]*/gi;
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
  const text = normalizePromptForMemoryExtraction(prompt);
  if (!text.trim()) return [];

  const extracted = [];
  const pushFact = (key, rawValue, { min = 2, max = 140 } = {}) => {
    let cleaned = normalizeExtractedValue(
      stripChainedMemoryClause(rawValue),
      max,
    );
    if (key === 'occupation') {
      const occupationWithCompany = cleaned.match(/^(.+?)\s+bei\s+(.+)$/i);
      if (occupationWithCompany?.[1] && occupationWithCompany?.[2]) {
        const parsedOccupation = normalizeExtractedValue(
          occupationWithCompany[1],
          max,
        );
        const parsedCompany = normalizeExtractedValue(
          occupationWithCompany[2],
          120,
        );
        if (parsedOccupation) cleaned = parsedOccupation;
        if (parsedCompany.length >= 2) {
          extracted.push({ key: 'company', value: parsedCompany });
        }
      }
    }
    if (cleaned.length < min) return;
    extracted.push({ key, value: cleaned });
  };
  const addFromRegex = (key, regex, options) => {
    const matches = text.matchAll(regex);
    for (const match of matches) {
      if (match?.[1]) pushFact(key, match[1], options);
    }
  };

  const extractedName = extractNameFromPrompt(text);
  if (extractedName) {
    extracted.push({ key: 'name', value: extractedName });
  }

  addFromRegex(
    'interest',
    /(?:^|[\n,;.!?]\s*)(?:ich\s+)?(?:mag(?!\s+nicht)|liebe|interessiere mich(?: sehr)? (?:fuer|für)|arbeite(?:\s+gern)?\s+mit)\s+([^\n,;!?]{3,120})/gi,
    { min: 3, max: 120 },
  );
  addFromRegex(
    'preference',
    /(?:^|[\n,;.!?]\s*)(?:(?:ich\s+)?(?:bevorzuge|nutze am liebsten)|bitte immer)\s+([^\n,;!?]{3,120})/gi,
    { min: 3, max: 120 },
  );

  addFromRegex(
    'location',
    /(?:^|[\n,;.!?]\s*)(?:(?:ich\s+)?(?:wohne|lebe)\s+(?:in|bei)|(?:ich\s+)?komme\s+aus|mein\s+wohnort\s+ist)\s+([^\n,;!?]{2,120})/gi,
    { min: 2, max: 120 },
  );
  addFromRegex(
    'occupation',
    /(?:^|[\n,;.!?]\s*)(?:(?:ich\s+)?(?:arbeite|bin)\s+als|mein\s+beruf\s+ist)\s+([^\n,;!?]{2,120})/gi,
    { min: 2, max: 120 },
  );
  addFromRegex(
    'company',
    /(?:^|[\n,;.!?]\s*)(?:(?:ich\s+)?arbeite\s+bei|meine?\s+firma\s+ist)\s+([^\n,;!?]{2,120})/gi,
    { min: 2, max: 120 },
  );
  addFromRegex(
    'company',
    /(?:^|[\n,;.!?]\s*)(?:ich\s+)?arbeite\s+als\s+[^\n,;!?]{1,80}\s+bei\s+([^\n,;!?]{2,120})/gi,
    { min: 2, max: 120 },
  );
  addFromRegex(
    'language',
    /(?:^|[\n,;.!?]\s*)(?:(?:ich\s+)?(?:spreche|rede)|meine?\s+sprache\s+ist)\s+([^\n,;!?]{2,120})/gi,
    { min: 2, max: 120 },
  );
  addFromRegex(
    'goal',
    /(?:^|[\n,;.!?]\s*)(?:mein\s+ziel\s+ist|(?:ich\s+)?möchte|(?:ich\s+)?will)\s+([^\n,;!?]{4,140})/gi,
    { min: 4, max: 140 },
  );
  addFromRegex(
    'project',
    /(?:^|[\n,;.!?]\s*)(?:(?:ich\s+)?arbeite\s+an|mein\s+projekt\s+ist)\s+([^\n,;!?]{3,120})/gi,
    { min: 3, max: 120 },
  );
  addFromRegex(
    'skill',
    /(?:^|[\n,;.!?]\s*)(?:(?:ich\s+)?kann|(?:ich\s+)?bin\s+gut\s+in|meine?\s+skills?\s+sind)\s+([^\n,;!?]{2,120})/gi,
    { min: 2, max: 120 },
  );
  addFromRegex(
    'birthday',
    /(?:^|[\n,;.!?]\s*)(?:(?:ich\s+)?(?:habe\s+)?geburtstag\s+am|mein\s+geburtstag\s+ist\s+am|(?:ich\s+)?bin\s+am)\s+([^\n,;!?]{2,80})/gi,
    { min: 2, max: 80 },
  );
  addFromRegex(
    'timezone',
    /(?:^|[\n,;.!?]\s*)(?:meine?\s+zeitzone\s+ist|(?:ich\s+)?bin\s+in\s+der\s+zeitzone)\s+([^\n,;!?]{2,80})/gi,
    { min: 2, max: 80 },
  );
  addFromRegex(
    'availability',
    /(?:^|[\n,;.!?]\s*)(?:(?:ich\s+)?bin\s+(?:verfügbar|verfuegbar)|(?:ich\s+)?habe\s+zeit)\s+([^\n,;!?]{2,120})/gi,
    { min: 2, max: 120 },
  );
  addFromRegex(
    'dislike',
    /(?:^|[\n,;.!?]\s*)(?:(?:ich\s+)?mag\s+nicht|(?:ich\s+)?hasse|(?:ich\s+)?vermeide)\s+([^\n,;!?]{2,120})/gi,
    { min: 2, max: 120 },
  );

  const structuredPatterns = [
    {
      key: 'location',
      pattern:
        /(?:^|[\n,;.!?]\s*)(?:ort|wohnort|location)\s*[:=-]\s*([^\n,;!?]{2,120})/gi,
    },
    {
      key: 'occupation',
      pattern:
        /(?:^|[\n,;.!?]\s*)(?:beruf|job|rolle|role)\s*[:=-]\s*([^\n,;!?]{2,120})/gi,
    },
    {
      key: 'language',
      pattern:
        /(?:^|[\n,;.!?]\s*)(?:sprache|language)\s*[:=-]\s*([^\n,;!?]{2,120})/gi,
    },
    {
      key: 'goal',
      pattern: /(?:^|[\n,;.!?]\s*)(?:ziel|goal)\s*[:=-]\s*([^\n,;!?]{2,140})/gi,
    },
    {
      key: 'timezone',
      pattern:
        /(?:^|[\n,;.!?]\s*)(?:zeitzone|timezone|tz)\s*[:=-]\s*([^\n,;!?]{2,80})/gi,
    },
  ];
  for (const item of structuredPatterns) {
    addFromRegex(item.key, item.pattern);
  }

  const favoriteMatches = text.matchAll(
    /(?:^|[\n,;.!?]\s*)mein(?:e)?\s+lieblings([a-zäöüß]+)\s+ist\s+([^\n,;!?]{2,120})/gi,
  );
  for (const favoriteMatch of favoriteMatches) {
    if (!favoriteMatch?.[1] || !favoriteMatch?.[2]) continue;
    pushFact(
      'preference',
      `${normalizeExtractedValue(favoriteMatch[1], 40)}: ${favoriteMatch[2]}`,
      { min: 4, max: 140 },
    );
  }

  const unique = [];
  const seen = new Set();
  for (const item of extracted) {
    if (
      item.key === 'interest' &&
      /^(nicht|kein|keine|keinen)\b/i.test(item.value)
    ) {
      continue;
    }
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
  const now = Date.now();
  const entries = facts
    .map((fact) =>
      normalizeMemoryEntry(
        {
          key: fact.key,
          value: fact.value,
          timestamp: now,
        },
        config,
        now,
      ),
    )
    .filter((entry) => {
      if (!entry.value) return false;
      if (entry.key === 'name' && entry.value.toLowerCase() === 'jules') {
        return false;
      }
      return true;
    });
  if (!entries.length) return [];

  const {
    entries: protectedEntries,
    existingName,
    skippedNameEntries,
  } = await filterProtectedNameEntries(env, userId, entries, config, {
    allowNameOverwrite: isExplicitNameOverwritePrompt(prompt),
  });
  if (skippedNameEntries.length > 0) {
    const conflictingNames = skippedNameEntries
      .map((entry) => entry.value)
      .filter(
        (value) => value.toLowerCase() !== existingName?.value?.toLowerCase(),
      );
    if (conflictingNames.length > 0) {
      console.info(
        `Skipped conflicting name memory for ${userId}; keeping existing name "${existingName?.value}".`,
      );
    }
  }
  const storedNameEntry = protectedEntries.find(
    (entry) => entry.key === 'name',
  );
  const matchingSkippedName = skippedNameEntries.find(
    (entry) => entry.value.toLowerCase() === existingName?.value?.toLowerCase(),
  );

  if (!protectedEntries.length) {
    if (matchingSkippedName?.value) {
      await syncUserNameLookup(env, userId, matchingSkippedName.value);
    }
    return [];
  }

  const kvStored = await saveFallbackMemoriesBatch(
    env,
    userId,
    protectedEntries,
    config,
  );

  let vectorStored = false;
  if (env.AI && env.JULES_MEMORY) {
    try {
      const texts = protectedEntries.map(
        (entry) => `${entry.key}: ${entry.value}`,
      );
      const { data } = await env.AI.run(config.embeddingModel, {
        text: texts,
      });

      if (Array.isArray(data) && data.length === protectedEntries.length) {
        await env.JULES_MEMORY.upsert(
          protectedEntries.map((entry, index) => ({
            id: `${userId}_${entry.key}_${entry.timestamp}_${index}`,
            values: data[index],
            metadata: {
              userId,
              key: entry.key,
              value: entry.value,
              category: entry.category,
              priority: entry.priority,
              timestamp: entry.timestamp,
              expiresAt: entry.expiresAt,
              text: texts[index],
            },
          })),
        );
        vectorStored = true;
      }
    } catch (error) {
      if (!error?.remote) {
        console.warn('persistPromptMemories error:', error?.message || error);
      }
    }
  }

  if (!kvStored && !vectorStored) return [];
  if (storedNameEntry?.value) {
    await syncUserNameLookup(
      env,
      userId,
      storedNameEntry.value,
      existingName?.value || '',
    );
  }
  return protectedEntries.map((entry) => ({
    ...entry,
    score: 1,
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
  const recallQueries = [
    'name',
    'location',
    'occupation',
    'company',
    'language',
    'interests',
    'skills',
    'goals',
    'projects',
    'preferences',
    'availability',
    'timezone',
    'notes',
  ];
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
  const merged = new Map();
  const upsert = (entry) => {
    const rawPriority = Number(entry?.priority);
    const rawTimestamp = Number(entry?.timestamp);
    const rawScore = Number(entry?.score);
    const normalized = {
      ...entry,
      key: normalizeMemoryKey(entry?.key),
      value: normalizeMemoryText(entry?.value),
      category: String(entry?.category || DEFAULT_MEMORY_CATEGORY),
      priority: Number.isFinite(rawPriority)
        ? rawPriority
        : DEFAULT_MEMORY_PRIORITY,
      timestamp: Number.isFinite(rawTimestamp) ? rawTimestamp : 0,
      score: Number.isFinite(rawScore) ? rawScore : 0,
    };
    if (!normalized.key || !normalized.value) return;

    const hash = SINGLETON_MEMORY_KEYS.has(normalized.key)
      ? normalized.key
      : `${normalized.key}:${normalized.value.toLowerCase()}`;
    const existing = merged.get(hash);

    if (
      !existing ||
      normalized.timestamp > existing.timestamp ||
      (normalized.timestamp === existing.timestamp &&
        normalized.priority > existing.priority)
    ) {
      merged.set(hash, normalized);
    }
  };

  recalled.forEach(upsert);
  stored.forEach(upsert);

  return [...merged.values()].sort((a, b) =>
    b.priority === a.priority
      ? (b.timestamp || 0) - (a.timestamp || 0)
      : (b.priority || 0) - (a.priority || 0),
  );
}

function getProfileNameFromMemories(memories = []) {
  const nameEntry = getLatestMemoryEntry(memories, 'name');
  return normalizeNameCandidate(nameEntry?.value || '');
}

function buildProfileInfo(userId, name = '', status = '') {
  const normalizedName = normalizeNameCandidate(name);
  const normalizedUserId = normalizeUserId(userId);
  const resolvedStatus =
    status ||
    (normalizedName
      ? 'identified'
      : normalizedUserId
        ? 'anonymous'
        : 'disconnected');

  return {
    userId: normalizedUserId,
    name: normalizedName,
    status: resolvedStatus,
    label:
      resolvedStatus === 'identified'
        ? `Profil: ${normalizedName}`
        : resolvedStatus === 'recovery-pending'
          ? `Profil gefunden: ${normalizedName}`
          : resolvedStatus === 'conflict'
            ? `Profil unklar: ${normalizedName}`
            : resolvedStatus === 'disconnected'
              ? 'Kein aktives Profil'
              : 'Profil: neu',
  };
}

function buildResponsePayload(
  text,
  clientToolCalls,
  serverToolResults,
  ctx,
  config,
  profile,
  recovery = null,
) {
  return {
    text,
    toolCalls: clientToolCalls,
    model: config.chatModel,
    hasMemory: !!ctx.memoryContext,
    hasImage: !!ctx.imageAnalysis,
    profile,
    recovery,
    ...(serverToolResults.length && {
      toolResults: serverToolResults.map((r) => r.name),
    }),
  };
}

function inferClientToolCallsFromPrompt(prompt) {
  const rawText = String(prompt || '');
  const text = rawText.toLowerCase();
  if (!text.trim()) return [];

  const inferred = [];
  const addTool = (name, args = {}) => {
    if (inferred.some((item) => item.name === name)) return;
    inferred.push({ name, arguments: args });
  };

  if (
    /(welche|was).*(erinner|gemerkt|gespeichert)|(was|welche).*(wei(?:ß|ss)t).*(über mich|ueber mich)|zeig.*(erinner|gespeichert)/i.test(
      rawText,
    )
  ) {
    addTool('recallMemory', { query: 'all memories' });
  }

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

  const externalUrlMatch = rawText.match(/https?:\/\/[^\s)\]}]+/i);
  if (
    externalUrlMatch?.[0] &&
    /(öffn|oeffn|open|besuch|gehe zu|link)/i.test(text)
  ) {
    addTool('openExternalLink', { url: externalUrlMatch[0], newTab: true });
  }

  const socialOpenIntent =
    /(social|profil|account|seite|kanal|öffn|oeffn|zeige)/i.test(text);
  if (socialOpenIntent) {
    if (/\bgithub\b/i.test(text))
      addTool('openSocialProfile', { platform: 'github' });
    else if (/\blinkedin\b/i.test(text))
      addTool('openSocialProfile', { platform: 'linkedin' });
    else if (/\binstagram\b/i.test(text))
      addTool('openSocialProfile', { platform: 'instagram' });
    else if (/\byoutube\b/i.test(text))
      addTool('openSocialProfile', { platform: 'youtube' });
    else if (/\b(?:x|twitter)\b/i.test(text))
      addTool('openSocialProfile', { platform: 'x' });
  }

  if (
    /(mail|e-?mail)/i.test(text) &&
    /(schreib|sende|kontakt|entwurf)/i.test(text)
  ) {
    const toMatch = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const subjectMatch = rawText.match(
      /(?:betreff|subject)\s*[:-]\s*([^\n\r]{3,120})/i,
    );
    addTool('composeEmail', {
      to: toMatch?.[0] || 'krm19030@gmail.com',
      subject: subjectMatch?.[1]?.trim() || '',
    });
  }

  if (
    /(kalender|calendar|erinner|reminder|termin)/i.test(text) &&
    /(erstell|anleg|hinzuf|mach|setze|plan)/i.test(text)
  ) {
    const titleMatch = rawText.match(
      /(?:für|fuer|zu|titel)\s+([^\n\r.,!?]{3,80})/i,
    );
    const dateMatch = rawText.match(
      /\b(20\d{2}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{2,4})\b/,
    );
    addTool('createCalendarReminder', {
      title: titleMatch?.[1]?.trim() || 'Erinnerung',
      date: dateMatch?.[1] || new Date().toISOString().slice(0, 10),
      details: rawText.slice(0, 240),
    });
  }

  return inferred;
}

function schedulePromptMemoryPersistence(context, env, userId, prompt, config) {
  const task = persistPromptMemories(env, userId, prompt, config).catch(
    (error) => {
      if (!error?.remote) {
        console.warn(
          'schedulePromptMemoryPersistence error:',
          error?.message || error,
        );
      }
      return [];
    },
  );

  if (typeof context?.waitUntil === 'function') {
    context.waitUntil(task);
    return;
  }

  task.catch(() => {});
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
      config,
    );
    const userId = identity.userId;
    const wasAutoRecovered = identity.wasAutoRecovered;
    const recovery = identity.recovery || null;
    const userRole = resolveUserToolRole(config, userId);
    const allowedToolDefinitions = getAllowedToolDefinitions(
      config,
      userRole,
      prompt,
    );
    const availableTools = allowedToolDefinitions.map((tool) =>
      toOpenAiTool(tool),
    );
    const availableToolNames = allowedToolDefinitions.map((tool) => tool.name);
    if (!prompt && !imageAnalysis) {
      const emptyHeaders = withUserIdHeader(corsHeaders, userId);
      appendSetCookie(emptyHeaders, buildUserIdCookie(request, userId));
      return Response.json(
        { error: 'Empty prompt', text: 'Kein Prompt empfangen.' },
        { status: 400, headers: emptyHeaders },
      );
    }

    if (!env.AI) {
      const unavailableHeaders = withUserIdHeader(corsHeaders, userId);
      appendSetCookie(unavailableHeaders, buildUserIdCookie(request, userId));
      return Response.json(
        {
          error: 'AI service not configured',
          text: 'KI-Dienst nicht verfügbar.',
          toolCalls: [],
          retryable: false,
        },
        { status: 500, headers: unavailableHeaders },
      );
    }

    if (recovery?.status === 'needs_confirmation') {
      return Response.json(
        {
          userId: '',
          ...buildResponsePayload(
            `Ich habe ein bestehendes Profil für ${recovery.name} gefunden. Laden?`,
            [],
            [],
            { memoryContext: '', imageAnalysis },
            config,
            buildProfileInfo('', recovery.name, 'recovery-pending'),
            recovery,
          ),
        },
        { headers: corsHeaders },
      );
    }

    if (recovery?.status === 'conflict') {
      return Response.json(
        {
          userId: '',
          ...buildResponsePayload(
            `Für den Namen ${recovery.name} gibt es mehrere Profile. Bitte bestätige dein Profil.`,
            [],
            [],
            { memoryContext: '', imageAnalysis },
            config,
            buildProfileInfo('', recovery.name, 'conflict'),
            recovery,
          ),
        },
        { headers: corsHeaders },
      );
    }

    const jsonHeaders = withUserIdHeader(corsHeaders, userId);
    const sseResponseHeaders = withUserIdHeader(sseHeaders, userId);
    const userIdCookie = buildUserIdCookie(request, userId);
    appendSetCookie(jsonHeaders, userIdCookie);
    appendSetCookie(sseResponseHeaders, userIdCookie);

    schedulePromptMemoryPersistence(context, env, userId, prompt, config);

    // ── Parallel: bounded memory + bounded RAG ──
    const [recalledMemories, ragContext] = await Promise.all([
      withTimeout(
        () => resolveMemoryContext(env, userId, prompt, config),
        config.contextTimeoutMs,
        {
          fallbackValue: [],
        },
      ),
      getRAGContext(prompt, env, config),
    ]);

    const memoryContext =
      recalledMemories.length > 0
        ? recalledMemories
            .slice(0, Math.max(config.maxMemoryResults, 8))
            .map(
              (m) =>
                `- ${m.key} (${m.category}, Priorität ${m.priority}): ${m.value}`,
            )
            .join('\n')
        : '';
    const activeProfileName =
      getProfileNameFromMemories(recalledMemories) ||
      (
        await withTimeout(
          () => getStoredNameEntry(env, userId, config),
          Math.min(250, config.contextTimeoutMs),
          {
            fallbackValue: null,
          },
        )
      )?.value ||
      '';
    const profile = buildProfileInfo(userId, activeProfileName);

    const ragText = ragContext?.prompt || '';

    // ── Build messages ──
    let systemPrompt = buildSystemPrompt(memoryContext, imageAnalysis, {
      userRole,
      availableTools: availableToolNames,
      ragSources: ragContext?.sources || [],
    });
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

    if (wasAutoRecovered) {
      messages.push({
        role: 'system',
        content: `WICHTIGER HINWEIS: Du hast den Nutzer gerade an seinem Namen wiedererkannt und sein gespeichertes Profil geladen! Die gesendeten Erinnerungen gehören zu ihm. Begrüße ihn herzlich zurück.`,
      });
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
        profile,
        null,
        userRole,
        availableTools,
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

          // Tools stay enabled so memory and explicit UI actions can run.
          const useTools = promptNeedsTools(prompt);
          const aiParams = {
            messages,
            temperature: 0.7,
            max_tokens: config.maxTokens,
          };
          if (useTools && availableTools.length > 0)
            aiParams.tools = availableTools;

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
              profile,
              null,
              messages,
              responseText,
              userRole,
              config,
            );
          } else if (responseText) {
            await write('status', { phase: 'streaming' });
            const words = responseText.match(/\S+\s*/g) || [responseText];
            for (const word of words) {
              await write('token', { text: word });
            }
            await write('message', {
              ...buildResponsePayload(
                responseText,
                [],
                [],
                { memoryContext, imageAnalysis },
                config,
                profile,
                null,
              ),
            });
          } else {
            await write('message', {
              ...buildResponsePayload(
                'Keine Antwort erhalten.',
                [],
                [],
                { memoryContext, imageAnalysis },
                config,
                profile,
                null,
              ),
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

function buildMsg(
  text,
  clientToolCalls,
  serverToolResults,
  ctx,
  config,
  profile,
  recovery = null,
) {
  return buildResponsePayload(
    text,
    clientToolCalls,
    serverToolResults,
    ctx,
    config,
    profile,
    recovery,
  );
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
  profile,
  recovery,
  messages = [],
  existingText = '',
  userRole,
  config,
) {
  const { clientToolCalls, serverToolResults } = await classifyToolCalls(
    env,
    toolCalls,
    userId,
    config,
    userRole,
    messages[messages.length - 1]?.content || '',
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
      meta: ct.meta,
      status: 'client',
      isServerTool: false,
    });
  }

  const recallResult = serverToolResults.find(
    (item) => item.name === 'recallMemory',
  );
  if (recallResult && clientToolCalls.length === 0) {
    const loadedContext = String(ctx?.memoryContext || '').trim();
    const text = loadedContext
      ? `Bekannte Infos:\n${loadedContext}`
      : recallResult.result === 'Keine Erinnerungen gefunden.'
        ? 'Ich habe aktuell keine gespeicherten Erinnerungen für diese User-ID.'
        : recallResult.result;
    for (const word of text.match(/\S+\s*/g) || [text]) {
      await write('token', { text: word });
    }
    await write(
      'message',
      buildMsg(
        text,
        clientToolCalls,
        serverToolResults,
        ctx,
        config,
        profile,
        recovery,
      ),
    );
    return;
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
          buildMsg(
            text,
            clientToolCalls,
            serverToolResults,
            ctx,
            config,
            profile,
            recovery,
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
      if (hasMeaningfulText(fallbackText)) {
        await write('message', {
          ...buildMsg(
            fallbackText,
            clientToolCalls,
            serverToolResults,
            ctx,
            config,
            profile,
            recovery,
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
            profile,
            recovery,
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
      profile,
      recovery,
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
  profile,
  recovery,
  userRole,
  availableTools,
  config,
) {
  try {
    // Tools stay enabled so memory and explicit UI actions can run.
    const useTools = promptNeedsTools(
      messages[messages.length - 1]?.content || '',
    );
    const aiParams = {
      messages,
      temperature: 0.7,
      max_tokens: config.maxTokens,
    };
    if (useTools && availableTools.length > 0) aiParams.tools = availableTools;

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
      userRole,
      messages[messages.length - 1]?.content || '',
    );

    const recallResult = serverToolResults.find(
      (item) => item.name === 'recallMemory',
    );
    if (recallResult && clientToolCalls.length === 0) {
      const loadedContext = String(ctx?.memoryContext || '').trim();
      const text = loadedContext
        ? `Bekannte Infos:\n${loadedContext}`
        : recallResult.result === 'Keine Erinnerungen gefunden.'
          ? 'Ich habe aktuell keine gespeicherten Erinnerungen für diese User-ID.'
          : recallResult.result;

      return Response.json(
        {
          userId,
          ...buildResponsePayload(
            text,
            clientToolCalls,
            serverToolResults,
            ctx,
            config,
            profile,
            recovery,
          ),
        },
        { headers: corsHeaders },
      );
    }

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
        ...buildResponsePayload(
          responseText ||
            (clientToolCalls.length
              ? 'Aktion wird ausgeführt…'
              : 'Keine Antwort.'),
          clientToolCalls,
          serverToolResults,
          ctx,
          config,
          profile,
          recovery,
        ),
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
export const __test__ = {
  extractNameFromPrompt,
  extractRecoveryLookupNameFromPrompt,
  extractPromptMemoryFacts,
  getStoredNameEntry,
  isExplicitNameOverwritePrompt,
  isExplicitSelfNamePrompt,
  storeMemory,
  withTimeout,
  getRAGContext,
  persistPromptMemories,
  resolveMemoryContext,
  resolveUserIdentity,
  schedulePromptMemoryPersistence,
};
