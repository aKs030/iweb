/**
 * Robot Chat Profile Manager – Extracted from robot-chat.js
 * Handles profile recovery, memory editor, profile switching.
 * @version 1.0.0
 */

// ─── Formatting ─────────────────────────────────────────────────────────

/**
 * Format Cloudflare memories into a detailed chat message.
 * @param {Array} memories
 * @param {number} retentionDays
 * @returns {string}
 */
export function formatCloudflareMemoriesMessage(
  memories = [],
  retentionDays = 0,
) {
  if (!Array.isArray(memories) || memories.length === 0) {
    return 'Aktuell sind keine Erinnerungen gespeichert.';
  }

  const lines = memories.map((entry) => {
    const key = String(entry?.key || 'memory');
    const value = String(entry?.value || '').trim() || '(leer)';
    const category = String(entry?.category || 'note').trim() || 'note';
    const priority = Number.parseInt(String(entry?.priority || ''), 10);
    const priorityText = Number.isFinite(priority)
      ? `Prioritaet ${priority}`
      : 'Prioritaet n/a';
    const timestamp = Number(entry?.timestamp || 0);
    const tsText =
      Number.isFinite(timestamp) && timestamp > 0
        ? new Date(timestamp).toLocaleString('de-DE')
        : 'unbekannt';
    return `- **${key}** (${category}, ${priorityText}): ${value} _(Zeit: ${tsText})_`;
  });

  const retentionInfo =
    Number.isFinite(Number(retentionDays)) && Number(retentionDays) > 0
      ? `\n\n_Auto-Retention: ${Number(retentionDays)} Tage_`
      : '';
  return (
    [`**Gespeicherte Erinnerungen:**`, ...lines].join('\n') + retentionInfo
  );
}

// ─── Name Detection ─────────────────────────────────────────────────────────────

const PROFILE_NAME_CAPTURE_STATUSES = new Set(['disconnected', 'anonymous']);
const STANDALONE_NAME_PREFIX_PATTERN =
  /^(?:(?:hallo|hi|hey|moin|servus)\b|guten\s+(?:tag|morgen|abend)\b)[\s,!:.-]*/i;
const STANDALONE_NAME_STOPWORDS = new Set([
  'ich',
  'bin',
  'mein',
  'meine',
  'meinen',
  'name',
  'ist',
  'hilfe',
  'help',
  'problem',
  'frage',
  'test',
  'start',
  'ja',
  'nein',
  'okay',
  'ok',
  'bitte',
  'danke',
  'hallo',
  'hi',
  'hey',
  'moin',
  'servus',
  'profil',
  'neu',
  'anderes',
]);

function normalizeChatInput(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Try to extract a standalone name from user input.
 * @param {string} text
 * @returns {string}
 */
export function extractStandaloneNameCandidate(text) {
  let normalized = normalizeChatInput(text)
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.,;:!?]+$/g, '');
  if (!normalized) return '';

  normalized = normalized.replace(STANDALONE_NAME_PREFIX_PATTERN, '').trim();
  if (!normalized) return '';

  let isIchBinPrompt = false;
  const ichBinMatch = normalized.match(/^ich\s+bin\s+(.+)$/i);
  if (ichBinMatch?.[1]) {
    normalized = normalizeChatInput(ichBinMatch[1]);
    isIchBinPrompt = true;
  }

  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'' -]{1,39}$/.test(normalized)) {
    return '';
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens.length > 3) return '';

  const lowerTokens = tokens.map((token) => token.toLowerCase());
  if (lowerTokens.some((token) => STANDALONE_NAME_STOPWORDS.has(token))) {
    return '';
  }

  if (
    isIchBinPrompt &&
    tokens.length === 1 &&
    !/^[A-ZÀ-ÖØ-Þ]/.test(tokens[0])
  ) {
    return '';
  }

  return normalized;
}

