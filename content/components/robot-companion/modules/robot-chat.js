import { createLogger } from '../../../core/logger.js';
import { MarkdownRenderer } from './markdown-renderer.js';
import { ROBOT_ACTIONS } from '../constants/events.js';
import { executeTool } from './tool-executor.js';
import { uiStore } from '../../../core/ui-store.js';
import { withViewTransition } from '../../../core/view-transitions.js';
import { ChatHistoryStore } from './chat-history-store.js';

const log = createLogger('RobotChat');
const DEFAULT_INPUT_PLACEHOLDER = 'Frag mich etwas oder nutze /help';

export class RobotChat {
  constructor(robot) {
    this.robot = robot;

    /** @type {File|null} Pending image for upload */
    this.pendingImage = null;

    // Use state manager for chat state
    // Legacy properties for backward compatibility (deprecated)
    this.isOpen = false;
    this.isTyping = false;
    this.lastGreetedContext = null;

    // track whether we've already bound focus/blur handlers
    this._controlsTypingBound = false;

    this._bubbleSequenceTimers = [];
    this.contextGreetingHistory = {};
    this.initialBubblePoolCursor = [];
    this.historyStore = new ChatHistoryStore();

    // Load history (supports legacy format migration)
    this.history = this.historyStore.load();
  }

  destroy() {
    this.clearBubbleSequence();
    this._bubbleSequenceTimers = [];
  }

