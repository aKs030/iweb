import { createLogger } from '../../../core/logger.js';
import { MarkdownRenderer } from './markdown-renderer.js';
import { ROBOT_ACTIONS } from '../constants/events.js';
import { uiStore } from '../../../core/ui-store.js';

const log = createLogger('RobotChat');

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

    // Load history from local storage
    try {
      this.history = JSON.parse(
        localStorage.getItem('robot-chat-history') || '[]',
      );
    } catch {
      this.history = [];
    }
  }

  destroy() {
    this.clearBubbleSequence();
    this._bubbleSequenceTimers = [];
  }

  toggleChat(forceState) {
    const newState =
      forceState ?? !this.robot.stateManager.getState().isChatOpen;
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

    // Check for trivia answer
    if (text.startsWith('triviaAnswer_')) {
      this.clearImagePreview();
      return;
    }

    this.showTyping();
    this.robot.animationModule.startThinking();
    this.robot.trackInteraction();

    // Create streaming message element
    let streamingMessageEl = null;
    let typingRemoved = false;

    try {
      this.robot.animationModule.startSpeaking();
      const agentService = await this.robot.getAgentService();

      let response;

      if (hasPendingImage) {
        // Use image analysis
        const imageFile = this.pendingImage;
        this.clearImagePreview();

        response = await agentService.analyzeImage(imageFile, text, (chunk) => {
          if (!typingRemoved) {
            this.removeTyping();
            typingRemoved = true;
          }
          if (!streamingMessageEl) {
            streamingMessageEl = this.createStreamingMessage();
          }
          this.updateStreamingMessage(streamingMessageEl, chunk);
        });
      } else {
        // Regular agent response with tool-calling
        response = await agentService.generateResponse(text, (chunk) => {
          if (!typingRemoved) {
            this.removeTyping();
            typingRemoved = true;
          }
          if (!streamingMessageEl) {
            streamingMessageEl = this.createStreamingMessage();
          }
          this.updateStreamingMessage(streamingMessageEl, chunk);
        });
      }

      this.robot.animationModule.stopThinking();

      // Show tool call indicators
      if (response.toolResults && response.toolResults.length > 0) {
        this.showToolCallResults(response.toolResults);
      }

      // Show memory badge if memory was used
      if (response.hasMemory && streamingMessageEl) {
        const badge = this.robot.domBuilder.createMemoryIndicator();
        streamingMessageEl.appendChild(badge);
      }

      // If no streaming occurred, add message normally
      if (!streamingMessageEl) {
        if (!typingRemoved) {
          this.removeTyping();
        }
        this.robot.animationModule.stopSpeaking();

        if (typeof response === 'string') {
          this.addMessage(response, 'bot');
        } else if (response && response.text) {
          this.addMessage(response.text, 'bot');
        } else {
          this.addMessage('Entschuldigung, keine Antwort erhalten.', 'bot');
        }
      } else {
        this.finalizeStreamingMessage(streamingMessageEl);
      }
    } catch (e) {
      log.error('generateResponse failed', e);
      if (!typingRemoved) {
        this.removeTyping();
      }
      this.robot.animationModule.stopThinking();
      this.robot.animationModule.stopSpeaking();

      if (streamingMessageEl) {
        streamingMessageEl.remove();
      }

      // Fallback to legacy AI service
      try {
        const aiService = await this.robot.getAIService();
        const fallbackResponse = await aiService.generateResponse(text);
        this.addMessage(
          typeof fallbackResponse === 'string'
            ? fallbackResponse
            : 'Fehler bei der Verbindung.',
          'bot',
        );
      } catch {
        this.addMessage('Fehler bei der Verbindung.', 'bot');
      }
    }
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
    this.robot.dom.messages.appendChild(msg);
    this.scrollToBottom();

    this.history.push({
      role: 'user',
      text: text
        ? `[Bild: ${imageFile.name}] ${text}`
        : `[Bild: ${imageFile.name}]`,
    });
    if (this.history.length > 30) {
      this.history = this.history.slice(-30);
    }
    this.saveHistory();
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
      this.robot.dom.input.placeholder =
        'Frag mich etwas oder wähle eine Option...';
    }
  }

  createStreamingMessage() {
    const msg = document.createElement('div');
    msg.className = 'message bot streaming';

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

    this.history.push({
      role: 'model',
      text: text,
    });
    if (this.history.length > 30) {
      this.history = this.history.slice(-30);
    }
    this.saveHistory();
  }

  async handleSummarize() {
    this.toggleChat(true);
    this.showTyping();
    const content = document.body.innerText;
    const aiService = await this.robot.getAIService();
    const summary = await aiService.summarizePage(content);
    this.removeTyping();
    this.addMessage('Zusammenfassung dieser Seite:', 'bot');
    this.addMessage(summary, 'bot');
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

  renderMessage(text, type = 'bot', skipParsing = false) {
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

    this.robot.dom.messages.appendChild(msg);
    this.scrollToBottom();
  }

  addMessage(text, type = 'bot', skipParsing = false) {
    this.renderMessage(text, type, skipParsing);

    this.history.push({
      role: type === 'user' ? 'user' : 'model',
      text: String(text || ''),
    });
    if (this.history.length > 30) {
      this.history = this.history.slice(-30);
    }
    this.saveHistory();
  }

  saveHistory() {
    try {
      localStorage.setItem('robot-chat-history', JSON.stringify(this.history));
    } catch {
      // ignore
    }
  }

  restoreMessages() {
    this.history.forEach((item) => {
      const type = item.role === 'user' ? 'user' : 'bot';
      this.renderMessage(item.text, type, false);
    });
  }

  clearHistory() {
    this.history = [];
    localStorage.removeItem('robot-chat-history');
    if (this.robot.dom.messages) {
      // Clear messages safely
      while (this.robot.dom.messages.firstChild) {
        this.robot.dom.messages.removeChild(this.robot.dom.messages.firstChild);
      }
    }
    this.handleAction(ROBOT_ACTIONS.START);
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
      const btn = document.createElement('button');
      btn.className = 'chat-option-btn';
      btn.textContent = opt.label;
      btn.onclick = () => {
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
      };
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
      [ROBOT_ACTIONS.RANDOM_PROJECT]: () =>
        this.addMessage('Ich suche ein Projekt...', 'bot'),
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
        (async () => {
          try {
            const { executeTool } = await import('./tool-executor.js');
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
        })();
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

    const data = this.knowledgeBase?.[actionKey];
    if (!data) return;

    this.showTyping();
    this.robot.dom.avatar.classList.add('nod');
    this.robot._setTimeout(
      () => this.robot.dom.avatar.classList.remove('nod'),
      650,
    );

    let responseText = Array.isArray(data.text)
      ? data.text[Math.floor(Math.random() * data.text.length)]
      : data.text;

    if (actionKey === ROBOT_ACTIONS.START) {
      if (Math.random() < 0.3) {
        responseText = this.robot.getMoodGreeting();
      } else {
        const ctx = this.robot.getPageContext();
        const suffix = String(this.startMessageSuffix?.[ctx] ?? '').trim();
        if (suffix) {
          responseText =
            `${String(responseText || '').trim()} ${suffix}`.trim();
        }
      }
    }

    const typingTime = Math.min(Math.max(responseText.length * 15, 800), 2000);
    this.robot._setTimeout(() => {
      this.removeTyping();
      this.addMessage(responseText, 'bot');
      if (data.options) this.addOptions(data.options);
    }, typingTime);
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

  async fetchAndShowSuggestion(tipKey = null) {
    if (this.isOpen) return;

    const ctx = this.robot.getPageContext();

    const pageTitle = document.title;
    const metaDesc =
      document.querySelector('meta[name="description"]')?.content || '';
    const h1 = document.querySelector('h1')?.textContent || '';

    const contentSnippet = (document.body.textContent || '')
      .substring(0, 3000)
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const contextData = {
      pageId: ctx,
      title: pageTitle,
      description: metaDesc.substring(0, 150),
      headline: h1,
      url: window.location.pathname,
      contentSnippet: contentSnippet,
    };

    try {
      const agentService = await this.robot.getAgentService();
      const suggestion = await agentService.getProactiveSuggestion(contextData);
      if (suggestion && !this.isOpen) {
        this.showBubble(suggestion);
        if (tipKey) {
          this.robot.intelligenceModule.contextTipsShown.add(tipKey);
        }
        this.robot._setTimeout(() => this.hideBubble(), 12000);
        return true;
      }
    } catch (e) {
      log.warn('fetchAndShowSuggestion failed', e);
    }
  }
}
