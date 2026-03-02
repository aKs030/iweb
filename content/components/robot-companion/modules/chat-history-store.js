const DEFAULT_HISTORY_KEY = 'robot-chat-history';
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
 * Persists chat history and handles legacy format migration.
 */
export class ChatHistoryStore {
  constructor({
    storageKey = DEFAULT_HISTORY_KEY,
    limit = DEFAULT_HISTORY_LIMIT,
  } = {}) {
    this.storageKey = storageKey;
    this.limit = limit;
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const parsed = JSON.parse(raw || '[]');
      if (!Array.isArray(parsed)) return [];

      const now = Date.now();
      const normalized = parsed
        .map((entry, index) =>
          normalizeEntry(entry, now - (parsed.length - index) * 1000),
        )
        .filter(Boolean);

      return normalized.slice(-this.limit);
    } catch {
      return [];
    }
  }

  save(history) {
    try {
      const safe = Array.isArray(history) ? history.slice(-this.limit) : [];
      localStorage.setItem(this.storageKey, JSON.stringify(safe));
    } catch {
      /* ignore */
    }
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
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      /* ignore */
    }
  }

  download(history, filePrefix = 'jules-chat-export') {
    if (!Array.isArray(history) || history.length === 0) return false;

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        messageCount: history.length,
        messages: history,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });

      const today = new Date();
      const yyyy = String(today.getFullYear());
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');

      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `${filePrefix}-${yyyy}-${mm}-${dd}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 0);
      return true;
    } catch {
      return false;
    }
  }
}
