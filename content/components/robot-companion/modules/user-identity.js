/**
 * User Identity & Profile State – Extracted from ai-agent-service.js
 * Manages user ID persistence, profile state and recovery normalisation.
 * @version 1.0.0
 */

import { normalizeUserId } from '#core/user-id.js';
import {
  createProfileState,
  createRecoveryState,
  resolveProfileStatePayload,
} from '#core/profile-state.js';

const USER_ID_STORAGE_KEY = 'jules:user-id';
const MAX_HISTORY = 20;

let runtimeUserId = '';
let runtimeConversationHistory = [];
let runtimeProfileState = createProfileState();
let runtimeProfileRecovery = null;

// ─── Normalisation Helpers ──────────────────────────────────────────────────────

export { createProfileState };

// ─── Profile State ──────────────────────────────────────────────────────────────

export function setProfileState(nextState = {}) {
  runtimeProfileState = createProfileState({
    ...runtimeProfileState,
    ...nextState,
  });
  return getProfileState();
}

export function resetProfileState({ clearUserId = false } = {}) {
  if (clearUserId) {
    runtimeProfileState = createProfileState({
      userId: '',
      name: '',
      status: 'disconnected',
    });
  } else {
    runtimeProfileState = createProfileState({
      userId: getUserId(),
      name: '',
      status: getUserId() ? 'anonymous' : 'disconnected',
    });
  }
  runtimeProfileRecovery = null;
  return getProfileState();
}

export function getProfileState() {
  return {
    ...runtimeProfileState,
    recovery: runtimeProfileRecovery ? { ...runtimeProfileRecovery } : null,
  };
}

export function syncProfileStateFromPayload(payload = {}) {
  const { userId, profile, recovery } = resolveProfileStatePayload(payload, {
    fallbackUserId: getUserId(),
    currentProfile: runtimeProfileState,
  });
  runtimeUserId = userId;
  runtimeProfileState = profile;
  runtimeProfileRecovery = recovery;
  return getProfileState();
}

// ─── User ID Persistence ────────────────────────────────────────────────────────

function getUserIdStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function loadPersistedUserId() {
  const storage = getUserIdStorage();
  if (!storage?.getItem) return '';
  try {
    return normalizeUserId(storage.getItem(USER_ID_STORAGE_KEY));
  } catch {
    return '';
  }
}

export function getUserId() {
  if (!runtimeUserId) {
    runtimeUserId = loadPersistedUserId();
    if (runtimeUserId) {
      setProfileState({
        userId: runtimeUserId,
        status: runtimeProfileState.name
          ? runtimeProfileState.status
          : 'anonymous',
      });
    }
  }
  return normalizeUserId(runtimeUserId);
}

export function persistUserId(id) {
  const value = normalizeUserId(id);
  if (!value) {
    clearPersistedUserId();
    return '';
  }
  runtimeUserId = value;
  setProfileState({
    userId: value,
    status: runtimeProfileState.name ? runtimeProfileState.status : 'anonymous',
  });
  const storage = getUserIdStorage();
  if (storage?.setItem) {
    try {
      storage.setItem(USER_ID_STORAGE_KEY, value);
    } catch {
      /* ignore storage failures */
    }
  }
  return value;
}

export function clearPersistedUserId() {
  runtimeUserId = '';
  resetProfileState({ clearUserId: true });
  const storage = getUserIdStorage();
  if (!storage?.removeItem) return;
  try {
    storage.removeItem(USER_ID_STORAGE_KEY);
  } catch {
    /* ignore storage failures */
  }
}

export function syncUserIdFromResponse(response) {
  const headerValue = normalizeUserId(
    response?.headers?.get?.('x-jules-user-id'),
  );
  if (headerValue) persistUserId(headerValue);
}

// ─── Conversation History ───────────────────────────────────────────────────────

export function getHistory() {
  return runtimeConversationHistory.slice(-MAX_HISTORY);
}

export function saveHistory(history) {
  runtimeConversationHistory = Array.isArray(history)
    ? history.slice(-MAX_HISTORY)
    : [];
}

export function addToHistory(role, content) {
  const history = getHistory();
  history.push({ role, content, timestamp: Date.now() });
  saveHistory(history);
}

export function clearHistory() {
  runtimeConversationHistory = [];
}
