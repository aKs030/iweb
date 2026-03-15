import { createLogger } from '../../../core/logger.js';
import { MarkdownRenderer } from './markdown-renderer.js';
import { ROBOT_ACTIONS } from '../constants/events.js';
import { uiStore } from '../../../core/ui-store.js';
import { withViewTransition } from '../../../core/view-transitions.js';
import { ChatHistoryStore } from './chat-history-store.js';
import { VIEW_TRANSITION_TYPES } from '../../../core/view-transition-types.js';
import {
  createMemoryEditorCard,
  createProfileCard,
  extractStandaloneNameCandidate,
  formatCloudflareMemoriesMessage,
  normalizePromptForProfileRecovery,
} from './robot-chat-profile.js';

const log = createLogger('RobotChat');
const DEFAULT_INPUT_PLACEHOLDER = 'Frag mich etwas...';

function formatRecoveryCandidateSummary(candidate, index) {
  const parts = [];
  const memoryCount = Number(candidate?.memoryCount || 0);
  const latestMemoryAt = Number(candidate?.latestMemoryAt || 0);

  if (memoryCount > 0) {
    parts.push(`${memoryCount} Erinnerung${memoryCount === 1 ? '' : 'en'}`);
  }

  if (latestMemoryAt > 0) {
    parts.push(`zuletzt ${new Date(latestMemoryAt).toLocaleString('de-DE')}`);
  }

  return `Profil ${index + 1}: ${parts.join(' | ') || 'ohne Details'}`;
}

/** Action → prompt mapping for AI routing */
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

/** Action → handler mapping for direct (non-AI) actions */
const DIRECT_ACTION_HANDLERS = {
  [ROBOT_ACTIONS.SHOW_MEMORIES]: 'showStoredCloudflareMemories',
  [ROBOT_ACTIONS.EDIT_PROFILE]: 'openMemoryEditor',
  [ROBOT_ACTIONS.SWITCH_PROFILE]: 'switchActiveProfile',
  [ROBOT_ACTIONS.DISCONNECT_PROFILE]: 'disconnectCurrentDeviceProfile',
  [ROBOT_ACTIONS.CLEAR_CHAT]: 'clearHistory',
};

export class RobotChat {
  constructor(robot) {
    this.robot = robot;

    /** @type {File|null} Pending image for upload */
    this.pendingImage = null;

    // Runtime chat state
    this.isOpen = false;
    this.isTyping = false;
    this.isResponding = false;
    this.lastGreetedContext = null;
    this.historyStore = new ChatHistoryStore();
    this._responseRequestId = 0;
    this.profileState = {
      userId: '',
      name: '',
      status: 'disconnected',
      label: 'Kein aktives Profil',
      recovery: null,
    };
    this.pendingRecoveryPrompt = '';

    // Session-only in-memory history
    this.history = this.historyStore.load();
  }

  destroy() {
    this.cancelActiveResponse('destroyed');
    this.clearImagePreview();
  }

  // ─── Response Request ID Management ──────────────────────────────────────────

  createResponseRequestId() {
    return ++this._responseRequestId;
  }

  isActiveResponseRequest(requestId) {
    return requestId === this._responseRequestId;
  }

  cancelActiveResponse(reason = 'cancelled') {
    this.createResponseRequestId();
    this.isResponding = false;
    if (this.isTyping) {
      this.removeTyping();
    } else {
      this.robot.stateManager.setState({ isTyping: false });
    }
    this.robot.animationModule.stopThinking();
    this.robot.animationModule.stopSpeaking();
    this.syncComposerState();
    void this._cancelAgentRequest(reason);
  }

  // ─── Profile State ──────────────────────────────────────────────────────────

  setProfileState(nextState = {}) {
    this.profileState = {
      ...this.profileState,
      ...nextState,
      recovery:
        nextState.recovery === undefined
          ? this.profileState.recovery
          : nextState.recovery,
    };
    this.syncProfileStatus();
    return this.profileState;
  }

