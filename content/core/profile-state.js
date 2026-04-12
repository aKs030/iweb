import { normalizeSchemaText } from './text-utils.js';
import { normalizeUserId } from './user-id.js';

const PROFILE_STATUSES = new Set([
  'identified',
  'anonymous',
  'recovery-pending',
  'conflict',
  'disconnected',
]);

const RECOVERY_STATUSES = new Set(['needs_confirmation', 'conflict', 'none']);

function parseNonNegativeInteger(value) {
  return Math.max(0, Number.parseInt(String(value), 10) || 0);
}

function buildProfileLabel(status, name) {
  if (status === 'identified') return `Profil: ${name}`;
  if (status === 'recovery-pending') return `Profil gefunden: ${name}`;
  if (status === 'conflict') return `Profil unklar: ${name}`;
  if (status === 'disconnected') return 'Kein aktives Profil';
  return 'Profil: neu';
}

function hasOwnValue(object, key) {
  return !!object && Object.prototype.hasOwnProperty.call(object, key);
}

function deriveRecoveryStatus(rawStatus, candidates = []) {
  const normalized = normalizeSchemaText(rawStatus).toLowerCase();
  if (RECOVERY_STATUSES.has(normalized)) return normalized;
  if (candidates.length === 0) return 'none';
  return candidates.length === 1 ? 'needs_confirmation' : 'conflict';
}

function resolvePayloadUserId(payload, fallbackUserId = '') {
  const profile = payload?.profile && typeof payload.profile === 'object'
    ? payload.profile
    : null;

  if (hasOwnValue(payload, 'userId')) {
    return {
      hasExplicitUserId: true,
      userId: normalizeUserId(payload?.userId),
    };
  }

  if (hasOwnValue(profile, 'userId')) {
    return {
      hasExplicitUserId: true,
      userId: normalizeUserId(profile?.userId),
    };
  }

  return {
    hasExplicitUserId: false,
    userId: normalizeUserId(fallbackUserId),
  };
}

export function normalizeProfileStatus(raw) {
  const value = normalizeSchemaText(raw).toLowerCase();
  return PROFILE_STATUSES.has(value) ? value : 'anonymous';
}

export function createProfileState(overrides = {}) {
  const userId = normalizeUserId(overrides.userId);
  const name = normalizeSchemaText(overrides.name || '');
  const status = normalizeProfileStatus(
    overrides.status ||
      (name ? 'identified' : userId ? 'anonymous' : 'disconnected'),
  );
  const label =
    normalizeSchemaText(overrides.label || '') || buildProfileLabel(status, name);

  return { userId, name, status, label };
}

export function normalizeRecoveryCandidate(raw, { source } = {}) {
  const userId = normalizeUserId(raw?.userId);
  if (!userId) return null;

  const candidate = {
    userId,
    name: normalizeSchemaText(raw?.name || ''),
    status: normalizeProfileStatus(raw?.status || 'anonymous'),
    memoryCount: parseNonNegativeInteger(raw?.memoryCount),
    latestMemoryAt: parseNonNegativeInteger(raw?.latestMemoryAt),
  };

  const candidateSource = normalizeSchemaText((source ?? raw?.source) || '');
  if (candidateSource) {
    candidate.source = candidateSource;
  }

  return candidate;
}

export function createRecoveryState(
  raw = {},
  { allowNone = false, limit = 5 } = {},
) {
  const candidates = Array.isArray(raw?.candidates)
    ? raw.candidates
        .map((candidate) => normalizeRecoveryCandidate(candidate))
        .filter(Boolean)
        .slice(0, limit)
    : [];

  const status = deriveRecoveryStatus(raw?.status, candidates);
  if (!RECOVERY_STATUSES.has(status)) return null;
  if (status === 'none' && !allowNone) return null;

  return {
    status,
    name: normalizeSchemaText(raw?.name || ''),
    candidateUserId:
      normalizeUserId(raw?.candidateUserId) || candidates[0]?.userId || '',
    autoCandidateUserId:
      normalizeUserId(raw?.autoCandidateUserId) || '',
    candidates,
  };
}

export function resolveProfileStatePayload(
  payload = {},
  { fallbackUserId = '', currentProfile = {} } = {},
) {
  const { hasExplicitUserId, userId } = resolvePayloadUserId(
    payload,
    fallbackUserId,
  );
  let profile = userId
    ? createProfileState({
        userId,
        name: currentProfile?.name || '',
        status: currentProfile?.name ? 'identified' : 'anonymous',
      })
    : createProfileState({ userId: '', name: '', status: 'disconnected' });

  if (payload?.profile && typeof payload.profile === 'object') {
    profile = createProfileState({
      userId,
      ...payload.profile,
    });
  }

  const recovery = createRecoveryState(payload?.recovery);
  if (recovery?.status === 'needs_confirmation') {
    profile = createProfileState({
      ...profile,
      userId,
      name: recovery.name,
      status: 'recovery-pending',
    });
  } else if (recovery?.status === 'conflict') {
    profile = createProfileState({
      ...profile,
      userId,
      name: recovery.name,
      status: 'conflict',
    });
  }

  return { hasExplicitUserId, userId, profile, recovery };
}
