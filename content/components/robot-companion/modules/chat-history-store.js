const DEFAULT_HISTORY_LIMIT = 40;

const normalizeRole = (role) => {
  const value = String(role || '').toLowerCase();
  if (value === 'user') return 'user';
  if (value === 'bot' || value === 'assistant' || value === 'model') {
    return 'model';
  }
  return 'system';
};

const generateId = () =>
  `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeEntry = (entry, fallbackTimestamp) => {
  if (!entry || typeof entry !== 'object') return null;

  const text = String(entry.text || entry.content || '').trim();
  if (!text) return null;

  const timestamp =
    typeof entry.timestamp === 'number' && Number.isFinite(entry.timestamp)
      ? entry.timestamp
      : fallbackTimestamp;

  return {
    id: entry.id || generateId(),
    role: normalizeRole(entry.role),
    text,
    timestamp,
  };
};

/**
 * Keeps chat history in memory for the current page session only.
 */
export class ChatHistoryStore {
  constructor({ limit = DEFAULT_HISTORY_LIMIT } = {}) {
    this.limit = limit;
    this.memoryHistory = [];
  }

  load() {
    return this.memoryHistory.slice(-this.limit);
  }

  save(history) {
    const safe = Array.isArray(history) ? history.slice(-this.limit) : [];
    this.memoryHistory = safe;
  }

  append(history, entry) {
    const normalized = normalizeEntry(entry, Date.now());
    if (!normalized) return Array.isArray(history) ? history : [];

    const next = [...(Array.isArray(history) ? history : []), normalized].slice(
      -this.limit,
    );
    this.save(next);
    return next;
  }

  clear() {
    this.memoryHistory = [];
  }
}
