const DEFAULT_HISTORY_LIMIT = 40;

const normalizeRole = (role) => {
  const value = String(role || '').toLowerCase();
  if (value === 'user') return 'user';
  if (value === 'bot' || value === 'assistant' || value === 'model') {
    return 'model';
  }
  return 'system';
};

function generateId() {
  try {
    if (globalThis.crypto?.randomUUID) {
      return `msg_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    }
    if (globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(12);
      globalThis.crypto.getRandomValues(bytes);
      const token = Array.from(
        bytes,
        (byte) => byte.toString(16).padStart(2, '0'),
      ).join('');
      return `msg_${token}`;
    }
  } catch {
    /* ignore crypto access failures */
  }

  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

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

  serialize(history, { format = 'txt' } = {}) {
    const entries = Array.isArray(history) ? history : [];
    if (format === 'json') {
      return JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          count: entries.length,
          messages: entries,
        },
        null,
        2,
      );
    }

    return entries
      .map((entry) => {
        const role = String(entry?.role || 'system').toUpperCase();
        const timestamp =
          typeof entry?.timestamp === 'number'
            ? new Date(entry.timestamp).toISOString()
            : new Date().toISOString();
        const text = String(entry?.text || '').trim();
        return `[${timestamp}] ${role}\n${text}`;
      })
      .join('\n\n');
  }

  download(history, { format = 'txt' } = {}) {
    const exportText = this.serialize(history, { format });

    if (typeof document === 'undefined') return exportText;

    const blob = new Blob([exportText], {
      type:
        format === 'json'
          ? 'application/json;charset=utf-8'
          : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jules-chat-${new Date().toISOString().replace(/[:.]/g, '-')}.${format === 'json' ? 'json' : 'txt'}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return exportText;
  }
}