  syncProfileStatus() {
    const statusEl = this.robot.dom.profileStatus;
    if (!statusEl) return;

    const label =
      String(this.profileState?.label || '').trim() || 'Kein aktives Profil';
    const status = String(this.profileState?.status || 'disconnected').trim();

    statusEl.textContent = label;
    statusEl.className = `chat-profile-status chat-profile-status--${status}`;

    const hasBoundProfile =
      Boolean(this.profileState?.userId) &&
      !['disconnected', 'recovery-pending', 'conflict'].includes(status);

    const profileBtns = [
      this.robot.dom.memoriesBtn,
      this.robot.dom.editMemoryBtn,
    ];
    for (const btn of profileBtns) {
      if (!btn) continue;
      btn.disabled = !hasBoundProfile;
      btn.setAttribute('aria-disabled', String(!hasBoundProfile));
    }
  }

  async syncProfileStateFromService() {
    try {
      const agentService =
        this.robot.peekAgentService?.() || (await this.robot.getAgentService());
      const profileState = agentService.getProfileState?.();
      if (profileState) this.setProfileState(profileState);
    } catch {
      /* ignore */
    }
  }

  // ─── Chat Toggle ────────────────────────────────────────────────────────────

  toggleChat(forceState) {
    const newState =
      forceState ?? !this.robot.stateManager.signals.isChatOpen.value;

    if (newState) {
      this.robot.ensureChatWindowCreated();
    }

    const win = this.robot.dom.window;
    const vtSupported = typeof document.startViewTransition === 'function';
    if (vtSupported && win) win.classList.add('vt-animating');

    withViewTransition(() => this._applyVisualChatState(newState), {
      types: [
        newState
          ? VIEW_TRANSITION_TYPES.CHAT_OPEN
          : VIEW_TRANSITION_TYPES.CHAT_CLOSE,
      ],
    }).finally(() => {
      if (win) win.classList.remove('vt-animating');
    });
  }

