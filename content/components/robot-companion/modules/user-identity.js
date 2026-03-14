/**
 * User Identity & Profile State – Extracted from ai-agent-service.js
 * Manages user ID persistence, profile state and recovery normalisation.
 * @version 1.0.0
 */

const USER_ID_STORAGE_KEY = "jules:user-id";
const MAX_HISTORY = 20;

let runtimeUserId = "";
let runtimeConversationHistory = [];
let runtimeProfileState = createProfileState();
let runtimeProfileRecovery = null;

// ─── Normalisation Helpers ──────────────────────────────────────────────────────

export function normalizeUserId(raw) {
  const value = String(raw || "").trim();
  if (!value || value === "anonymous") return "";
  if (!/^[A-Za-z0-9_-]{3,120}$/.test(value)) return "";
  return value;
}

function normalizeProfileStatus(raw) {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  return [
    "identified",
    "anonymous",
    "recovery-pending",
    "conflict",
    "disconnected",
  ].includes(value)
    ? value
    : "anonymous";
}

export function createProfileState(overrides = {}) {
  const userId = normalizeUserId(overrides.userId);
  const name = String(overrides.name || "").trim();
  const status = normalizeProfileStatus(
    overrides.status ||
      (name ? "identified" : userId ? "anonymous" : "disconnected"),
  );
  const label =
    String(overrides.label || "").trim() ||
    (status === "identified"
      ? `Profil: ${name}`
      : status === "recovery-pending"
        ? `Profil gefunden: ${name}`
        : status === "conflict"
          ? `Profil unklar: ${name}`
          : status === "disconnected"
            ? "Kein aktives Profil"
            : "Profil: neu");

  return { userId, name, status, label };
}

export function normalizeRecoveryState(raw) {
  const status = String(raw?.status || "")
    .trim()
    .toLowerCase();
  if (!["needs_confirmation", "conflict"].includes(status)) return null;

  return {
    status,
    name: String(raw?.name || "").trim(),
    candidateUserId: normalizeUserId(raw?.candidateUserId),
  };
}

// ─── Profile State ──────────────────────────────────────────────────────────────

export function setProfileState(nextState = {}) {
  runtimeProfileState = createProfileState({
    ...runtimeProfileState,
    ...nextState,
  });
  return getProfileState();
}

export function setRecoveryState(nextRecovery = null) {
  runtimeProfileRecovery = normalizeRecoveryState(nextRecovery);
  return getProfileState();
}

export function resetProfileState({ clearUserId = false } = {}) {
  if (clearUserId) {
    runtimeProfileState = createProfileState({
      userId: "",
      name: "",
      status: "disconnected",
    });
  } else {
    runtimeProfileState = createProfileState({
      userId: getUserId(),
      name: "",
      status: getUserId() ? "anonymous" : "disconnected",
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
  const userId = normalizeUserId(payload?.userId) || getUserId();
  if (userId) {
    setProfileState({ userId });
  } else {
    resetProfileState({ clearUserId: true });
  }

  if (payload?.profile) {
    setProfileState(payload.profile);
  } else if (userId) {
    setProfileState({
      userId,
      status: runtimeProfileState.name ? "identified" : "anonymous",
    });
  }

  if (payload?.recovery) {
    setRecoveryState(payload.recovery);
    if (runtimeProfileRecovery?.status === "needs_confirmation") {
      setProfileState({
        userId,
        name: runtimeProfileRecovery.name,
        status: "recovery-pending",
      });
    } else if (runtimeProfileRecovery?.status === "conflict") {
      setProfileState({
        userId,
        name: runtimeProfileRecovery.name,
        status: "conflict",
      });
    }
  } else {
    setRecoveryState(null);
  }

  return getProfileState();
}

export function shouldPersistIdentityFromPayload(payload = {}) {
  return !normalizeRecoveryState(payload?.recovery);
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

export function getUserId() {
  if (!runtimeUserId) {
    runtimeUserId = loadPersistedUserId();
    if (runtimeUserId) {
      setProfileState({
        userId: runtimeUserId,
        status: runtimeProfileState.name
          ? runtimeProfileState.status
          : "anonymous",
      });
    }
  }
  return normalizeUserId(runtimeUserId);
}

export function persistUserId(id) {
  const value = normalizeUserId(id);
  if (!value) {
    clearPersistedUserId();
    return "";
  }
  runtimeUserId = value;
  setProfileState({
    userId: value,
    status: runtimeProfileState.name ? runtimeProfileState.status : "anonymous",
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
  runtimeUserId = "";
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
    response?.headers?.get?.("x-jules-user-id"),
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
