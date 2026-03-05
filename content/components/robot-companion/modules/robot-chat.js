import { createLogger } from '../../../core/logger.js';
import { MarkdownRenderer } from './markdown-renderer.js';
import { ROBOT_ACTIONS } from '../constants/events.js';
import { uiStore } from '../../../core/ui-store.js';
import { withViewTransition } from '../../../core/view-transitions.js';
import { ChatHistoryStore } from './chat-history-store.js';
import { VIEW_TRANSITION_TYPES } from '../../../core/view-transition-types.js';

const log = createLogger('RobotChat');
const DEFAULT_INPUT_PLACEHOLDER = 'Frag mich etwas...';
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

    // Runtime chat state
    this.isOpen = false;
    this.isTyping = false;
    this.isResponding = false;
    this.lastGreetedContext = null;
    this.historyStore = new ChatHistoryStore();

    // Session-only in-memory history
    this.history = this.historyStore.load();
  }

  destroy() {
    this.clearBubbleSequence();
  }

  toggleChat(forceState) {
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

  /**
   * Apply the visual chat state (class toggles, state updates, focus management).
   * Separated so it can be wrapped in a View Transition.
   * @param {boolean} newState
   */
  _applyVisualChatState(newState) {
    if (newState) {
      this.robot.dom.window.classList.add('open');
      this.robot.dom.container.classList.add('robot-chat--open');
      this.isOpen = true;

      // Update state manager (single source of truth)
      this.robot.stateManager.setState({ isChatOpen: true });
      uiStore.setState({ robotChatOpen: true });

      this.clearBubbleSequence();
      this.hideBubble();
      this.robot.animationModule.stopIdleEyeMovement();
      this.robot.animationModule.stopBlinkLoop();
      const ctx = this.robot.getPageContext();
      this.lastGreetedContext = ctx;

      if (this.robot.dom.messages.children.length === 0) {
        if (this.history.length > 0) {
          this.restoreMessages();
        } else {
          this.handleAction(ROBOT_ACTIONS.START);
        }
      }

      // Focus Trap
      globalThis?.a11y?.trapFocus(this.robot.dom.window);
      this.syncComposerState();
    } else {
      this.robot.dom.window.classList.remove('open');
      this.robot.dom.container.classList.remove('robot-chat--open');
      this.isOpen = false;

      // Update state manager (single source of truth)
      this.robot.stateManager.setState({ isChatOpen: false });
      uiStore.setState({ robotChatOpen: false });

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
        async (agentService, onChunk) => {
          if (hasPendingImage) {
            const imageFile = this.pendingImage;
            this.clearImagePreview();
            return agentService.analyzeImage(imageFile, text, onChunk);
          }
          return agentService.generateResponse(text, onChunk);
        },
      );

      if (response.toolResults?.length) {
        this.showToolCallResults(response.toolResults);
      }
    } catch (e) {
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
    let streamingMessageEl = null;
    let typingRemoved = false;

    let response;
    try {
      response = await runRequest(agentService, (chunk) => {
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
      if (streamingMessageEl) {
        streamingMessageEl.remove();
      }
      throw error;
    }

    this.robot.animationModule.stopThinking();

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

  /**
   * Show tool call execution results in chat
   * @param {Array<{name: string, success: boolean, message: string}>} toolResults
   */
  showToolCallResults(toolResults) {
    if (!this.robot.dom.messages) return;

    withViewTransition(
      () => {
        for (const result of toolResults) {
          const indicator = this.robot.domBuilder.createToolCallIndicator(
            result.name,
            result.message,
          );
          this.robot.dom.messages.appendChild(indicator);
        }
        this.scrollToBottom();
      },
      { types: [VIEW_TRANSITION_TYPES.CHAT_TOOL_RESULT] },
    );
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
    const cursor = messageEl.querySelector('.streaming-cursor');
    if (cursor) cursor.remove();
    messageEl.classList.remove('streaming');
    this.robot.animationModule.stopSpeaking();

    const textSpan = messageEl.querySelector('.streaming-text');
    const text = textSpan?.innerText || textSpan?.textContent || '';

    const timestamp =
      Number.parseInt(messageEl.dataset.timestamp || '', 10) || Date.now();
    messageEl.appendChild(
      this.robot.domBuilder.createMessageMeta(timestamp, {
        sender: 'Jules',
      }),
    );

    this.history = this.historyStore.append(this.history, {
      role: 'model',
      text,
      timestamp,
    });
  }

  async handleSummarize() {
    this.toggleChat(true);
    this.showTyping();
    this.robot.animationModule.startThinking();

    try {
      const content = document.body.innerText?.slice(0, 4800) || '';
      const prompt = `Fasse den folgenden Text kurz und präzise auf DEUTSCH zusammen (max 3 Sätze):\n\n${content}`;
      await this._streamAgentResponse((agentService, onChunk) =>
        agentService.generateResponse(prompt, onChunk),
      );
    } catch (error) {
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

    withViewTransition(
      () => {
        // Use DOM Builder for XSS-safe creation
        const typingDiv = this.robot.domBuilder.createTypingIndicator();
        this.robot.dom.messages.appendChild(typingDiv);
        this.scrollToBottom();
        this.syncComposerState();
      },
      { types: [VIEW_TRANSITION_TYPES.CHAT_TYPING_SHOW] },
    );
  }

  removeTyping() {
    const typingDiv = document.getElementById('robot-typing');
    this.isTyping = false;

    // Update state manager
    this.robot.stateManager.setState({ isTyping: false });

    withViewTransition(
      () => {
        if (typingDiv) typingDiv.remove();
        this.syncComposerState();
      },
      { types: [VIEW_TRANSITION_TYPES.CHAT_TYPING_HIDE] },
    );
  }

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
    this.history.forEach((item) => {
      const type = item.role === 'user' ? 'user' : 'bot';
      this.renderMessage(item.text, type, false, item.timestamp);
    });
  }

  clearHistory() {
    this.history = [];
    this.historyStore.clear();
    this.clearImagePreview();

    withViewTransition(
      () => {
        if (this.robot.dom.messages) {
          // Clear messages safely
          while (this.robot.dom.messages.firstChild) {
            this.robot.dom.messages.removeChild(
              this.robot.dom.messages.firstChild,
            );
          }
        }
        this.syncComposerState();
      },
      { types: [VIEW_TRANSITION_TYPES.CHAT_CLEAR] },
    );

    void this._clearAgentHistory();
    this.handleAction(ROBOT_ACTIONS.START);
  }

  formatCloudflareMemoriesMessage(memories = [], retentionDays = 0) {
    if (!Array.isArray(memories) || memories.length === 0) {
      return 'Aktuell sind keine Erinnerungen gespeichert.';
    }

    const source = memories;

    const lines = source.map((entry) => {
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

  async showStoredCloudflareMemories() {
    if (this.isResponding) return;

    this.isResponding = true;
    this.syncComposerState();
    this.showTyping();

    try {
      const agentService = await this.robot.getAgentService();
      const result = await agentService.listCloudflareMemories?.();
      this.removeTyping();

      if (result?.success) {
        this.addMessage(
          this.formatCloudflareMemoriesMessage(
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
      this.removeTyping();
      log.warn('showStoredCloudflareMemories failed', error);
      this.addMessage(
        'Cloudflare-Erinnerungen konnten nicht geladen werden.',
        'bot',
      );
    } finally {
      this.isResponding = false;
      this.syncComposerState();
    }
  }

  async deleteCloudflareUserId() {
    if (this.isResponding) return;

    if (typeof window?.confirm === 'function') {
      const confirmed = window.confirm(
        'User-ID und alle verknuepften Erinnerungen in Cloudflare wirklich loeschen?',
      );
      if (!confirmed) return;
    }

    this.isResponding = true;
    this.syncComposerState();

    try {
      const agentService = await this.robot.getAgentService();
      const result = await agentService.deleteUserIdFromCloudflare?.();

      if (result?.success) {
        this.history = [];
        this.historyStore.clear();
        this.clearImagePreview();

        withViewTransition(
          () => {
            if (this.robot.dom.messages) {
              while (this.robot.dom.messages.firstChild) {
                this.robot.dom.messages.removeChild(
                  this.robot.dom.messages.firstChild,
                );
              }
            }
          },
          { types: [VIEW_TRANSITION_TYPES.CHAT_CLEAR] },
        );

        this.addMessage(
          result.text ||
            'User-ID und Erinnerungen in Cloudflare wurden gelöscht.',
          'bot',
        );
        return;
      }

      this.addMessage(
        result?.text || 'Cloudflare-User-ID konnte nicht gelöscht werden.',
        'bot',
      );
    } catch (error) {
      log.warn('deleteCloudflareUserId failed', error);
      this.addMessage(
        'Cloudflare-User-ID konnte nicht gelöscht werden.',
        'bot',
      );
    } finally {
      this.isResponding = false;
      this.syncComposerState();
    }
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

    if (actionKey === ROBOT_ACTIONS.SHOW_MEMORIES) {
      await this.showStoredCloudflareMemories();
      return;
    }

    if (actionKey === ROBOT_ACTIONS.CLEAR_CHAT) {
      this.clearHistory();
      return;
    }

    if (actionKey === ROBOT_ACTIONS.DELETE_CLOUDFLARE_USER) {
      await this.deleteCloudflareUserId();
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
      await this._streamAgentResponse((agentService, onChunk) =>
        agentService.generateResponse(prompt, onChunk),
      );
    } catch (error) {
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

    const hasText = Boolean(this.robot.dom.input?.value?.trim());
    const hasPendingImage = Boolean(this.pendingImage);
    const canSend =
      !this.isTyping && !this.isResponding && (hasText || hasPendingImage);

    sendBtn.disabled = !canSend;
    sendBtn.setAttribute('aria-disabled', String(!canSend));
    sendBtn.classList.toggle('is-ready', canSend);
  }

  clearBubbleSequence() {
    // No-op: local bubble sequences are disabled in Cloudflare AI-only mode.
  }
}