/**
 * Normalise a user prompt – auto-detect bare names and prefix them for the AI.
 * @param {string} prompt
 * @param {{ status?: string, recovery?: object }} profileState
 * @returns {string}
 */
export function normalizePromptForProfileRecovery(prompt, profileState = {}) {
  const normalizedPrompt = normalizeChatInput(prompt);
  const status = String(profileState?.status || '').trim();

  if (
    !normalizedPrompt ||
    !PROFILE_NAME_CAPTURE_STATUSES.has(status) ||
    profileState?.recovery
  ) {
    return normalizedPrompt;
  }

  const detectedName = extractStandaloneNameCandidate(normalizedPrompt);
  if (!detectedName) return normalizedPrompt;

  return `Mein Name ist ${detectedName}`;
}

// ─── Profile Card DOM Creation ──────────────────────────────────────────────────

/**
 * Create a generic profile card element.
 */
export function createProfileCard({
  kind = 'recovery',
  title = '',
  text = '',
  actions = [],
}) {
  const card = document.createElement('div');
  card.className = 'chat-profile-card';
  card.dataset.cardKind = kind;

  const titleEl = document.createElement('div');
  titleEl.className = 'chat-profile-card__title';
  titleEl.textContent = title;

  const textEl = document.createElement('div');
  textEl.className = 'chat-profile-card__text';
  textEl.textContent = text;

  const actionsEl = document.createElement('div');
  actionsEl.className = 'chat-profile-card__actions';

  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-profile-card__btn';
    button.textContent = action.label;
    button.addEventListener('click', action.onClick);
    actionsEl.appendChild(button);
  }

  card.append(titleEl, textEl, actionsEl);
  return card;
}

/**
 * Create a memory editor card for inline editing.
 * @param {Array} memories
 * @param {{ onEdit: Function, onDelete: Function, onClose: Function }} handlers
 * @returns {HTMLElement}
 */
export function createMemoryEditorCard(memories = [], handlers = {}) {
  const card = document.createElement('div');
  card.className = 'chat-profile-card chat-profile-card--editor';
  card.dataset.cardKind = 'editor';

  const title = document.createElement('div');
  title.className = 'chat-profile-card__title';
  title.textContent = 'Profil bearbeiten';

  const text = document.createElement('div');
  text.className = 'chat-profile-card__text';
  text.textContent =
    memories.length > 0
      ? 'Kerninfos direkt im Chat korrigieren oder entfernen.'
      : 'Noch keine Erinnerungen gespeichert.';

  const list = document.createElement('div');
  list.className = 'chat-memory-editor';

  for (const entry of memories) {
    const row = document.createElement('div');
    row.className = 'chat-memory-editor__row';

    const body = document.createElement('div');
    body.className = 'chat-memory-editor__body';

    const key = document.createElement('div');
    key.className = 'chat-memory-editor__key';
    key.textContent = String(entry?.key || 'memory');

    const value = document.createElement('div');
    value.className = 'chat-memory-editor__value';
    value.textContent = String(entry?.value || '').trim() || '(leer)';

    body.append(key, value);

    const actions = document.createElement('div');
    actions.className = 'chat-memory-editor__actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'chat-memory-editor__btn';
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => handlers.onEdit?.(entry));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className =
      'chat-memory-editor__btn chat-memory-editor__btn--danger';
    deleteBtn.textContent = 'Entfernen';
    deleteBtn.addEventListener('click', () => handlers.onDelete?.(entry));

    actions.append(editBtn, deleteBtn);
    row.append(body, actions);
    list.appendChild(row);
  }

  const footer = document.createElement('div');
  footer.className = 'chat-profile-card__actions';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'chat-profile-card__btn';
  closeBtn.textContent = 'Schließen';
  closeBtn.addEventListener('click', () => {
    card.remove();
    handlers.onClose?.();
  });

  footer.appendChild(closeBtn);
  card.append(title, text, list, footer);
  return card;
}
