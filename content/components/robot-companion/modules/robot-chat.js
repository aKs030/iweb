import { createLogger } from '/content/core/logger.js';
import { MarkdownRenderer } from './markdown-renderer.js';

const log = createLogger('RobotChat');

export class RobotChat {
  constructor(robot) {
    this.robot = robot;
    this.isOpen = false;
    this.isTyping = false;
    this.lastGreetedContext = null;

    this._bubbleSequenceTimers = [];
    this.contextGreetingHistory = {};
    this.initialBubblePoolCursor = [];
    this.history = [];
  }

  destroy() {
    // Cleanup aller Bubble-Sequence Timers
    this.clearBubbleSequence();

    // Clear History
    this.history = [];
    this._bubbleSequenceTimers = [];
  }

  toggleChat(forceState) {
    const newState = forceState ?? !this.isOpen;
    if (newState) {
      this.robot.dom.window.classList.add('open');
      this.isOpen = true;
      this.clearBubbleSequence();
      this.hideBubble();
      this.robot.animationModule.stopIdleEyeMovement();
      this.robot.animationModule.stopBlinkLoop();
      const ctx = this.robot.getPageContext();
      this.lastGreetedContext = ctx;
      if (this.robot.dom.messages.children.length === 0)
        this.handleAction('start');

      // Focus Trap
      globalThis?.a11y?.trapFocus(this.robot.dom.window);
    } else {
      this.robot.dom.window.classList.remove('open');
      this.isOpen = false;
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
    if (!text) return;

    this.addMessage(text, 'user');
    this.robot.dom.input.value = '';

    // Check for active mini-games
    if (this.robot.gameModule.state.guessNumberActive) {
      this.robot.gameModule.handleGuessNumber(text);
      return;
    }

    // Check for trivia answer
    if (text.startsWith('triviaAnswer_')) return;

    this.showTyping();
    this.robot.animationModule.startThinking();
    this.robot.trackInteraction();

    // Create streaming message element
    let streamingMessageEl = null;
    let typingRemoved = false;

    try {
      // Start speaking animation
      this.robot.animationModule.startSpeaking();

      // Server-side search augmentation (RAG) is handled by the worker
      const response = await this.robot.gemini.generateResponse(
        text,
        (chunk) => {
          // Streaming callback - remove typing indicator on first chunk
          if (!typingRemoved) {
            this.removeTyping();
            typingRemoved = true;
          }

          if (!streamingMessageEl) {
            streamingMessageEl = this.createStreamingMessage();
          }

          this.updateStreamingMessage(streamingMessageEl, chunk);
        },
      );

      this.robot.animationModule.stopThinking();
      // Note: stopSpeaking is handled in finalizeStreamingMessage or here if no streaming

      // If no streaming occurred, add message normally
      if (!streamingMessageEl) {
        if (!typingRemoved) {
          this.removeTyping();
        }
        this.robot.animationModule.stopSpeaking();

        // Response may be either string or { text, sources }
        if (typeof response === 'string') {
          this.addMessage(response, 'bot');
        } else if (response && response.text) {
          // Basic rendering: show answer + source list (if present)
          const safeText = String(response.text || '');
          let html = MarkdownRenderer.parse(safeText);

          if (Array.isArray(response.sources) && response.sources.length) {
            html +=
              '<div class="chat-sources"><strong>Quellen:</strong><ul>' +
              response.sources
                .map((s) => `<li><a href="${s.url}">${s.title}</a></li>`)
                .join('') +
              '</ul></div>';
          }
          this.addMessage(html, 'bot', true); // true = skip markdown parsing (already done)
        } else {
          this.addMessage('Entschuldigung, keine Antwort erhalten.', 'bot');
        }
      } else {
        // Finalize streaming message
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

      this.addMessage('Fehler bei der Verbindung.', 'bot');
    }
  }

  createStreamingMessage() {
    const msg = document.createElement('div');
    msg.className = 'message bot streaming';
    msg.innerHTML =
      '<span class="streaming-text"></span><span class="streaming-cursor"></span>';
    this.robot.dom.messages.appendChild(msg);
    this.scrollToBottom();
    return msg;
  }

  updateStreamingMessage(messageEl, text) {
    const textSpan = messageEl.querySelector('.streaming-text');
    if (textSpan) {
      // Use Markdown parser for live preview
      // Note: This might be slightly expensive for very long texts, but for chat it's fine
      textSpan.innerHTML = MarkdownRenderer.parse(text);
      this.scrollToBottom();
    }
  }

  finalizeStreamingMessage(messageEl) {
    const cursor = messageEl.querySelector('.streaming-cursor');
    if (cursor) cursor.remove();
    messageEl.classList.remove('streaming');
    this.robot.animationModule.stopSpeaking();

    // Update history
    const textSpan = messageEl.querySelector('.streaming-text');
    // We want the plain text for history, so we might need to strip HTML or use the last raw text chunk if we stored it.
    // Simpler: use textContent which approximates the raw text
    const text = textSpan?.textContent || '';

    this.history.push({
      role: 'model',
      text: text,
    });
    if (this.history.length > 20) {
      this.history = this.history.slice(-20);
    }
  }

  async handleSummarize() {
    this.toggleChat(true);
    this.showTyping();
    const content = document.body.innerText;
    const summary = await this.robot.gemini.summarizePage(content);
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
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'robot-typing';
    typingDiv.innerHTML = `<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>`;
    this.robot.dom.messages.appendChild(typingDiv);
    this.scrollToBottom();
  }

  removeTyping() {
    const typingDiv = document.getElementById('robot-typing');
    if (typingDiv) typingDiv.remove();
    this.isTyping = false;
  }

  addMessage(text, type = 'bot', skipParsing = false) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;

    if (type === 'user') {
      msg.textContent = String(text || '');
    } else {
      if (skipParsing) {
        msg.innerHTML = String(text || '');
      } else {
        // Use Markdown Renderer
        msg.innerHTML = MarkdownRenderer.parse(String(text || ''));
      }
    }

    this.robot.dom.messages.appendChild(msg);
    this.scrollToBottom();

    // Update history
    this.history.push({
      role: type === 'user' ? 'user' : 'model',
      text: String(text || ''),
    });
    if (this.history.length > 20) {
      this.history = this.history.slice(-20);
    }
  }

  clearControls() {
    this.robot.dom.controls.innerHTML = '';
  }

  addOptions(options) {
    this.clearControls();
    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'chat-option-btn';
      btn.textContent = opt.label;
      btn.onclick = () => {
        this.addMessage(opt.label, 'user');
        setTimeout(() => {
          if (opt.url) {
            globalThis?.open?.(opt.url, opt.target || '_self');
            if (opt.target === '_blank') this.handleAction('start');
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

    if (actionKey === 'summarizePage') {
      this.handleSummarize();
      return;
    }
    if (actionKey === 'scrollFooter') {
      this.robot.dom.footer?.scrollIntoView({ behavior: 'smooth' });
      this.showTyping();
      setTimeout(() => {
        this.removeTyping();
        this.addMessage('Ich habe dich nach unten gebracht! 👇', 'bot');
        setTimeout(() => this.handleAction('start'), 2000);
      }, 1000);
      return;
    }
    if (actionKey === 'randomProject') {
      this.addMessage('Ich suche ein Projekt...', 'bot');
      return;
    }

    if (actionKey === 'playTicTacToe') {
      this.robot.gameModule.startTicTacToe();
      return;
    }
    if (actionKey === 'playTrivia') {
      this.robot.gameModule.startTrivia();
      return;
    }
    if (actionKey === 'playGuessNumber') {
      this.robot.gameModule.startGuessNumber();
      return;
    }
    if (actionKey === 'showMood') {
      this.robot.showMoodInfo();
      return;
    }

    const data = this.knowledgeBase?.[actionKey];
    if (!data) return;

    this.showTyping();
    this.robot.dom.avatar.classList.add('nod');
    setTimeout(() => this.robot.dom.avatar.classList.remove('nod'), 650);

    let responseText = Array.isArray(data.text)
      ? data.text[Math.floor(Math.random() * data.text.length)]
      : data.text;

    if (actionKey === 'start' && Math.random() < 0.3) {
      responseText = this.robot.getMoodGreeting();
    } else if (actionKey === 'start') {
      const ctx = this.robot.getPageContext();
      const suffix = String(this.startMessageSuffix?.[ctx] ?? '').trim();
      if (suffix)
        responseText = `${String(responseText || '').trim()} ${suffix}`.trim();
    }

    const typingTime = Math.min(Math.max(responseText.length * 15, 800), 2000);
    setTimeout(() => {
      this.removeTyping();
      this.addMessage(responseText, 'bot');
      if (data.options) this.addOptions(data.options);
    }, typingTime);
  }

  scrollToBottom() {
    this.robot.dom.messages.scrollTop = this.robot.dom.messages.scrollHeight;
  }

  // Bubble Sequence Logic
  clearBubbleSequence() {
    if (!this._bubbleSequenceTimers) return;
    this._bubbleSequenceTimers.forEach((t) => clearTimeout(t));
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

    if (
      picks.length === 0 &&
      this.initialBubbleGreetings &&
      this.initialBubbleGreetings.length > 0
    ) {
      const fallback =
        this.initialBubbleGreetings[
          Math.floor(Math.random() * this.initialBubbleGreetings.length)
        ];
      picks.push(String(fallback || '').trim());
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
      const t1 = setTimeout(() => {
        this.hideBubble();
        const pause = pauses[index] || 0;
        const delay = pause > 0 ? pause : 300;
        const t2 = setTimeout(() => schedule(index + 1), delay);
        this._bubbleSequenceTimers.push(t2);
      }, showMs);
      this._bubbleSequenceTimers.push(t1);
    };
    schedule(0);
  }

  async fetchAndShowSuggestion() {
    if (this.lastGreetedContext || this.isOpen) return;

    const ctx = this.robot.getPageContext();
    const behavior = {
      page: ctx,
      interests: [ctx],
    };

    try {
      const suggestion = await this.robot.gemini.getSuggestion(behavior);
      if (suggestion && !this.isOpen) {
        this.showBubble(suggestion);
        setTimeout(() => this.hideBubble(), 8000);
      }
    } catch (e) {
      log.warn('fetchAndShowSuggestion failed', e);
      // Silent fail for UX reasons
    }
  }
}
