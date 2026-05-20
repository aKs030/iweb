/**
 * User Identity & Profile State – Extracted from ai-agent-service.js
 * Manages user ID persistence, profile state and recovery normalisation.
 * @version 1.0.0
 */

import { createProfileState, resolveProfileStatePayload } from "../../../core/state/profile-state.js";
import { normalizeUserId } from "../../../core/user-id.js";

const USER_ID_STORAGE_KEY = "jules:user-id";

let runtimeUserId = "";
let runtimeProfileState = createProfileState();
let runtimeProfileRecovery = null;

// ─── Profile State ──────────────────────────────────────────────────────────────

function setProfileState(nextState = {}) {
  runtimeProfileState = createProfileState({
    ...runtimeProfileState,
    ...nextState,
  });
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
  if (!storage?.getItem) return "";
  try {
    return normalizeUserId(storage.getItem(USER_ID_STORAGE_KEY));
  } catch {
    return "";
  }
}

function getUserId() {
  if (!runtimeUserId) {
    runtimeUserId = loadPersistedUserId();
    if (runtimeUserId) {
      setProfileState({
        userId: runtimeUserId,
        status: runtimeProfileState.name ? runtimeProfileState.status : "anonymous",
      });
    }
  }
  return normalizeUserId(runtimeUserId);
}
