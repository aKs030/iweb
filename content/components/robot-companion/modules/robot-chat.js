export class RobotChat {
  constructor(robot) {
    this.robot = robot
    this.isOpen = false
    this.isTyping = false
    this.lastGreetedContext = null

    this._bubbleSequenceTimers = []
    this.contextGreetingHistory = {}
    this.initialBubblePoolCursor = []
    this.history = []
  }

  toggleChat(forceState) {
    const newState = forceState !== undefined ? forceState : !this.isOpen
    if (newState) {
      this.robot.dom.window.classList.add('open')
      this.isOpen = true
      this.clearBubbleSequence()
      this.hideBubble()
      this.robot.animationModule.stopIdleEyeMovement()
      this.robot.animationModule.stopBlinkLoop()
      const ctx = this.robot.getPageContext()
      this.lastGreetedContext = ctx
      if (this.robot.dom.messages.children.length === 0) this.handleAction('start')

      // Focus Trap
      if (window.a11y) window.a11y.trapFocus(this.robot.dom.window)
    } else {
      this.robot.dom.window.classList.remove('open')
      this.isOpen = false
      this.robot.animationModule.startIdleEyeMovement()
      this.robot.animationModule.startBlinkLoop()

      // Release Focus
      if (window.a11y) window.a11y.releaseFocus()
    }
  }

  handleAvatarClick() {
    if (this.isOpen) {
      this.toggleChat(false)
      return
    }

    this.robot.animationModule.playPokeAnimation().then(() => {
      this.toggleChat(true)
    })
  }

  async handleUserMessage() {
    const text = this.robot.dom.input.value.trim()
    if (!text) return

    this.addMessage(text, 'user')
    this.robot.dom.input.value = ''

    // Check for active mini-games
    if (this.robot.gameModule.state.guessNumberActive) {
      this.robot.gameModule.handleGuessNumber(text)
      return
    }

    // Check for trivia answer
    if (text.startsWith('triviaAnswer_')) {
      const answerIdx = parseInt(text.split('_')[1])
      this.robot.gameModule.handleTriviaAnswer(answerIdx)
      return
    }

    this.showTyping()
    this.robot.animationModule.startThinking()
    this.robot.trackInteraction('message')

    try {
      const response = await this.robot.gemini.generateResponse(text, this.history)
      this.removeTyping()
      this.robot.animationModule.stopThinking()
      this.addMessage(response, 'bot')
    } catch {
      this.removeTyping()
      this.robot.animationModule.stopThinking()
      this.addMessage('Fehler bei der Verbindung.', 'bot')
    }
  }

  async handleSummarize() {
    this.toggleChat(true)
    this.showTyping()
    const content = document.body.innerText
    const summary = await this.robot.gemini.summarizePage(content)
    this.removeTyping()
    this.addMessage('Zusammenfassung dieser Seite:', 'bot')
    this.addMessage(summary, 'bot')
  }

  showBubble(text) {
    if (this.isOpen) return
    if (!this.robot.dom.bubble || !this.robot.dom.bubbleText) return
    this.robot.dom.bubbleText.textContent = String(text || '').trim()
    this.robot.dom.bubble.classList.add('visible')
  }

  hideBubble() {
    if (this.robot.dom.bubble) this.robot.dom.bubble.classList.remove('visible')
  }

  showTyping() {
    if (this.isTyping) return
    this.isTyping = true
    const typingDiv = document.createElement('div')
    typingDiv.className = 'typing-indicator'
    typingDiv.id = 'robot-typing'
    typingDiv.innerHTML = `<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>`
    this.robot.dom.messages.appendChild(typingDiv)
    this.scrollToBottom()
  }

  removeTyping() {
    const typingDiv = document.getElementById('robot-typing')
    if (typingDiv) typingDiv.remove()
    this.isTyping = false
  }

  addMessage(text, type = 'bot') {
    const msg = document.createElement('div')
    msg.className = `message ${type}`
    msg.innerHTML = String(text || '')
    this.robot.dom.messages.appendChild(msg)
    this.scrollToBottom()

    // Sound effect
    if (this.robot.soundModule) {
      if (type === 'bot') this.robot.soundModule.playMessage()
      else this.robot.soundModule.playBeep()
    }

    // Update history
    this.history.push({role: type === 'user' ? 'user' : 'model', text: String(text || '')})
    if (this.history.length > 20) {
      this.history = this.history.slice(this.history.length - 20)
    }
  }

  clearControls() {
    this.robot.dom.controls.innerHTML = ''
  }

  addOptions(options) {
    this.clearControls()
    options.forEach(opt => {
      const btn = document.createElement('button')
      btn.className = 'chat-option-btn'
      btn.textContent = opt.label
      btn.onclick = () => {
        this.addMessage(opt.label, 'user')
        setTimeout(() => {
          if (opt.url) {
            window.open(opt.url, opt.target || '_self')
            if (opt.target === '_blank') this.handleAction('start')
          } else if (opt.action) {
            if (opt.action.startsWith('triviaAnswer_')) {
              const answerIdx = parseInt(opt.action.split('_')[1])
              this.robot.gameModule.handleTriviaAnswer(answerIdx)
            } else {
              this.handleAction(opt.action)
            }
          }
        }, 300)
      }
      this.robot.dom.controls.appendChild(btn)
    })
  }

  handleAction(actionKey) {
    this.robot.trackInteraction('action')

    if (actionKey === 'summarizePage') {
      this.handleSummarize()
      return
    }
    if (actionKey === 'scrollFooter') {
      this.robot.dom.footer?.scrollIntoView({behavior: 'smooth'})
      this.showTyping()
      setTimeout(() => {
        this.removeTyping()
        this.addMessage('Ich habe dich nach unten gebracht! 👇', 'bot')
        setTimeout(() => this.handleAction('start'), 2000)
      }, 1000)
      return
    }
    if (actionKey === 'randomProject') {
      this.addMessage('Ich suche ein Projekt...', 'bot')
      return
    }

    if (actionKey === 'playTicTacToe') {
      this.robot.gameModule.startTicTacToe()
      return
    }
    if (actionKey === 'playTrivia') {
      this.robot.gameModule.startTrivia()
      return
    }
    if (actionKey === 'playGuessNumber') {
      this.robot.gameModule.startGuessNumber()
      return
    }
    if (actionKey === 'showMood') {
      this.robot.showMoodInfo()
      return
    }

    const data = this.knowledgeBase && this.knowledgeBase[actionKey]
    if (!data) return

    this.showTyping()
    this.robot.dom.avatar.classList.add('nod')
    setTimeout(() => this.robot.dom.avatar.classList.remove('nod'), 650)

    let responseText = Array.isArray(data.text) ? data.text[Math.floor(Math.random() * data.text.length)] : data.text

    if (actionKey === 'start' && Math.random() < 0.3) {
      responseText = this.robot.getMoodGreeting()
    } else if (actionKey === 'start') {
      const ctx = this.robot.getPageContext()
      const suffix = this.startMessageSuffix && this.startMessageSuffix[ctx] ? String(this.startMessageSuffix[ctx]).trim() : ''
      if (suffix) responseText = `${String(responseText || '').trim()} ${suffix}`.trim()
    }

    const typingTime = Math.min(Math.max(responseText.length * 15, 800), 2000)
    setTimeout(() => {
      this.removeTyping()
      this.addMessage(responseText, 'bot')
      if (data.options) this.addOptions(data.options)
    }, typingTime)
  }

  scrollToBottom() {
    this.robot.dom.messages.scrollTop = this.robot.dom.messages.scrollHeight
  }

  // Bubble Sequence Logic
  clearBubbleSequence() {
    if (!this._bubbleSequenceTimers) return
    this._bubbleSequenceTimers.forEach(t => clearTimeout(t))
    this._bubbleSequenceTimers = []
  }

  getContextGreetingForContext(ctxArr, ctxKey) {
    if (!ctxArr || ctxArr.length === 0) return null
    if (!this.contextGreetingHistory[ctxKey]) this.contextGreetingHistory[ctxKey] = new Set()
    const used = this.contextGreetingHistory[ctxKey]
    let candidates = ctxArr.filter(g => !used.has(g))
    if (candidates.length === 0) {
      used.clear()
      candidates = ctxArr.slice()
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    used.add(pick)
    return pick
  }

  startInitialBubbleSequence() {
    this.clearBubbleSequence()
    const ctx = this.robot.getPageContext()
    const ctxArr = (this.contextGreetings && this.contextGreetings[ctx]) || []
    const pools = this.initialBubblePools || []
    const maxSteps = (this.initialBubbleSequenceConfig && this.initialBubbleSequenceConfig.steps) || 3

    if (!Array.isArray(this.initialBubblePoolCursor) || this.initialBubblePoolCursor.length !== pools.length) {
      this.initialBubblePoolCursor = new Array(pools.length).fill(0)
    }

    const picks = []

    const nextFromPool = poolIdx => {
      if (!pools.length) return null
      const idx = poolIdx % pools.length
      const pool = pools[idx]
      if (!pool || pool.length === 0) return null
      const cursor = this.initialBubblePoolCursor[idx] || 0
      const pick = pool[cursor % pool.length]
      this.initialBubblePoolCursor[idx] = (cursor + 1) % pool.length
      return String(pick || '').trim()
    }

    const fillFromPools = (startIndex = 0) => {
      let poolIndex = startIndex
      let attempts = 0
      while (picks.length < maxSteps && attempts < maxSteps * 4) {
        const candidate = nextFromPool(poolIndex)
        poolIndex++
        attempts++
        if (candidate) picks.push(candidate)
      }
    }

    if (Math.random() < 0.4) {
      const moodGreet = this.robot.getMoodGreeting()
      if (moodGreet) picks.push(moodGreet)
    }

    if (ctxArr.length > 0) {
      const ctxPick = this.getContextGreetingForContext(ctxArr, ctx)
      if (ctxPick) picks.push(String(ctxPick || '').trim())
      fillFromPools(0)
    } else {
      fillFromPools(0)
    }

    if (picks.length === 0 && this.initialBubbleGreetings && this.initialBubbleGreetings.length > 0) {
      const fallback = this.initialBubbleGreetings[Math.floor(Math.random() * this.initialBubbleGreetings.length)]
      picks.push(String(fallback || '').trim())
    }

    if (picks.length === 0) return

    const showMs = (this.initialBubbleSequenceConfig && this.initialBubbleSequenceConfig.displayDuration) || 8000
    const pauses = (this.initialBubbleSequenceConfig && this.initialBubbleSequenceConfig.pausesAfter) || []

    const schedule = index => {
      if (this.isOpen) return
      if (index >= picks.length) {
        this.lastGreetedContext = ctx
        return
      }

      this.showBubble(picks[index])
      const t1 = setTimeout(() => {
        this.hideBubble()
        const pause = pauses[index] || 0
        const delay = pause > 0 ? pause : 300
        const t2 = setTimeout(() => schedule(index + 1), delay)
        this._bubbleSequenceTimers.push(t2)
      }, showMs)
      this._bubbleSequenceTimers.push(t1)
    }
    schedule(0)
  }

  async fetchAndShowSuggestion() {
    if (this.lastGreetedContext || this.isOpen) return

    const ctx = this.robot.getPageContext()
    const behavior = {
      page: ctx,
      interests: [ctx]
    }

    try {
      const suggestion = await this.robot.gemini.getSuggestion(behavior)
      if (suggestion && !this.isOpen) {
        this.showBubble(suggestion)
        setTimeout(() => this.hideBubble(), 8000)
      }
    } catch {
      // Silent fail
    }
  }
}