  _applyVisualChatState(newState) {
    if (newState) {
      this.robot.dom.window.classList.add('open');
      this.robot.dom.container.classList.add('robot-chat--open');
      this.isOpen = true;
      this.robot.stateManager.setState({ isChatOpen: true });
      uiStore.setState({ robotChatOpen: true });

      this.hideBubble();
      this.robot.animationModule.stopIdleEyeMovement();
      this.robot.animationModule.stopBlinkLoop();
      void this.syncProfileStateFromService();
      this.lastGreetedContext = this.robot.getPageContext();

      if (this.robot.dom.messages.children.length === 0) {
        if (this.history.length > 0) {
          this.restoreMessages();
        } else {
          this.handleAction(ROBOT_ACTIONS.START);
        }
      }

      globalThis?.a11y?.trapFocus(this.robot.dom.window);
      this.syncComposerState();
    } else {
      this.robot.dom.window.classList.remove('open');
      this.robot.dom.container.classList.remove('robot-chat--open');
      this.isOpen = false;
      this.robot.stateManager.setState({ isChatOpen: false });
      uiStore.setState({ robotChatOpen: false });

      this.robot.animationModule.startIdleEyeMovement();
      this.robot.animationModule.startBlinkLoop();
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
      this.toggleChat(true);
    })();
  }

  // ─── User Message Handling ──────────────────────────────────────────────────

  async handleUserMessage() {
    const text = this.robot.dom.input.value.trim();
    const hasPendingImage = !!this.pendingImage;

    if (!text && !hasPendingImage) {
      this.syncComposerState();
      return;
    }
    if (this.isTyping || this.isResponding) return;

    // Show user message
    if (hasPendingImage) {
      this.addImageMessage(text, this.pendingImage);
    } else {
      this.addMessage(text, 'user');
    }
    this.robot.dom.input.value = '';
    this.isResponding = true;
    this.syncComposerState();
    const requestId = this.createResponseRequestId();

    this.showTyping();
    this.robot.animationModule.startThinking();
    this.robot.trackInteraction();

    try {
      this.robot.animationModule.startSpeaking();
      const normalizedPrompt = hasPendingImage
        ? text
        : normalizePromptForProfileRecovery(text, this.profileState);
      const response = await this._streamAgentResponse(
        async (agentService, onChunk) => {
          if (hasPendingImage) {
            const imageFile = this.pendingImage;
            this.clearImagePreview();
            return agentService.analyzeImage(imageFile, text, onChunk);
          }
          return agentService.generateResponse(normalizedPrompt, onChunk);
        },
        { requestId },
      );

      if (response?.aborted || !this.isActiveResponseRequest(requestId)) return;
      this.applyAgentResponseMeta(response, { originalPrompt: text });

      if (response.toolResults?.length) {
        this.showToolCallResults(response.toolResults);
      }
    } catch (e) {
      if (!this.isActiveResponseRequest(requestId)) return;
      log.error('generateResponse failed', e);
      this.removeTyping();
      this.robot.animationModule.stopThinking();
      this.robot.animationModule.stopSpeaking();
      this.addMessage(
        'Fehler bei der Verbindung. Bitte erneut versuchen.',
        'bot',
      );
    } finally {
      if (this.isActiveResponseRequest(requestId)) {
        this.isResponding = false;
        this.syncComposerState();
      }
    }
  }

  // ─── Streaming ──────────────────────────────────────────────────────────────

  async _streamAgentResponse(runRequest, { requestId } = {}) {
    const agentService = await this.robot.getAgentService();
    let streamingMessageEl = null;
    let typingRemoved = false;

    let response;
    try {
      response = await runRequest(agentService, (chunk) => {
        if (!this.isActiveResponseRequest(requestId)) return;
        if (!typingRemoved) {
          this.removeTyping();
          typingRemoved = true;
        }
        if (!streamingMessageEl) {
          streamingMessageEl = this.createStreamingMessage();
        }
        this.updateStreamingMessage(streamingMessageEl, chunk);
      });
    } catch (error) {
      streamingMessageEl?.remove();
      if (!this.isActiveResponseRequest(requestId)) {
        return { aborted: true, text: '' };
      }
      throw error;
    }

    if (!this.isActiveResponseRequest(requestId) || response?.aborted) {
      streamingMessageEl?.remove();
      if (!typingRemoved) this.removeTyping();
      this.robot.animationModule.stopThinking();
      this.robot.animationModule.stopSpeaking();
      return { aborted: true, text: '' };
    }

    this.robot.animationModule.stopThinking();

    if (response?.hasMemory && streamingMessageEl) {
      streamingMessageEl.appendChild(
        this.robot.domBuilder.createMemoryIndicator(),
      );
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

    // Force-sync with final server message text
    if (response?.text) {
      this.updateStreamingMessage(streamingMessageEl, response.text);
    }
    this.finalizeStreamingMessage(streamingMessageEl);
    return response;
  }

  // ─── Agent Response Post-Processing ─────────────────────────────────────────

  applyAgentResponseMeta(response, { originalPrompt = '' } = {}) {
    if (response?.profile) {
      this.setProfileState(response.profile);
    } else {
      void this.syncProfileStateFromService();
    }

    const recovery = response?.recovery || this.profileState.recovery || null;
    if (!recovery?.status) {
      this.pendingRecoveryPrompt = '';
      this.setProfileState({ recovery: null });
      this.removeProfileCards('recovery');
      return;
    }

    this.pendingRecoveryPrompt = originalPrompt || this.pendingRecoveryPrompt;
    if (recovery.status === 'conflict') {
      this.removeProfileCards('recovery');
      const candidates = Array.isArray(recovery?.candidates)
        ? recovery.candidates.filter((candidate) => candidate?.userId)
        : [];
      const candidateText =
        candidates.length > 0
          ? `Waehle das passende Profil:\n${candidates
              .slice(0, 3)
              .map((candidate, index) =>
                formatRecoveryCandidateSummary(candidate, index),
              )
              .join('\n')}`
          : 'Dieser Name ist nicht eindeutig. Nutze dieses Gerät getrennt oder wechsle bewusst auf ein anderes Profil.';
      const card = createProfileCard({
        kind: 'recovery',
        title: `Mehrere Profile für ${recovery.name || 'diesen Namen'}`,
        text: candidateText,
        actions: [
          ...candidates.slice(0, 3).map((candidate, index) => ({
            label: `Profil ${index + 1} laden`,
            onClick: () =>
              void this.activateRecoveryCandidate(
                candidate,
                recovery.name || candidate?.name || '',
              ),
          })),
          {
            label: 'Anderes Profil',
            onClick: () => void this.useDifferentProfile(),
          },
          {
            label: 'Gerät trennen',
            onClick: () => void this.disconnectCurrentDeviceProfile(),
          },
        ],
      });
      this.appendProfileCard(card);
    }
  }

  // ─── Profile Cards ─────────────────────────────────────────────────────────

  removeProfileCards(kind = '') {
    const selector = kind
      ? `.chat-profile-card[data-card-kind="${kind}"]`
      : '.chat-profile-card';
    this.robot.dom.messages
      ?.querySelectorAll(selector)
      ?.forEach((node) => node.remove());
  }

  appendProfileCard(card) {
    if (!card || !this.robot.dom.messages) return;
    this.robot.dom.messages.appendChild(card);
    this.scrollToBottom();
  }

  // ─── Tool Results ───────────────────────────────────────────────────────────

  showToolCallResults(toolResults) {
    if (!this.robot.dom.messages) return;
    withViewTransition(
      () => {
        for (const result of toolResults) {
          this.robot.dom.messages.appendChild(
            this.robot.domBuilder.createToolCallIndicator(
              result.name,
              result.message,
            ),
          );
        }
        this.scrollToBottom();
      },
      { types: [VIEW_TRANSITION_TYPES.CHAT_TOOL_RESULT] },
    );
  }

  // ─── Image Handling ─────────────────────────────────────────────────────────

  addImageMessage(text, imageFile) {
    const msg = document.createElement('div');
    msg.className = 'message user';
    const timestamp = Date.now();

    if (text) {
      const textEl = document.createElement('div');
      textEl.textContent = text;
      msg.appendChild(textEl);
    }

    const img = document.createElement('img');
    img.className = 'user-image';
    img.alt = imageFile.name || 'Hochgeladenes Bild';
    img.src = URL.createObjectURL(imageFile);
    img.onload = () => URL.revokeObjectURL(img.src);

    msg.appendChild(img);
    msg.appendChild(
      this.robot.domBuilder.createMessageMeta(timestamp, { sender: 'Du' }),
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

  handleImageUpload(file) {
    if (!file) return;
    this.clearImagePreview();
    this.pendingImage = file;

    const src = URL.createObjectURL(file);
    const preview = this.robot.domBuilder.createImagePreview(src, file.name);

    const inputArea =
      this.robot.dom.inputArea || document.getElementById('robot-input-area');
    if (inputArea?.parentNode) {
      inputArea.parentNode.insertBefore(preview, inputArea);
    }

    const removeBtn = preview.querySelector('.chat-preview-remove');
    removeBtn?.addEventListener('click', () => this.clearImagePreview());

    if (this.robot.dom.input) {
      this.robot.dom.input.placeholder =
        'Beschreibe das Bild oder sende es direkt...';
      this.robot.dom.input.focus();
    }
    this.syncComposerState();
  }

  clearImagePreview() {
    this.pendingImage = null;

    const preview = document.getElementById('robot-image-preview');
    if (preview) {
      const img = preview.querySelector('img');
      if (img?.src?.startsWith('blob:')) URL.revokeObjectURL(img.src);
      preview.remove();
    }

    if (this.robot.dom.input) {
      this.robot.dom.input.placeholder = DEFAULT_INPUT_PLACEHOLDER;
    }
    this.syncComposerState();
  }

  // ─── Streaming Messages ─────────────────────────────────────────────────────

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

  finalizeStreamingMessage(messageEl) {
    messageEl.querySelector('.streaming-cursor')?.remove();
    messageEl.classList.remove('streaming');
    this.robot.animationModule.stopSpeaking();

    const textSpan = messageEl.querySelector('.streaming-text');
    const text = textSpan?.innerText || textSpan?.textContent || '';
    const timestamp =
      Number.parseInt(messageEl.dataset.timestamp || '', 10) || Date.now();

    messageEl.appendChild(
      this.robot.domBuilder.createMessageMeta(timestamp, { sender: 'Jules' }),
    );

    this.history = this.historyStore.append(this.history, {
      role: 'model',
      text,
      timestamp,
    });
  }

  // ─── Bubble ─────────────────────────────────────────────────────────────────

  showBubble(text) {
    if (this.robot.disableLocalBubbleTexts || this.isOpen) return;
    if (!this.robot.dom.bubble || !this.robot.dom.bubbleText) return;
    this.robot.dom.bubbleText.textContent = String(text || '').trim();
    this.robot.dom.bubble.classList.add('visible');
  }

  hideBubble() {
    this.robot.dom.bubble?.classList.remove('visible');
  }

  // ─── Typing Indicator ──────────────────────────────────────────────────────

  showTyping() {
    if (this.isTyping) return;
    this.isTyping = true;
    this.robot.stateManager.setState({ isTyping: true });

    withViewTransition(
      () => {
        this.robot.dom.messages.appendChild(
          this.robot.domBuilder.createTypingIndicator(),
        );
        this.scrollToBottom();
        this.syncComposerState();
      },
      { types: [VIEW_TRANSITION_TYPES.CHAT_TYPING_SHOW] },
    );
  }

  removeTyping() {
    this.isTyping = false;
    this.robot.stateManager.setState({ isTyping: false });

    withViewTransition(
      () => {
        document.getElementById('robot-typing')?.remove();
        this.syncComposerState();
      },
      { types: [VIEW_TRANSITION_TYPES.CHAT_TYPING_HIDE] },
    );
  }

  // ─── Messages ───────────────────────────────────────────────────────────────

  renderMessage(
    text,
    type = 'bot',
    skipParsing = false,
    timestamp = Date.now(),
  ) {
    const renderFn = () => {
      const msg = document.createElement('div');
      msg.className = `message ${type}`;

      if (type === 'user') {
        msg.textContent = String(text || '');
      } else if (skipParsing) {
        msg.innerHTML = String(text || '');
      } else {
        msg.innerHTML = MarkdownRenderer.parse(String(text || ''));
      }

      msg.appendChild(
        this.robot.domBuilder.createMessageMeta(timestamp, {
          sender: type === 'user' ? 'Du' : 'Jules',
        }),
      );

      this.robot.dom.messages.appendChild(msg);
      this.scrollToBottom();
    };

    if (this.robot.dom.messages.offsetParent !== null) {
      withViewTransition(renderFn, {
        types: [VIEW_TRANSITION_TYPES.CHAT_MESSAGE_ADD],
      });
    } else {
      renderFn();
    }
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
    for (const item of this.history) {
      this.renderMessage(
        item.text,
        item.role === 'user' ? 'user' : 'bot',
        false,
        item.timestamp,
      );
    }
  }

  // ─── History Management ─────────────────────────────────────────────────────

  clearHistory() {
    if (this.isResponding || this.isTyping) {
      this.cancelActiveResponse('history-cleared');
    }
    this.resetConversationView();
    this.handleAction(ROBOT_ACTIONS.START);
  }

  resetConversationView() {
    this.history = [];
    this.historyStore.clear();
    this.clearImagePreview();
    this.removeProfileCards();
    this.pendingRecoveryPrompt = '';

    withViewTransition(
      () => {
        const messages = this.robot.dom.messages;
        if (messages) {
          while (messages.firstChild) messages.removeChild(messages.firstChild);
        }
        this.syncComposerState();
      },
      { types: [VIEW_TRANSITION_TYPES.CHAT_CLEAR] },
    );

    void this._clearAgentHistory();
  }

  // ─── Profile Operations ─────────────────────────────────────────────────────

  async useDifferentProfile() {
    try {
      const agentService = await this.robot.getAgentService();
      const profileState = agentService.startFreshLocalProfile?.();
      this.pendingRecoveryPrompt = '';
      if (profileState)
        this.setProfileState({ ...profileState, recovery: null });
      this.removeProfileCards('recovery');
      this.addMessage(
        'Okay. Dieses Gerät nutzt jetzt ein anderes Profil. Nenne mir deinen Namen, z. B. "Ich heiße Alex", oder teile neue Infos mit.',
        'bot',
      );
    } catch (error) {
      log.warn('useDifferentProfile failed', error);
    }
  }

  async switchActiveProfile() {
    if (this.isResponding) return;

    const confirmed =
      typeof window?.confirm !== 'function' ||
      window.confirm(
        'Aktives Profil auf diesem Gerät trennen und für ein anderes Profil vorbereiten?',
      );
    if (!confirmed) return;

    this.isResponding = true;
    this.syncComposerState();

    try {
      const agentService = await this.robot.getAgentService();
      const result = await agentService.disconnectCurrentDevice?.();
      this.resetConversationView();
      this.pendingRecoveryPrompt = '';
      this.setProfileState({
        ...(result?.profile || agentService.getProfileState?.()),
        recovery: null,
      });
      this.addMessage(
        'Dieses Gerät ist jetzt frei für ein anderes Profil. Sag mir deinen Namen, z. B. "Ich heiße Alex".',
        'bot',
      );
    } catch (error) {
      log.warn('switchActiveProfile failed', error);
      this.addMessage('Das Profil konnte nicht gewechselt werden.', 'bot');
    } finally {
      this.isResponding = false;
      this.syncComposerState();
    }
  }

  async disconnectCurrentDeviceProfile() {
    if (this.isResponding) return;

    const confirmed =
      typeof window?.confirm !== 'function' ||
      window.confirm('Dieses Gerät wirklich vom aktiven Profil trennen?');
    if (!confirmed) return;

    this.isResponding = true;
    this.syncComposerState();

    try {
      const agentService = await this.robot.getAgentService();
      const result = await agentService.disconnectCurrentDevice?.();
      this.resetConversationView();
      this.pendingRecoveryPrompt = '';
      this.setProfileState({
        ...(result?.profile || agentService.getProfileState?.()),
        recovery: null,
      });
      this.addMessage(
        result?.text ||
          'Dieses Gerät ist nicht mehr mit einem Profil verbunden.',
        'bot',
      );
    } catch (error) {
      log.warn('disconnectCurrentDeviceProfile failed', error);
      this.addMessage('Das Gerät konnte nicht getrennt werden.', 'bot');
    } finally {
      this.isResponding = false;
      this.syncComposerState();
    }
  }

  async activateRecoveryCandidate(candidate, recoveryName = '') {
    if (this.isResponding) return;

    this.isResponding = true;
    this.syncComposerState();
    this.showTyping();

    try {
      const agentService = await this.robot.getAgentService();
      const result = await agentService.activateRecoveredProfile?.({
        userId: candidate?.userId,
        name: recoveryName,
      });
      this.removeTyping();

      if (!result?.success) {
        this.addMessage(
          result?.text || 'Das Profil konnte nicht geladen werden.',
          'bot',
        );
        return;
      }

      this.pendingRecoveryPrompt = '';
      this.removeProfileCards('recovery');
      this.setProfileState({
        ...(result.profile || this.profileState),
        recovery: null,
      });

      const memoryMessage = formatCloudflareMemoriesMessage(
        result.memories || [],
        result.retentionDays || 0,
      );
      const combinedMessage = result.text
        ? `${result.text}\n\n${memoryMessage}`
        : memoryMessage;

      this.addMessage(combinedMessage, 'bot');
    } catch (error) {
      this.removeTyping();
      log.warn('activateRecoveryCandidate failed', error);
      this.addMessage('Das Profil konnte nicht geladen werden.', 'bot');
    } finally {
      this.isResponding = false;
      this.syncComposerState();
    }
  }

  // ─── Memory Editor ──────────────────────────────────────────────────────────

  async showStoredCloudflareMemories() {
    if (this.isResponding) return;

    if (this.profileState?.recovery?.status === 'conflict') {
      this.applyAgentResponseMeta({
        profile: this.profileState,
        recovery: this.profileState.recovery,
      });
      this.addMessage(
        'Bitte waehle zuerst eines der gefundenen Profile.',
        'bot',
      );
      return;
    }

    this.isResponding = true;
    this.syncComposerState();
    this.showTyping();
    const requestId = this.createResponseRequestId();

    try {
      const agentService = await this.robot.getAgentService();
      const result = await agentService.listCloudflareMemories?.();
      if (!this.isActiveResponseRequest(requestId)) return;
      this.removeTyping();

      if (result?.success) {
        this.setProfileState(result.profile || this.profileState);
        this.addMessage(
          formatCloudflareMemoriesMessage(
            result.memories || [],
            result.retentionDays || 0,
          ),
          'bot',
        );
        return;
      }

      this.addMessage(
        result?.text || 'Cloudflare-Erinnerungen konnten nicht geladen werden.',
        'bot',
      );
    } catch (error) {
      if (!this.isActiveResponseRequest(requestId)) return;
      this.removeTyping();
      log.warn('showStoredCloudflareMemories failed', error);
      this.addMessage(
        'Cloudflare-Erinnerungen konnten nicht geladen werden.',
        'bot',
      );
    } finally {
      if (this.isActiveResponseRequest(requestId)) {
        this.isResponding = false;
        this.syncComposerState();
      }
    }
  }

  async openMemoryEditor() {
    if (this.isResponding) return;

    if (this.profileState?.recovery?.status === 'conflict') {
      this.applyAgentResponseMeta({
        profile: this.profileState,
        recovery: this.profileState.recovery,
      });
      this.addMessage(
        'Bitte waehle zuerst eines der gefundenen Profile.',
        'bot',
      );
      return;
    }

    this.removeProfileCards('editor');
    const agentService = await this.robot.getAgentService();
    const result = await agentService.listCloudflareMemories?.();
    if (!result?.success) {
      this.addMessage(
        result?.text || 'Profil-Erinnerungen konnten nicht geladen werden.',
        'bot',
      );
      return;
    }

    this.setProfileState(result.profile || this.profileState);
    this._renderMemoryEditorCard(result.memories || []);
  }

  _renderMemoryEditorCard(memories) {
    const card = createMemoryEditorCard(memories, {
      onEdit: (entry) => void this.editSingleMemory(entry),
      onDelete: (entry) => void this.deleteSingleMemory(entry),
      onClose: () => {},
    });
    this.appendProfileCard(card);
  }

  async editSingleMemory(entry) {
    const currentValue = String(entry?.value || '').trim();
    const nextValue = window?.prompt?.(
      `${String(entry?.key || 'memory')} aktualisieren`,
      currentValue,
    );
    if (nextValue == null) return;

    const value = String(nextValue).trim();
    if (!value) return;

    const agentService = await this.robot.getAgentService();
    const result = await agentService.updateCloudflareMemory?.({
      key: entry?.key,
      value,
      previousValue: currentValue,
    });

    if (!result?.success) {
      this.addMessage(
        result?.text || 'Erinnerung konnte nicht aktualisiert werden.',
        'bot',
      );
      return;
    }

    this.setProfileState(result.profile || this.profileState);
    this.removeProfileCards('editor');
    this._renderMemoryEditorCard(result.memories || []);
  }

  async deleteSingleMemory(entry) {
    const confirmed =
      typeof window?.confirm !== 'function' ||
      window.confirm(`${String(entry?.key || 'memory')} wirklich entfernen?`);
    if (!confirmed) return;

    const agentService = await this.robot.getAgentService();
    const result = await agentService.forgetCloudflareMemory?.({
      key: entry?.key,
      value: entry?.value,
    });

    if (!result?.success) {
      this.addMessage(
        result?.text || 'Erinnerung konnte nicht entfernt werden.',
        'bot',
      );
      return;
    }

    this.setProfileState(result.profile || this.profileState);
    this.removeProfileCards('editor');
    this._renderMemoryEditorCard(result.memories || []);
  }

  // ─── Agent Helpers ──────────────────────────────────────────────────────────

  async _clearAgentHistory() {
    try {
      this.robot.peekAgentService?.()?.clearHistory?.();
    } catch {
      /* ignore */
    }
  }

  async _cancelAgentRequest(reason = 'cancelled') {
    try {
      this.robot.peekAgentService?.()?.cancelActiveRequest?.(reason);
    } catch {
      /* ignore */
    }
  }

  // ─── Action Router ──────────────────────────────────────────────────────────

  async handleAction(actionKey) {
    this.robot.trackInteraction('action');

    // Direct actions (no AI round-trip needed)
    const directHandler = DIRECT_ACTION_HANDLERS[actionKey];
    if (directHandler) {
      await this[directHandler]();
      return;
    }

    // AI-routed actions
    const prompt =
      ACTION_PROMPTS[actionKey] ||
      `Der Nutzer hat die Aktion "${actionKey}" angefragt. Hilf kurz auf Deutsch und nutze passende Tools nur wenn noetig.`;
    await this._routeToAI(actionKey, prompt);
  }

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
    const requestId = this.createResponseRequestId();

    try {
      const response = await this._streamAgentResponse(
        (agentService, onChunk) =>
          agentService.generateResponse(prompt, onChunk),
        { requestId },
      );
      if (response?.aborted || !this.isActiveResponseRequest(requestId)) return;
      this.applyAgentResponseMeta(response, { originalPrompt: prompt });
    } catch (error) {
      if (!this.isActiveResponseRequest(requestId)) return;
      log.warn(`Action routing failed (${actionKey})`, error);
      this.robot.animationModule.stopThinking();
      this.removeTyping();
      this.addMessage('Da ist etwas schiefgelaufen.', 'bot');
    } finally {
      if (this.isActiveResponseRequest(requestId)) {
        this.isResponding = false;
        this.syncComposerState();
      }
    }
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  scrollToBottom() {
    if (this.robot.dom.messages) {
      this.robot.dom.messages.scrollTop = this.robot.dom.messages.scrollHeight;
    }
  }

  syncComposerState() {
    const sendBtn = this.robot.dom.sendBtn;
    if (!sendBtn) return;

    const hasText = Boolean(this.robot.dom.input?.value?.trim());
    const hasPendingImage = Boolean(this.pendingImage);
    const canSend =
      !this.isTyping && !this.isResponding && (hasText || hasPendingImage);

    sendBtn.disabled = !canSend;
    sendBtn.setAttribute('aria-disabled', String(!canSend));
    sendBtn.classList.toggle('is-ready', canSend);
  }
}

export const __test__ = {
  extractStandaloneNameCandidate,
  normalizePromptForProfileRecovery,
};
