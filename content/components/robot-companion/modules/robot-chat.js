import { createLogger } from '../../../core/logger.js';
import { MarkdownRenderer } from './markdown-renderer.js';
import { ROBOT_ACTIONS } from '../constants/events.js';
import {
  clearActiveOverlayMode,
  setActiveOverlayMode,
} from '../../../core/ui-store.js';
import {
  OVERLAY_MODES,
  prepareOverlayFocusChange,
} from '../../../core/overlay-manager.js';
import { withViewTransition } from '../../../core/view-transitions.js';
import { ChatHistoryStore } from './chat-history-store.js';

const log = createLogger('RobotChat');
const DEFAULT_INPUT_PLACEHOLDER = 'Frag mich etwas...';
const AI_AGENT_USER_ENDPOINT = '/api/ai-agent-user';
const USER_ID_HEADER = 'x-jules-user-id';

/**
 * @typedef {Window & typeof globalThis & {
 *   ROBOT_USER_NAME?: string;
 * }} RobotChatWindow
 */

/**
 * @returns {RobotChatWindow | null}
 */
function getRobotChatWindow() {
  if (typeof window === 'undefined') return null;
  return /** @type {RobotChatWindow} */ (window);
}

const ACTION_PROMPTS = {
  [ROBOT_ACTIONS.START]:
    'Begruesse mich kurz als Jules und frage in 1-2 Saetzen, wobei du helfen kannst.',
  [ROBOT_ACTIONS.SCROLL_FOOTER]:
    'Scrolle bitte zum Footer und bestaetige kurz auf Deutsch.',
  [ROBOT_ACTIONS.TOGGLE_THEME]:
    'Wechsle bitte das Theme und bestaetige kurz auf Deutsch.',
  [ROBOT_ACTIONS.SEARCH_WEBSITE]:
    'Hilf mir bei der Website-Suche und frage nach dem Suchbegriff.',
  [ROBOT_ACTIONS.OPEN_MENU]: 'Oeffne bitte das Menue und bestaetige kurz.',
  [ROBOT_ACTIONS.CLOSE_MENU]: 'Schliesse bitte das Menue und bestaetige kurz.',
  [ROBOT_ACTIONS.OPEN_SEARCH]: 'Oeffne bitte die Suche und bestaetige kurz.',
  [ROBOT_ACTIONS.CLOSE_SEARCH]:
    'Schliesse bitte die Suche und bestaetige kurz.',
  [ROBOT_ACTIONS.SCROLL_TOP]:
    'Scrolle bitte ganz nach oben und bestaetige kurz.',
  [ROBOT_ACTIONS.COPY_CURRENT_URL]:
    'Kopiere den aktuellen Seitenlink und bestaetige kurz.',
  [ROBOT_ACTIONS.CLEAR_CHAT]:
    'Loesche den Chatverlauf und bestaetige kurz auf Deutsch.',
};

export class RobotChat {
  constructor(robot) {
    this.robot = robot;

    /** @type {File|null} Pending image for upload */
    this.pendingImage = null;

    // Use state manager for chat state
    // Legacy properties for backward compatibility (deprecated)
    this.isOpen = false;
    this.isTyping = false;
    this.isResponding = false;
    this.lastGreetedContext = null;
    this.historyStore = new ChatHistoryStore();
    this.memoryManagerState = null;
    this.activeRequestController = null;
    this.activeStreamingMessage = null;

    // Load history (supports legacy format migration)
    this.history = this.historyStore.load();
  }

  hasUserName() {
    const robotWindow = getRobotChatWindow();
    return Boolean(String(robotWindow?.ROBOT_USER_NAME || '').trim());
  }

  async applyUserName(rawName) {
    if (!rawName || !this.robot?.setUserName) return '';
    const normalized = await this.robot.setUserName(rawName);
    if (!normalized) return '';

    const existingPrompt = this.robot.dom.messages?.querySelector(
      '.message--name-prompt',
    );
    existingPrompt?.remove();

    this.addMessage(
      `Alles klar, ich merke mir deinen Namen als ${normalized}.`,
      'bot',
    );
    this.renderQuickLinks();
    return normalized;
  }