  toggleChat(forceState) {
    const newState =
      forceState ?? !this.robot.stateManager.getState().isChatOpen;

    // DOM-Erstellung & Event-Binding AUSSERHALB der View Transition
    // (VT darf nur DOM-Mutationen wrappen, nicht DOM-Erstellung)
    if (newState) {
      this.robot.ensureChatWindowCreated();

      // attach focus/blur handlers once we know input exists
      if (!this._controlsTypingBound && this.robot.dom.input) {
        this.robot.dom.input.addEventListener('focus', () => {
          this.robot.dom.controls?.classList.add('typing');
        });
        this.robot.dom.input.addEventListener('blur', () => {
          this.robot.dom.controls?.classList.remove('typing');
        });
        this._controlsTypingBound = true;
      }
    }

    // Visuelle State-Änderungen in View Transition wrappen.
    // CSS-Transitions nur deaktivieren wenn VT tatsächlich unterstützt wird,
    // damit Browser ohne VT die CSS-Fallback-Animation behalten.
    const win = this.robot.dom.window;
    const vtSupported = typeof document.startViewTransition === 'function';
    if (vtSupported && win) win.classList.add('vt-animating');

    withViewTransition(() => this._applyVisualChatState(newState), {
      types: [newState ? 'chat-open' : 'chat-close'],
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
      this.isOpen = true; // kept for backward compat — prefer stateManager

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
    } else {
      this.robot.dom.window.classList.remove('open');
      this.robot.dom.container.classList.remove('robot-chat--open');
      this.isOpen = false; // kept for backward compat — prefer stateManager

      // Update state manager (single source of truth)
      this.robot.stateManager.setState({ isChatOpen: false });
      uiStore.setState({ robotChatOpen: false });

      this.robot.animationModule.startIdleEyeMovement();
      this.robot.animationModule.startBlinkLoop();

      // Release Focus
      globalThis?.a11y?.releaseFocus();
    }
  }

  _parseSlashCommand(text) {
    if (!text || !text.startsWith('/')) return null;
    const [rawCommand, ...args] = text.slice(1).trim().split(/\s+/);
    const command = String(rawCommand || '').toLowerCase();
    if (!command) return null;
    return { command, args };
  }

  async _handleSlashCommand(command, _args = []) {
    switch (command) {
      case 'help':
        this.addMessage(
          [
            'Verfuegbare Befehle:',
            '- `/help` zeigt diese Hilfe',
            '- `/clear` startet eine neue Unterhaltung',
            '- `/export` exportiert den Chat als JSON',
          ].join('\n'),
          'bot',
        );
        return true;
      case 'clear':
      case 'new':
        this.clearHistory();
        return true;
      case 'export': {
        const ok = this.exportHistory();
        this.addMessage(
          ok
            ? 'Export erstellt. Die Datei wurde heruntergeladen.'
            : 'Noch kein Verlauf zum Exportieren vorhanden.',
          'bot',
        );
        return true;
      }
      default:
        this.addMessage(
          `Unbekannter Befehl: /${command}. Nutze /help fuer die Liste.`,
          'bot',
        );
        return true;
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

    if (!text && !hasPendingImage) return;
    if (this.isTyping) return;

    const slashCommand = !hasPendingImage
      ? this._parseSlashCommand(text)
      : null;
    if (slashCommand) {
      this.robot.dom.input.value = '';
      await this._handleSlashCommand(slashCommand.command, slashCommand.args);
      return;
    }

    // Show user message (with image thumbnail if present)
    if (hasPendingImage) {
      this.addImageMessage(text, this.pendingImage);
    } else {
      this.addMessage(text, 'user');
    }
    this.robot.dom.input.value = '';

    // Check for active mini-games
    if (this.robot.gameModule.state.guessNumberActive) {
      this.robot.gameModule.handleGuessNumber(text);
      this.clearImagePreview();
      return;
    }

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

    this.finalizeStreamingMessage(streamingMessageEl);
    return response;
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
  }

  removeTyping() {
    const typingDiv = document.getElementById('robot-typing');
    if (typingDiv) typingDiv.remove();
    this.isTyping = false;

    // Update state manager
    this.robot.stateManager.setState({ isTyping: false });
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
    this.clearControls();
    if (this.robot.dom.messages) {
      // Clear messages safely
      while (this.robot.dom.messages.firstChild) {
        this.robot.dom.messages.removeChild(this.robot.dom.messages.firstChild);
      }
    }

    void this._clearAgentHistory();
    this.handleAction(ROBOT_ACTIONS.START);
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

  clearControls() {
    if (this.robot.dom.controls) {
      // Clear controls safely
      while (this.robot.dom.controls.firstChild) {
        this.robot.dom.controls.removeChild(this.robot.dom.controls.firstChild);
      }
    }
  }

  addOptions(options) {
    this.clearControls();
    if (!this.robot.dom.controls) return;
    options.forEach((opt) => {
      const btn = this.robot.domBuilder.createOptionButton(opt.label, () => {
        this.addMessage(opt.label, 'user');
        this.robot._setTimeout(() => {
          if (opt.url) {
            globalThis?.open?.(opt.url, opt.target || '_self');
            if (opt.target === '_blank') this.handleAction(ROBOT_ACTIONS.START);
          } else if (opt.action) {
            if (opt.action.startsWith('triviaAnswer_')) {
              const answerIdx = Number.parseInt(opt.action.split('_')[1], 10);
              this.robot.gameModule.handleTriviaAnswer(answerIdx);
            } else {
              this.handleAction(opt.action);
            }
          }
        }, 300);
      });
      this.robot.dom.controls.appendChild(btn);
    });
  }

  handleAction(actionKey) {
    this.robot.trackInteraction('action');

    const actions = {
      [ROBOT_ACTIONS.SUMMARIZE_PAGE]: () => this.handleSummarize(),
      [ROBOT_ACTIONS.SCROLL_FOOTER]: () => {
        this.robot.dom.footer?.scrollIntoView({ behavior: 'smooth' });
        this.showTyping();
        this.robot._setTimeout(() => {
          this.removeTyping();
          this.addMessage('Ich habe dich nach unten gebracht! 👇', 'bot');
          this.robot._setTimeout(
            () => this.handleAction(ROBOT_ACTIONS.START),
            2000,
          );
        }, 1000);
      },
      [ROBOT_ACTIONS.PLAY_TIC_TAC_TOE]: () =>
        this.robot.gameModule.startTicTacToe(),
      [ROBOT_ACTIONS.PLAY_TRIVIA]: () => this.robot.gameModule.startTrivia(),
      [ROBOT_ACTIONS.PLAY_GUESS_NUMBER]: () =>
        this.robot.gameModule.startGuessNumber(),
      [ROBOT_ACTIONS.UPLOAD_IMAGE]: () => {
        const fileInput = document.getElementById('robot-image-upload');
        if (fileInput) {
          fileInput.click();
        }
        this.addMessage(
          '📷 Lade ein Bild hoch und ich analysiere es für dich!',
          'bot',
        );
      },
      [ROBOT_ACTIONS.TOGGLE_THEME]: () => {
        try {
          const result = executeTool({
            name: 'setTheme',
            arguments: { theme: 'toggle' },
          });
          this.addMessage(result.message, 'bot');
        } catch {
          this.addMessage('Theme konnte nicht gewechselt werden.', 'bot');
        }
        this.robot._setTimeout(
          () => this.handleAction(ROBOT_ACTIONS.START),
          2000,
        );
      },
      [ROBOT_ACTIONS.SEARCH_WEBSITE]: () => {
        this.addMessage(
          '🔍 Schreib einfach wonach du suchst — ich durchsuche die Website für dich!',
          'bot',
        );
      },
    };

    if (actions[actionKey]) {
      actions[actionKey]();
      return;
    }

    // Route unknown actions to knowledgeBase if available
    const data = this.knowledgeBase?.[actionKey];
    if (!data) return;

    this.showTyping();
    this.robot.dom.avatar.classList.add('nod');
    this.robot._setTimeout(
      () => this.robot.dom.avatar.classList.remove('nod'),
      650,
    );

    // AI-powered START-Nachricht
    if (actionKey === ROBOT_ACTIONS.START) {
      const greetings = Array.isArray(data.text) ? data.text : [data.text];
      let pick = greetings[Math.floor(Math.random() * greetings.length)];

      if (Math.random() < 0.3) {
        pick = this.robot.getMoodGreeting() || pick;
      } else {
        const ctx = this.robot.getPageContext();
        const suffix = String(this.startMessageSuffix?.[ctx] ?? '').trim();
        if (suffix) pick = `${String(pick || '').trim()} ${suffix}`.trim();
      }

      this.robot._setTimeout(() => {
        this.removeTyping();
        this.addMessage(pick, 'bot');
        if (data.options) this.addOptions(data.options);
      }, 800);
      return;
    }

    // Statische Menüs (explore, games, extras) — nur Optionen anzeigen
    if (data.options?.length) {
      const text = Array.isArray(data.text)
        ? data.text[Math.floor(Math.random() * data.text.length)]
        : data.text;
      this.robot._setTimeout(() => {
        this.removeTyping();
        this.addMessage(text || '', 'bot');
        this.addOptions(data.options);
      }, 600);
      return;
    }

    // Alle anderen Inhalte (joke, fact etc.) → über AI streamen
    this.removeTyping();
    this._routeToAI(actionKey);
  }

  /** Route action to AI for dynamic response */
  async _routeToAI(actionKey) {
    const prompts = {
      joke: 'Erzähle einen kurzen, lustigen Programmierer-Witz auf Deutsch. Max 2 Sätze.',
      fact: 'Nenne einen faszinierenden Weltraum-Fakt auf Deutsch. Max 2 Sätze.',
    };
    const prompt =
      prompts[actionKey] ||
      `Antworte kurz zum Thema "${actionKey}" auf Deutsch.`;

    this.showTyping();
    this.robot.animationModule.startThinking();

    try {
      await this._streamAgentResponse((agentService, onChunk) =>
        agentService.generateResponse(prompt, onChunk),
      );
    } catch (error) {
      log.warn('Action routing failed', error);
      this.robot.animationModule.stopThinking();
      this.removeTyping();
      this.addMessage('Da ist etwas schiefgelaufen.', 'bot');
    }

    // Zurück zum Start nach Witz/Fakt
    this.robot._setTimeout(() => {
      const startData = this.knowledgeBase?.start;
      if (startData?.options) {
        this.addOptions([
          { label: 'Noch einmal!', action: actionKey },
          { label: '↩️ Zurück', action: 'start' },
        ]);
      }
    }, 500);
  }

  scrollToBottom() {
    if (this.robot.dom.messages) {
      this.robot.dom.messages.scrollTop = this.robot.dom.messages.scrollHeight;
    }
  }

  clearBubbleSequence() {
    if (!this._bubbleSequenceTimers) return;
    this._bubbleSequenceTimers.forEach((t) => this.robot._clearTimeout(t));
    this._bubbleSequenceTimers = [];
  }

  getContextGreetingForContext(ctxArr, ctxKey) {
    if (!ctxArr || ctxArr.length === 0) return null;
    if (!this.contextGreetingHistory[ctxKey])
      this.contextGreetingHistory[ctxKey] = new Set();
    const used = this.contextGreetingHistory[ctxKey];
    let candidates = ctxArr.filter((g) => !used.has(g));
    if (candidates.length === 0) {
      used.clear();
      candidates = ctxArr.slice();
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    used.add(pick);
    return pick;
  }

  _computeInitialPicks(ctx, ctxArr, pools, maxSteps) {
    const picks = [];

    const nextFromPool = (poolIdx) => {
      if (!pools?.length) return null;
      const idx = poolIdx % pools.length;
      const pool = pools[idx];
      if (!pool || pool.length === 0) return null;
      const cursor = this.initialBubblePoolCursor[idx] || 0;
      const pick = pool[cursor % pool.length];
      this.initialBubblePoolCursor[idx] = (cursor + 1) % pool.length;
      return String(pick || '').trim();
    };

    const fillFromPools = (startIndex = 0) => {
      let poolIndex = startIndex;
      let attempts = 0;
      while (picks.length < maxSteps && attempts < maxSteps * 4) {
        const candidate = nextFromPool(poolIndex);
        poolIndex++;
        attempts++;
        if (candidate) picks.push(candidate);
      }
    };

    if (Math.random() < 0.4) {
      const moodGreet = this.robot.getMoodGreeting();
      if (moodGreet) picks.push(moodGreet);
    }

    if (ctxArr.length > 0) {
      const ctxPick = this.getContextGreetingForContext(ctxArr, ctx);
      if (ctxPick) picks.push(String(ctxPick || '').trim());
      fillFromPools(0);
    } else {
      fillFromPools(0);
    }

    if (picks.length === 0) {
      picks.push('Hallo!');
    }

    return picks;
  }

  startInitialBubbleSequence() {
    this.clearBubbleSequence();
    const ctx = this.robot.getPageContext();
    const ctxArr = this.contextGreetings?.[ctx] || [];
    const pools = this.initialBubblePools || [];
    const maxSteps = this.initialBubbleSequenceConfig?.steps ?? 3;

    if (
      !Array.isArray(this.initialBubblePoolCursor) ||
      this.initialBubblePoolCursor.length !== pools.length
    ) {
      this.initialBubblePoolCursor = new Array(pools.length).fill(0);
    }

    const picks = this._computeInitialPicks(ctx, ctxArr, pools, maxSteps);
    if (picks.length === 0) return;

    const showMs = this.initialBubbleSequenceConfig?.displayDuration ?? 8000;
    const pauses = this.initialBubbleSequenceConfig?.pausesAfter || [];

    const schedule = (index) => {
      if (this.isOpen) return;
      if (index >= picks.length) {
        this.lastGreetedContext = ctx;
        return;
      }

      this.showBubble(picks[index]);
      const t1 = this.robot._setTimeout(() => {
        this.hideBubble();
        const pause = pauses[index] || 0;
        const delay = pause > 0 ? pause : 300;
        const t2 = this.robot._setTimeout(() => schedule(index + 1), delay);
        this._bubbleSequenceTimers.push(t2);
      }, showMs);
      this._bubbleSequenceTimers.push(t1);
    };
    schedule(0);
  }
}