  renderNamePrompt() {
    if (!this.robot.dom.messages) return;
    if (this.robot.dom.messages.querySelector('.message--name-prompt')) return;

    const currentName = String(getRobotChatWindow()?.ROBOT_USER_NAME || '');

    const wrapper = document.createElement('div');
    wrapper.className = 'message message--name-prompt';

    const card = document.createElement('div');
    card.className = 'chat-name-prompt';

    const top = document.createElement('div');
    top.className = 'chat-name-prompt__top';

    const title = document.createElement('p');
    title.className = 'chat-name-prompt__title';
    title.textContent = 'Wie darf ich dich nennen?';

    const copy = document.createElement('p');
    copy.className = 'chat-name-prompt__copy';
    copy.textContent =
      'Gib einen Namen ein, damit ich dich wiedererkennen und dein Profil laden kann.';

    top.append(title, copy);

    const row = document.createElement('div');
    row.className = 'chat-name-prompt__row';

    const input = document.createElement('input');
    input.id = 'robot-chat-name-input';
    input.type = 'text';
    input.value = currentName;
    input.placeholder = 'Dein Name';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Name eingeben');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-name-prompt__save';
    button.textContent = currentName ? 'Aktualisieren' : 'Speichern';

    row.append(input, button);

    const feedback = document.createElement('p');
    feedback.className = 'chat-name-prompt__feedback';

    card.append(top, row, feedback);
    wrapper.appendChild(card);
    this.robot.dom.messages.appendChild(wrapper);
    this.scrollToBottom();

    const onSubmit = async () => {
      const value = String(input.value || '').trim();
      if (!value) {
        feedback.classList.add('is-error');
        feedback.textContent = 'Bitte gib einen Namen ein.';
        return;
      }

      const normalized = value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
      if (!normalized) {
        feedback.classList.add('is-error');
        feedback.textContent =
          'Der Name darf nur Buchstaben, Zahlen, Unterstrich oder Bindestrich enthalten.';
        return;
      }

      await this.applyUserName(normalized);
    };

    button.addEventListener('click', onSubmit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSubmit();
      }
    });
  }

  _executeQuickAction(action) {
    if (action === 'setName') {
      this.renderNamePrompt();
      return;
    }
    if (action === 'shareLink') {
      void this.copyShareLink();
      return;
    }

    if (Object.values(ROBOT_ACTIONS).includes(action)) {
      this.handleAction(action);
      return;
    }

    // fallback: send as user input to agent
    if (action) {
      this.robot.dom.input.value = action;
      this.handleUserMessage();
    }
  }

  _isAbortError(error) {
    return (
      this.activeRequestController?.signal?.aborted ||
      error?.name === 'AbortError' ||
      error?.code === 20
    );
  }

  async getActiveRobotIdentity() {
    const agentService = await this.robot.getAgentService();
    const userId = String(agentService?.getUserId?.() || '').trim();
    const name = String(getRobotChatWindow()?.ROBOT_USER_NAME || '').trim();
    return { userId, name };
  }

  async copyShareLink() {
    try {
      const { userId } = await this.getActiveRobotIdentity();
      const sharedName = userId.startsWith('name_') ? userId.slice(5) : userId;
      const url = new URL(window.location.href);

      if (sharedName) {
        url.searchParams.set('name', sharedName);
      }

      await navigator.clipboard.writeText(url.toString());
      this.addMessage('Link kopiert!', 'bot');
    } catch (error) {
      log.warn('share link failed', error);
      this.addMessage('Link konnte nicht kopiert werden.', 'bot');
    }
  }

  async requestMemoryAction(action, payload = {}) {
    const { userId } = await this.getActiveRobotIdentity();
    const body = {
      action,
      ...(userId ? { userId } : {}),
      ...(payload && typeof payload === 'object' ? payload : {}),
    };

    const headers = { 'Content-Type': 'application/json' };
    if (userId) {
      headers[USER_ID_HEADER] = userId;
    }

    const response = await fetch(AI_AGENT_USER_ENDPOINT, {
      method: 'POST',
      headers,
      credentials: 'omit',
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const text =
        data?.text ||
        data?.error ||
        `Profil-Request fehlgeschlagen (${response.status}).`;
      throw new Error(text);
    }
    return data;
  }

  removeMemoryManagerCard() {
    this.robot.dom.messages
      ?.querySelector('.message--memory-manager')
      ?.remove();
  }

  createMemoryManagerButton(label, onClick, variant = 'default') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chat-memory-manager__btn chat-memory-manager__btn--${variant}`;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  createMemoryRow(memory, onEdit, onForget) {
    const row = document.createElement('div');
    row.className = 'chat-memory-manager__memory-row';

    const content = document.createElement('div');
    content.className = 'chat-memory-manager__memory-content';

    const key = document.createElement('strong');
    key.className = 'chat-memory-manager__memory-key';
    key.textContent = String(memory?.key || 'note');

    const value = document.createElement('span');
    value.className = 'chat-memory-manager__memory-value';
    value.textContent = String(memory?.value || '-');

    const meta = document.createElement('span');
    meta.className = 'chat-memory-manager__memory-meta';
    const updatedAt = Number(memory?.timestamp || 0);
    const expiresAt = Number(memory?.expiresAt || 0);
    const updatedLabel = updatedAt
      ? new Date(updatedAt).toLocaleString('de-DE')
      : '-';
    const expiresLabel = expiresAt
      ? new Date(expiresAt).toLocaleDateString('de-DE')
      : '-';
    meta.textContent = `Kategorie: ${String(memory?.category || 'note')} · Priorität: ${Number(
      memory?.priority || 0,
    )} · Aktualisiert: ${updatedLabel} · Ablauf: ${expiresLabel}`;

    content.append(key, value, meta);

    const actions = document.createElement('div');
    actions.className = 'chat-memory-manager__memory-actions';
    actions.append(
      this.createMemoryManagerButton('Bearbeiten', onEdit),
      this.createMemoryManagerButton('Vergessen', onForget, 'danger'),
    );

    row.append(content, actions);
    return row;
  }

  createTransparencyItem(label, value) {
    const row = document.createElement('div');
    row.className = 'chat-memory-manager__transparency-item';

    const key = document.createElement('span');
    key.className = 'chat-memory-manager__transparency-label';
    key.textContent = label;

    const val = document.createElement('span');
    val.className = 'chat-memory-manager__transparency-value';
    val.textContent = value || '-';

    row.append(key, val);
    return row;
  }

  createRecoveryCandidateRow(candidate, recoveryName, onActivate) {
    const row = document.createElement('div');
    row.className = 'chat-memory-manager__candidate-row';

    const meta = document.createElement('div');
    meta.className = 'chat-memory-manager__candidate-meta';
    const label = document.createElement('strong');
    label.textContent = String(candidate?.name || candidate?.userId || '-');
    const detail = document.createElement('span');
    detail.textContent = `${Number(candidate?.memoryCount || 0)} Memories`;
    meta.append(label, detail);

    const activateBtn = this.createMemoryManagerButton(
      'Aktivieren',
      () => onActivate(candidate?.userId, recoveryName),
      'primary',
    );

    row.append(meta, activateBtn);
    return row;
  }

  renderMemoryManagerCard() {
    if (!this.robot.dom.messages || !this.memoryManagerState) return;

    this.removeMemoryManagerCard();

    const state = this.memoryManagerState;
    const wrapper = document.createElement('div');
    wrapper.className = 'message message--memory-manager';

    const card = document.createElement('section');
    card.className = 'chat-memory-manager';

    const head = document.createElement('div');
    head.className = 'chat-memory-manager__head';
    const title = document.createElement('h3');
    title.className = 'chat-memory-manager__title';
    title.textContent = 'Profil & Erinnerungen';
    const subtitle = document.createElement('p');
    subtitle.className = 'chat-memory-manager__subtitle';
    subtitle.textContent =
      state.profile?.name || state.profile?.userId
        ? `${state.profile?.name || state.profile?.userId} · ${state.memories.length} Memories`
        : 'Aktives Profil verwalten';
    head.append(title, subtitle);

    const toolbar = document.createElement('div');
    toolbar.className = 'chat-memory-manager__toolbar';
    toolbar.append(
      this.createMemoryManagerButton(
        'Neu laden',
        () => void this.showMemoryManager(),
      ),
      this.createMemoryManagerButton('Name ändern', () =>
        this.renderNamePrompt(),
      ),
      this.createMemoryManagerButton(
        'Disconnect',
        () => void this.disconnectProfile(),
        'danger',
      ),
    );

    const transparency = document.createElement('section');
    transparency.className = 'chat-memory-manager__transparency';
    const transparencyTitle = document.createElement('h4');
    transparencyTitle.className = 'chat-memory-manager__section-title';
    transparencyTitle.textContent = 'Transparenz';

    const transparencyList = document.createElement('div');
    transparencyList.className = 'chat-memory-manager__transparency-list';
    const loadedAt = Number(state.loadedAt || 0);
    const loadedAtLabel = loadedAt
      ? new Date(loadedAt).toLocaleString('de-DE')
      : '-';
    transparencyList.append(
      this.createTransparencyItem(
        'Aktive User-ID',
        state.profile?.userId || '-',
      ),
      this.createTransparencyItem(
        'Profilstatus',
        String(state.profile?.status || 'unbekannt'),
      ),
      this.createTransparencyItem(
        'Gespeicherte Einträge',
        String(Array.isArray(state.memories) ? state.memories.length : 0),
      ),
      this.createTransparencyItem(
        'Speicherfrist',
        state.retentionDays ? `${state.retentionDays} Tage` : '-',
      ),
      this.createTransparencyItem('Letzte Synchronisierung', loadedAtLabel),
    );
    transparency.append(transparencyTitle, transparencyList);

    const form = document.createElement('form');
    form.className = 'chat-memory-manager__form';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const key = keyInput.value;
      const value = valueInput.value.trim();
      if (!value) return;
      void this.updateMemoryEntry(key, value);
    });

    const keyInput = document.createElement('select');
    keyInput.className = 'chat-memory-manager__input';
    ['name', 'interest', 'preference', 'note'].forEach((key) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key;
      keyInput.appendChild(option);
    });

    const valueInput = document.createElement('input');
    valueInput.className = 'chat-memory-manager__input';
    valueInput.type = 'text';
    valueInput.placeholder = 'Memory-Wert';
    valueInput.autocomplete = 'off';

    const saveBtn = this.createMemoryManagerButton(
      'Speichern',
      () => {
        const key = keyInput.value;
        const value = valueInput.value.trim();
        if (!value) return;
        void this.updateMemoryEntry(key, value);
      },
      'primary',
    );
    saveBtn.type = 'submit';
    form.append(keyInput, valueInput, saveBtn);

    const memories = document.createElement('div');
    memories.className = 'chat-memory-manager__memories';
    if (state.memories.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'chat-memory-manager__empty';
      empty.textContent = 'Noch keine Memories gespeichert.';
      memories.appendChild(empty);
    } else {
      state.memories.forEach((memory) => {
        memories.appendChild(
          this.createMemoryRow(
            memory,
            () => {
              keyInput.value = String(memory?.key || 'note');
              valueInput.value = String(memory?.value || '');
              valueInput.focus();
            },
            () =>
              void this.forgetMemoryEntry(
                String(memory?.key || ''),
                String(memory?.value || ''),
              ),
          ),
        );
      });
    }

    const recoveryBlock = document.createElement('div');
    recoveryBlock.className = 'chat-memory-manager__recovery';

    const recoveryTitle = document.createElement('h4');
    recoveryTitle.className = 'chat-memory-manager__section-title';
    recoveryTitle.textContent = 'Profil aktivieren';

    const recoveryForm = document.createElement('div');
    recoveryForm.className = 'chat-memory-manager__recovery-form';
    const recoveryInput = document.createElement('input');
    recoveryInput.className = 'chat-memory-manager__input';
    recoveryInput.type = 'text';
    recoveryInput.placeholder = 'Name für Profilsuche';
    recoveryInput.value = state.recoveryName || state.profile?.name || '';
    recoveryInput.autocomplete = 'off';
    const recoveryBtn = this.createMemoryManagerButton(
      'Profile suchen',
      () => {
        const recoveryName = recoveryInput.value.trim();
        if (!recoveryName) return;
        void this.resolveProfilesByName(recoveryName);
      },
      'primary',
    );
    recoveryForm.append(recoveryInput, recoveryBtn);

    recoveryBlock.append(recoveryTitle, recoveryForm);
    if (
      Array.isArray(state.recoveryCandidates) &&
      state.recoveryCandidates.length
    ) {
      const candidateList = document.createElement('div');
      candidateList.className = 'chat-memory-manager__candidate-list';
      state.recoveryCandidates.forEach((candidate) => {
        candidateList.appendChild(
          this.createRecoveryCandidateRow(
            candidate,
            recoveryInput.value.trim(),
            (targetUserId, recoveryName) =>
              void this.activateRecoveredProfile(targetUserId, recoveryName),
          ),
        );
      });
      recoveryBlock.appendChild(candidateList);
    }

    if (state.feedback) {
      const feedback = document.createElement('p');
      feedback.className = `chat-memory-manager__feedback${
        state.feedbackTone === 'error' ? ' is-error' : ''
      }`;
      feedback.textContent = state.feedback;
      recoveryBlock.appendChild(feedback);
    }

    card.append(head, toolbar, transparency, form, memories, recoveryBlock);
    wrapper.appendChild(card);
    this.robot.dom.messages.appendChild(wrapper);
    this.scrollToBottom();
  }

  setMemoryManagerState(nextState = {}) {
    const previous = this.memoryManagerState || {
      profile: null,
      memories: [],
      recoveryCandidates: [],
      recoveryName: '',
      feedback: '',
      feedbackTone: 'info',
      retentionDays: null,
      loadedAt: 0,
    };
    this.memoryManagerState = {
      ...previous,
      ...nextState,
      memories: Array.isArray(nextState.memories)
        ? nextState.memories
        : previous.memories || [],
      recoveryCandidates: Array.isArray(nextState.recoveryCandidates)
        ? nextState.recoveryCandidates
        : previous.recoveryCandidates || [],
      retentionDays:
        nextState.retentionDays !== undefined &&
        nextState.retentionDays !== null &&
        Number.isFinite(Number(nextState.retentionDays))
          ? Number(nextState.retentionDays)
          : previous.retentionDays,
      loadedAt:
        nextState.loadedAt !== undefined &&
        Number.isFinite(Number(nextState.loadedAt)) &&
        Number(nextState.loadedAt) > 0
          ? Number(nextState.loadedAt)
          : previous.loadedAt,
    };
    this.renderMemoryManagerCard();
  }

  async showMemoryManager() {
    if (!this.hasUserName()) {
      this.renderNamePrompt();
      this.addMessage(
        'Bitte setze zuerst deinen Namen, damit ich dein Cloudflare-Profil laden kann.',
        'bot',
      );
      return;
    }

    this.setMemoryManagerState({
      feedback: 'Lade Profil aus Cloudflare...',
      feedbackTone: 'info',
      recoveryCandidates: [],
    });

    try {
      const data = await this.requestMemoryAction('list');
      this.setMemoryManagerState({
        profile: data.profile || null,
        memories: Array.isArray(data.memories) ? data.memories : [],
        recoveryName: data.profile?.name || '',
        retentionDays: Number(data.retentionDays) || null,
        loadedAt: Date.now(),
        feedback: data.text || 'Profil geladen.',
        feedbackTone: 'info',
      });
    } catch (error) {
      this.setMemoryManagerState({
        feedback: error?.message || 'Profil konnte nicht geladen werden.',
        feedbackTone: 'error',
      });
    }
  }

  async updateMemoryEntry(key, value) {
    try {
      const data = await this.requestMemoryAction('update-memory', {
        key,
        value,
      });
      this.setMemoryManagerState({
        profile: data.profile || this.memoryManagerState?.profile || null,
        memories: Array.isArray(data.memories) ? data.memories : [],
        loadedAt: Date.now(),
        feedback: data.text || 'Memory gespeichert.',
        feedbackTone: 'info',
      });
    } catch (error) {
      this.setMemoryManagerState({
        feedback: error?.message || 'Memory konnte nicht gespeichert werden.',
        feedbackTone: 'error',
      });
    }
  }

  async forgetMemoryEntry(key, value) {
    try {
      const data = await this.requestMemoryAction('forget-memory', {
        key,
        value,
      });
      this.setMemoryManagerState({
        profile: data.profile || this.memoryManagerState?.profile || null,
        memories: Array.isArray(data.memories) ? data.memories : [],
        loadedAt: Date.now(),
        feedback: data.text || 'Memory entfernt.',
        feedbackTone: 'info',
      });
    } catch (error) {
      this.setMemoryManagerState({
        feedback: error?.message || 'Memory konnte nicht entfernt werden.',
        feedbackTone: 'error',
      });
    }
  }

  async resolveProfilesByName(recoveryName) {
    try {
      const data = await this.requestMemoryAction('resolve', {
        name: recoveryName,
      });
      const candidates = Array.isArray(data?.recovery?.candidates)
        ? data.recovery.candidates
        : [];
      this.setMemoryManagerState({
        recoveryName,
        recoveryCandidates: candidates,
        feedback:
          data.text ||
          (candidates.length > 0
            ? 'Profile gefunden.'
            : 'Keine Profile gefunden.'),
        feedbackTone: 'info',
      });
    } catch (error) {
      this.setMemoryManagerState({
        recoveryName,
        recoveryCandidates: [],
        feedback: error?.message || 'Profilsuche ist fehlgeschlagen.',
        feedbackTone: 'error',
      });
    }
  }

  async activateRecoveredProfile(targetUserId, recoveryName) {
    try {
      const data = await this.requestMemoryAction('activate', {
        targetUserId,
        name: recoveryName,
      });

      if (data?.profile?.name) {
        await this.applyUserName(data.profile.name);
      }

      this.setMemoryManagerState({
        profile: data.profile || null,
        memories: Array.isArray(data.memories) ? data.memories : [],
        recoveryCandidates: [],
        recoveryName: data.profile?.name || recoveryName || '',
        retentionDays: Number(data.retentionDays) || null,
        loadedAt: Date.now(),
        feedback: data.text || 'Profil aktiviert.',
        feedbackTone: 'info',
      });
    } catch (error) {
      this.setMemoryManagerState({
        feedback: error?.message || 'Profil konnte nicht aktiviert werden.',
        feedbackTone: 'error',
      });
    }
  }

  async disconnectProfile() {
    try {
      const data = await this.requestMemoryAction('disconnect');
      this.memoryManagerState = null;
      this.removeMemoryManagerCard();
      const robotWindow = getRobotChatWindow();
      if (robotWindow) robotWindow.ROBOT_USER_NAME = '';
      this.addMessage(
        data?.text || 'Profil getrennt. Bitte Namen neu setzen.',
        'bot',
      );
      this.renderNamePrompt();
    } catch (error) {
      this.setMemoryManagerState({
        feedback: error?.message || 'Disconnect fehlgeschlagen.',
        feedbackTone: 'error',
      });
    }
  }

  renderQuickLinks() {
    if (!this.robot.dom.messages) return;
    if (this.robot.dom.messages.querySelector('.message--quick-actions'))
      return;

    const quickLinks = [
      {
        label: 'Profil & Memories',
        action: ROBOT_ACTIONS.SHOW_MEMORIES,
        hint: 'Cloudflare Profil',
      },
      {
        label: 'Name ändern',
        action: 'setName',
        hint: 'Persönliche Identität',
      },
      { label: 'Link kopieren', action: 'shareLink', hint: 'Chat teilen' },
      {
        label: 'Menü öffnen',
        action: ROBOT_ACTIONS.OPEN_MENU,
        hint: 'Navigation',
      },
      {
        label: 'Suche öffnen',
        action: ROBOT_ACTIONS.OPEN_SEARCH,
        hint: 'Schnellsuche',
      },
      {
        label: 'Theme wechseln',
        action: ROBOT_ACTIONS.TOGGLE_THEME,
        hint: 'Design',
      },
      {
        label: 'Chat löschen',
        action: ROBOT_ACTIONS.CLEAR_CHAT,
        hint: 'Neustart',
      },
    ];

    const message = document.createElement('div');
    message.className = 'message message--quick-actions';

    const card = document.createElement('div');
    card.className = 'chat-quick-actions';

    const header = document.createElement('div');
    header.className = 'chat-quick-actions__header';

    const label = document.createElement('div');
    label.className = 'chat-quick-actions__label';
    label.textContent = 'Quick Links';

    const copy = document.createElement('p');
    copy.className = 'chat-quick-actions__copy';
    copy.textContent = 'Schnellaktionen für die wichtigsten Aufgaben.';

    header.append(label, copy);

    const track = document.createElement('div');
    track.className = 'chat-quick-actions__track';

    quickLinks.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chat-quick-action';
      button.dataset.quickAction = item.action;

      const badge = document.createElement('span');
      badge.className = 'chat-quick-action__badge';
      badge.textContent = item.action.slice(0, 2).toUpperCase();

      const body = document.createElement('div');
      body.className = 'chat-quick-action__body';

      const title = document.createElement('span');
      title.className = 'chat-quick-action__label';
      title.textContent = item.label;

      const hint = document.createElement('span');
      hint.className = 'chat-quick-action__hint';
      hint.textContent = item.hint;

      body.append(title, hint);
      button.append(badge, body);

      button.addEventListener('click', () =>
        this._executeQuickAction(item.action),
      );
      track.append(button);
    });

    card.append(header, track);
    message.append(card);
    this.robot.dom.messages.appendChild(message);
    this.scrollToBottom();
  }

  destroy() {
    this.clearBubbleSequence();
  }

  toggleChat(forceState, options = {}) {
    const { restoreFocus = true } = options;
    const newState =
      forceState ?? !this.robot.stateManager.getState().isChatOpen;

    // DOM-Erstellung & Event-Binding AUSSERHALB der View Transition
    // (VT darf nur DOM-Mutationen wrappen, nicht DOM-Erstellung)
    if (newState) {
      this.robot.ensureChatWindowCreated();
    }

    // Visuelle State-Änderungen in View Transition wrappen.
    // CSS-Transitions nur deaktivieren wenn VT tatsächlich unterstützt wird,
    // damit Browser ohne VT die CSS-Fallback-Animation behalten.
    const win = this.robot.dom.window;
    const vtSupported = typeof document.startViewTransition === 'function';
    if (vtSupported && win) win.classList.add('vt-animating');

    withViewTransition(
      () => this._applyVisualChatState(newState, { restoreFocus }),
      {
        types: [newState ? 'chat-open' : 'chat-close'],
      },
    ).finally(() => {
      if (win) win.classList.remove('vt-animating');
    });
  }

  /**
   * Apply the visual chat state (class toggles, state updates, focus management).
   * Separated so it can be wrapped in a View Transition.
   * @param {boolean} newState
   * @param {{ restoreFocus?: boolean }} [options]
   */
  _applyVisualChatState(newState, options = {}) {
    const { restoreFocus = true } = options;

    if (newState) {
      this.robot.dom.window.classList.add('open');
      this.robot.dom.container.classList.add('robot-chat--open');
      this.isOpen = true; // kept for backward compat — prefer stateManager

      // Update state manager (single source of truth)
      this.robot.stateManager.setState({ isChatOpen: true });
      setActiveOverlayMode(OVERLAY_MODES.ROBOT_CHAT);

      this.clearBubbleSequence();
      this.hideBubble();
      this.robot.animationModule.stopIdleEyeMovement();
      this.robot.animationModule.stopBlinkLoop();
      const ctx = this.robot.getPageContext();
      this.lastGreetedContext = ctx;

      const isInitialOpenWithoutHistory =
        this.robot.dom.messages.children.length === 0 &&
        this.history.length === 0;

      if (this.robot.dom.messages.children.length === 0) {
        if (this.history.length > 0) {
          this.restoreMessages();
        }
      }

      if (!this.hasUserName()) {
        this.renderNamePrompt();
      }
      this.renderQuickLinks();
      if (isInitialOpenWithoutHistory) {
        this.handleAction(ROBOT_ACTIONS.START);
      }

      // Focus Trap
      globalThis?.a11y?.trapFocus(this.robot.dom.window);
      this.syncComposerState();
    } else {
      this.robot.dom.window.classList.remove('open');
      this.robot.dom.container.classList.remove('robot-chat--open');
      this.isOpen = false; // kept for backward compat — prefer stateManager

      // Update state manager (single source of truth)
      this.robot.stateManager.setState({ isChatOpen: false });
      prepareOverlayFocusChange(OVERLAY_MODES.ROBOT_CHAT, { restoreFocus });
      clearActiveOverlayMode(OVERLAY_MODES.ROBOT_CHAT);

      this.robot.animationModule.startIdleEyeMovement();
      this.robot.animationModule.startBlinkLoop();

      // Release Focus
      globalThis?.a11y?.releaseFocus();
      this.syncComposerState();
    }
  }

  handleAvatarClick() {
    if (this.isOpen) {
      this.toggleChat(false);
      return;
    }

    (async () => {
      await this.robot.animationModule.playPokeAnimation();
      // ensure name is set before opening chat to prompt user if needed
      try {
        await this.robot.ensureName();
      } catch {
        /* ignore */
      }
      this.toggleChat(true);
    })();
  }

  async handleUserMessage() {
    const text = this.robot.dom.input.value.trim();
    const hasPendingImage = !!this.pendingImage;

    if (!text && !hasPendingImage) {
      this.syncComposerState();
      return;
    }
    if (this.isTyping || this.isResponding) return;

    // Show user message (with image thumbnail if present)
    if (hasPendingImage) {
      this.addImageMessage(text, this.pendingImage);
    } else {
      this.addMessage(text, 'user');
    }
    this.robot.dom.input.value = '';
    this.isResponding = true;
    this.syncComposerState();

    this.showTyping();
    this.robot.animationModule.startThinking();
    this.robot.trackInteraction();

    try {
      this.robot.animationModule.startSpeaking();
      const response = await this._streamAgentResponse(
        async (agentService, onChunk, signal) => {
          if (hasPendingImage) {
            const imageFile = this.pendingImage;
            this.clearImagePreview();
            return agentService.analyzeImage(imageFile, text, onChunk, {
              signal,
            });
          }
          return agentService.generateResponse(text, onChunk, {}, { signal });
        },
      );

      if (response?.aborted) return;

      if (response.toolResults?.length) {
        this.showToolCallResults(response.toolResults);
      }
    } catch (e) {
      if (this._isAbortError(e)) return;
      log.error('generateResponse failed', e);
      this.removeTyping();
      this.robot.animationModule.stopThinking();
      this.robot.animationModule.stopSpeaking();
      this.addMessage(
        'Fehler bei der Verbindung. Bitte erneut versuchen.',
        'bot',
      );
    } finally {
      this.isResponding = false;
      this.syncComposerState();
    }
  }

  async _streamAgentResponse(runRequest) {
    const agentService = await this.robot.getAgentService();
    const requestController = new AbortController();
    this.activeRequestController = requestController;
    /** @type {HTMLElement|null} */
    let streamingMessageEl = null;
    let typingRemoved = false;

    let response;
    try {
      response = await runRequest(
        agentService,
        (chunk) => {
          if (requestController.signal.aborted) return;
          if (!typingRemoved) {
            this.removeTyping();
            typingRemoved = true;
          }
          if (!streamingMessageEl) {
            streamingMessageEl = this.createStreamingMessage();
          }
          this.updateStreamingMessage(streamingMessageEl, chunk);
        },
        requestController.signal,
      );
    } catch (error) {
      if (streamingMessageEl && !requestController.signal.aborted) {
        streamingMessageEl.remove();
        if (this.activeStreamingMessage === streamingMessageEl) {
          this.activeStreamingMessage = null;
        }
      }
      if (requestController.signal.aborted || this._isAbortError(error)) {
        return { aborted: true };
      }
      throw error;
    } finally {
      if (this.activeRequestController === requestController) {
        this.activeRequestController = null;
      }
    }

    if (response?.aborted || requestController.signal.aborted) {
      if (!typingRemoved) this.removeTyping();
      this.robot.animationModule.stopThinking();
      this.robot.animationModule.stopSpeaking();
      if (this.activeStreamingMessage === streamingMessageEl) {
        this.finalizeStreamingMessage(streamingMessageEl, {
          interrupted: true,
        });
      }
      return { aborted: true };
    }

    this.robot.animationModule.stopThinking();

    // inform user if URL was updated with a stable id
    if (response?.urlUpdated) {
      this.addMessage(
        '🔗 Ich habe deine eindeutige ID in die Adresszeile geschrieben. ' +
          'Benutze diesen Link in neuen Fenstern, damit ich dich wiedererkenne.',
        'bot',
      );
    }

    if (response?.hasMemory && streamingMessageEl) {
      const badge = this.robot.domBuilder.createMemoryIndicator();
      streamingMessageEl.appendChild(badge);
    }

    if (!streamingMessageEl) {
      if (!typingRemoved) this.removeTyping();
      this.robot.animationModule.stopSpeaking();
      const text =
        typeof response === 'string'
          ? response
          : response?.text || 'Entschuldigung, keine Antwort erhalten.';
      this.addMessage(text, 'bot');
      return response;
    }

    // If token streaming was partial, force-sync with final server message text.
    if (streamingMessageEl && response?.text) {
      this.updateStreamingMessage(streamingMessageEl, response.text);
    }

    this.finalizeStreamingMessage(streamingMessageEl);
    return response;
  }

  stopActiveResponse() {
    if (!this.isResponding) return;

    this.activeRequestController?.abort();
    this.removeTyping();
    this.robot.animationModule.stopThinking();
    this.robot.animationModule.stopSpeaking();

    if (this.activeStreamingMessage) {
      this.finalizeStreamingMessage(this.activeStreamingMessage, {
        interrupted: true,
      });
    } else {
      this.addMessage('Antwort gestoppt.', 'bot');
    }

    this.isResponding = false;
    this.syncComposerState();
  }

  /**
   * Show tool call execution results in chat
   * @param {Array<{name: string, success: boolean, message: string}>} toolResults
   */
  showToolCallResults(toolResults) {
    if (!this.robot.dom.messages) return;

    for (const result of toolResults) {
      const indicator = this.robot.domBuilder.createToolCallIndicator(
        result.name,
        result.message,
      );
      this.robot.dom.messages.appendChild(indicator);
    }
    this.scrollToBottom();
  }

  /**
   * Add a user message with image thumbnail
   * @param {string} text
   * @param {File} imageFile
   */
  addImageMessage(text, imageFile) {
    const msg = document.createElement('div');
    msg.className = 'message user';
    const timestamp = Date.now();

    if (text) {
      const textEl = document.createElement('div');
      textEl.textContent = text;
      msg.appendChild(textEl);
    }

    // Add image thumbnail
    const img = document.createElement('img');
    img.className = 'user-image';
    img.alt = imageFile.name || 'Hochgeladenes Bild';
    img.src = URL.createObjectURL(imageFile);

    // Clean up object URL after load
    img.onload = () => URL.revokeObjectURL(img.src);

    msg.appendChild(img);
    msg.appendChild(
      this.robot.domBuilder.createMessageMeta(timestamp, {
        sender: 'Du',
      }),
    );
    this.robot.dom.messages.appendChild(msg);
    this.scrollToBottom();

    this.history = this.historyStore.append(this.history, {
      role: 'user',
      text: text
        ? `[Bild: ${imageFile.name}] ${text}`
        : `[Bild: ${imageFile.name}]`,
      timestamp,
    });
  }

  /**
   * Handle image upload from file input
   * @param {File} file
   */
  handleImageUpload(file) {
    if (!file) return;

    // Remove existing preview
    this.clearImagePreview();

    this.pendingImage = file;

    // Show preview
    const src = URL.createObjectURL(file);
    const preview = this.robot.domBuilder.createImagePreview(src, file.name);

    // Insert before input area
    const inputArea =
      this.robot.dom.inputArea || document.getElementById('robot-input-area');
    if (inputArea && inputArea.parentNode) {
      inputArea.parentNode.insertBefore(preview, inputArea);
    }

    // Setup remove handler
    const removeBtn = preview.querySelector('.chat-preview-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => this.clearImagePreview());
    }

    // Update placeholder
    if (this.robot.dom.input) {
      this.robot.dom.input.placeholder =
        'Beschreibe das Bild oder sende es direkt...';
      this.robot.dom.input.focus();
    }
    this.syncComposerState();
  }

  /**
   * Clear image preview and pending image
   */
  clearImagePreview() {
    this.pendingImage = null;

    const preview = document.getElementById('robot-image-preview');
    if (preview) {
      const img = preview.querySelector('img');
      if (img?.src?.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
      }
      preview.remove();
    }

    if (this.robot.dom.input) {
      this.robot.dom.input.placeholder = DEFAULT_INPUT_PLACEHOLDER;
    }
    this.syncComposerState();
  }

  createStreamingMessage() {
    const msg = document.createElement('div');
    msg.className = 'message bot streaming';
    msg.dataset.timestamp = String(Date.now());

    const textSpan = document.createElement('span');
    textSpan.className = 'streaming-text';

    const cursor = document.createElement('span');
    cursor.className = 'streaming-cursor';

    msg.append(textSpan, cursor);
    this.robot.dom.messages.appendChild(msg);
    this.activeStreamingMessage = msg;
    this.scrollToBottom();
    return msg;
  }

  updateStreamingMessage(messageEl, text) {
    const textSpan = messageEl.querySelector('.streaming-text');
    if (textSpan) {
      textSpan.innerHTML = MarkdownRenderer.parse(text);
      this.scrollToBottom();
    }
  }

  finalizeStreamingMessage(messageEl, { interrupted = false } = {}) {
    const cursor = messageEl.querySelector('.streaming-cursor');
    if (cursor) cursor.remove();
    messageEl.classList.remove('streaming');
    this.robot.animationModule.stopSpeaking();

    const textSpan = messageEl.querySelector('.streaming-text');
    const text = String(
      textSpan?.innerText || textSpan?.textContent || '',
    ).trim();

    if (interrupted && textSpan) {
      const interruptedHint = document.createElement('span');
      interruptedHint.className = 'chat-streaming-interrupted';
      interruptedHint.textContent = ' ⏹️ Ausgabe gestoppt';
      textSpan.appendChild(interruptedHint);
    }

    const timestamp =
      Number.parseInt(messageEl.dataset.timestamp || '', 10) || Date.now();
    messageEl.appendChild(
      this.robot.domBuilder.createMessageMeta(timestamp, {
        sender: 'Jules',
      }),
    );

    const historyText = interrupted ? `${text || 'Ausgabe'} [gestoppt]` : text;
    if (historyText) {
      this.history = this.historyStore.append(this.history, {
        role: 'model',
        text: historyText,
        timestamp,
      });
    }

    if (this.activeStreamingMessage === messageEl) {
      this.activeStreamingMessage = null;
    }
  }

  async handleSummarize() {
    this.toggleChat(true);
    this.showTyping();
    this.robot.animationModule.startThinking();

    try {
      const content = document.body.innerText?.slice(0, 4800) || '';
      const prompt = `Fasse den folgenden Text kurz und präzise auf DEUTSCH zusammen (max 3 Sätze):\n\n${content}`;
      const response = await this._streamAgentResponse(
        (agentService, onChunk, signal) =>
          agentService.generateResponse(prompt, onChunk, {}, { signal }),
      );
      if (response?.aborted) return;
    } catch (error) {
      if (this._isAbortError(error)) return;
      log.warn('Summarize failed', error);
      this.robot.animationModule.stopThinking();
      this.removeTyping();
      this.addMessage('Zusammenfassung fehlgeschlagen.', 'bot');
    }
  }

  showBubble(text) {
    if (this.robot.disableLocalBubbleTexts) return;
    if (this.isOpen) return;
    if (!this.robot.dom.bubble || !this.robot.dom.bubbleText) return;
    this.robot.dom.bubbleText.textContent = String(text || '').trim();
    this.robot.dom.bubble.classList.add('visible');
  }

  hideBubble() {
    if (this.robot.dom.bubble)
      this.robot.dom.bubble.classList.remove('visible');
  }

  showTyping() {
    if (this.isTyping) return;
    this.isTyping = true;

    // Update state manager
    this.robot.stateManager.setState({ isTyping: true });

    // Use DOM Builder for XSS-safe creation
    const typingDiv = this.robot.domBuilder.createTypingIndicator();
    this.robot.dom.messages.appendChild(typingDiv);
    this.scrollToBottom();
    this.syncComposerState();
  }

  removeTyping() {
    const typingDiv = document.getElementById('robot-typing');
    if (typingDiv) typingDiv.remove();
    this.isTyping = false;

    // Update state manager
    this.robot.stateManager.setState({ isTyping: false });
    this.syncComposerState();
  }

  renderMessage(
    text,
    type = 'bot',
    skipParsing = false,
    timestamp = Date.now(),
  ) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;

    if (type === 'user') {
      // User messages are always plain text (XSS-safe)
      msg.textContent = String(text || '');
    } else {
      if (skipParsing) {
        // Already sanitized HTML (from streaming or other sources)
        msg.innerHTML = String(text || '');
      } else {
        // Parse markdown (MarkdownRenderer sanitizes output)
        msg.innerHTML = MarkdownRenderer.parse(String(text || ''));
      }
    }

    msg.appendChild(
      this.robot.domBuilder.createMessageMeta(timestamp, {
        sender: type === 'user' ? 'Du' : 'Jules',
      }),
    );

    this.robot.dom.messages.appendChild(msg);
    this.scrollToBottom();
  }

  addMessage(text, type = 'bot', skipParsing = false) {
    const timestamp = Date.now();
    this.renderMessage(text, type, skipParsing, timestamp);

    this.history = this.historyStore.append(this.history, {
      role: type === 'user' ? 'user' : 'model',
      text: String(text || ''),
      timestamp,
    });
  }

  restoreMessages() {
    this.history.forEach((item) => {
      const type = item.role === 'user' ? 'user' : 'bot';
      this.renderMessage(item.text, type, false, item.timestamp);
    });
  }

  clearHistory() {
    this.history = [];
    this.historyStore.clear();
    this.clearImagePreview();
    if (this.robot.dom.messages) {
      // Clear messages safely
      while (this.robot.dom.messages.firstChild) {
        this.robot.dom.messages.removeChild(this.robot.dom.messages.firstChild);
      }
    }

    void this._clearAgentHistory();
    this.handleAction(ROBOT_ACTIONS.START);
    this.syncComposerState();
  }

  exportHistory() {
    return this.historyStore.download(this.history);
  }

  async _clearAgentHistory() {
    try {
      const agentService = await this.robot.getAgentService();
      agentService.clearHistory?.();
    } catch {
      /* ignore */
    }
  }

  async handleAction(actionKey) {
    this.robot.trackInteraction('action');

    if (actionKey === ROBOT_ACTIONS.SUMMARIZE_PAGE) {
      await this.handleSummarize();
      return;
    }

    if (actionKey === ROBOT_ACTIONS.CLEAR_CHAT) {
      this.clearHistory();
      return;
    }

    if (
      actionKey === ROBOT_ACTIONS.SHOW_MEMORIES ||
      actionKey === ROBOT_ACTIONS.EDIT_PROFILE ||
      actionKey === ROBOT_ACTIONS.SWITCH_PROFILE
    ) {
      await this.showMemoryManager();
      return;
    }

    if (actionKey === ROBOT_ACTIONS.DISCONNECT_PROFILE) {
      await this.disconnectProfile();
      return;
    }

    if (actionKey === ROBOT_ACTIONS.EXPORT_CHAT) {
      this.exportHistory();
      return;
    }

    if (actionKey === ROBOT_ACTIONS.UPLOAD_IMAGE) {
      const fileInput = document.getElementById('robot-image-upload');
      if (fileInput) {
        /** @type {HTMLElement} */ (fileInput).click();
      }
      await this._routeToAI(
        actionKey,
        'Ich moechte ein Bild analysieren. Bitte fordere mich kurz auf, ein Bild hochzuladen.',
      );
      return;
    }

    const prompt =
      ACTION_PROMPTS[actionKey] ||
      `Der Nutzer hat die Aktion "${actionKey}" angefragt. Hilf kurz auf Deutsch und nutze passende Tools nur wenn noetig.`;
    await this._routeToAI(actionKey, prompt);
  }

  /** Route action to AI for dynamic response */
  async _routeToAI(actionKey, prompt) {
    if (this.isResponding) return;

    this.isResponding = true;
    this.syncComposerState();
    this.showTyping();
    this.robot.animationModule.startThinking();
    this.robot.dom.avatar.classList.add('nod');
    this.robot._setTimeout(
      () => this.robot.dom.avatar.classList.remove('nod'),
      650,
    );

    try {
      const response = await this._streamAgentResponse(
        (agentService, onChunk, signal) =>
          agentService.generateResponse(prompt, onChunk, {}, { signal }),
      );
      if (response?.aborted) return;
    } catch (error) {
      if (this._isAbortError(error)) return;
      log.warn(`Action routing failed (${actionKey})`, error);
      this.robot.animationModule.stopThinking();
      this.removeTyping();
      this.addMessage('Da ist etwas schiefgelaufen.', 'bot');
    } finally {
      this.isResponding = false;
      this.syncComposerState();
    }
  }

  scrollToBottom() {
    if (this.robot.dom.messages) {
      this.robot.dom.messages.scrollTop = this.robot.dom.messages.scrollHeight;
    }
  }

  syncComposerState() {
    const sendBtn = this.robot.dom.sendBtn;
    if (!sendBtn) return;
    const stopBtn = this.robot.dom.stopBtn;

    const hasText = Boolean(this.robot.dom.input?.value?.trim());
    const hasPendingImage = Boolean(this.pendingImage);
    const canSend =
      !this.isTyping && !this.isResponding && (hasText || hasPendingImage);
    const canStop = this.isResponding;

    sendBtn.disabled = !canSend;
    sendBtn.setAttribute('aria-disabled', String(!canSend));
    sendBtn.classList.toggle('is-ready', canSend);

    if (stopBtn) {
      stopBtn.disabled = !canStop;
      stopBtn.setAttribute('aria-disabled', String(!canStop));
      stopBtn.classList.toggle('is-active', canStop);
    }
  }

  clearBubbleSequence() {
    // No-op: local bubble sequences are disabled in Cloudflare AI-only mode.
  }
}
