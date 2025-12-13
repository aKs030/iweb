/**
 * KI Roboter Begleiter - Extended Edition (Optimized)
 * Performance-Optimierungen: DOM-Caching, RequestAnimationFrame-Nutzung, Refactoring.
 */

import {GeminiService} from './gemini-service.js'
import {RobotGames} from './robot-games.js'
import {RobotCollision} from './modules/robot-collision.js'
import {RobotAnimation} from './modules/robot-animation.js'
import {RobotChat} from './modules/robot-chat.js'
import {RobotIntelligence} from './modules/robot-intelligence.js'
import {RobotSound} from './modules/robot-sound.js'

class RobotCompanion {
  constructor() {
    this.containerId = 'robot-companion-container'
    this.texts = (window && window.robotCompanionTexts) || {}

    this.gemini = new GeminiService()
    this.gameModule = new RobotGames(this)
    this.animationModule = new RobotAnimation(this)
    this.collisionModule = new RobotCollision(this)
    this.chatModule = new RobotChat(this)
    this.intelligenceModule = new RobotIntelligence(this)
    this.soundModule = new RobotSound(this)

    // State
    this.state = {}

    // Flag to prevent footer overlap check from overriding keyboard adjustment
    this.isKeyboardAdjustmentActive = false

    // Store initial layout height for detecting keyboard even when layout viewport shrinks
    this.initialLayoutHeight = window.innerHeight

    // Context greeting dedupe & observed section tracking
    this.currentObservedContext = null
    this._sectionObserver = null

    // Mood & Analytics System
    this.analytics = {
      sessions: parseInt(localStorage.getItem('robot-sessions') || '0') + 1,
      sectionsVisited: [],
      interactions: parseInt(localStorage.getItem('robot-interactions') || '0'),
      lastVisit: localStorage.getItem('robot-last-visit') || new Date().toISOString()
    }
    localStorage.setItem('robot-sessions', this.analytics.sessions)
    localStorage.setItem('robot-last-visit', new Date().toISOString())

    this.mood = this.calculateMood()
    this.easterEggFound = new Set(JSON.parse(localStorage.getItem('robot-easter-eggs') || '[]'))

    this.dom = {}

    this.applyTexts()

    this._sectionCheckInterval = null
    this._scrollListener = null

    this.loadTexts().then(() => {
      this.applyTexts()
      if (!this.dom.container) this.init()
    })

    if (window.robotCompanionTexts) {
      this.init()
    } else {
      setTimeout(() => {
        if (!this.dom.container) this.init()
      }, 500)
    }
  }

  applyTexts() {
    const src = (window && window.robotCompanionTexts) || this.texts || {}
    const chat = this.chatModule

    chat.knowledgeBase = src.knowledgeBase || chat.knowledgeBase || {start: {text: 'Hallo!', options: []}}
    chat.contextGreetings = src.contextGreetings || chat.contextGreetings || {default: []}
    chat.moodGreetings = src.moodGreetings ||
      chat.moodGreetings || {
        normal: ['Hey! Wie kann ich helfen?', 'Hi! Was brauchst du?']
      }
    chat.startMessageSuffix = src.startMessageSuffix || chat.startMessageSuffix || {}
    chat.initialBubbleGreetings = src.initialBubbleGreetings || chat.initialBubbleGreetings || ['Psst! Brauchst du Hilfe?']
    chat.initialBubblePools = src.initialBubblePools || chat.initialBubblePools || []
    chat.initialBubbleSequenceConfig = src.initialBubbleSequenceConfig ||
      chat.initialBubbleSequenceConfig || {
        steps: 4,
        displayDuration: 10000,
        pausesAfter: [0, 20000, 20000, 0]
      }
  }

  loadTexts() {
    return new Promise(resolve => {
      if (window && window.robotCompanionTexts) {
        this.texts = window.robotCompanionTexts
        resolve()
        return
      }
      if (document.querySelector('script[src*="robot-companion-texts.js"]')) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = '/content/components/robot-companion/robot-companion-texts.js'
      script.async = true
      script.onload = () => {
        this.texts = (window && window.robotCompanionTexts) || {}
        resolve()
      }
      script.onerror = () => resolve()
      document.head.appendChild(script)
    })
  }

  setupFooterOverlapCheck() {
    let ticking = false
    const checkOverlap = () => {
      // If keyboard adjustment is active, skip overlap check to prevent overriding style.bottom
      if (this.isKeyboardAdjustmentActive) {
        ticking = false
        return
      }

      if (!this.dom.container) return
      if (!this.dom.footer) {
        this.dom.footer = document.querySelector('footer') || document.querySelector('#site-footer')
      }
      const footer = this.dom.footer
      if (!footer) return

      this.dom.container.style.bottom = ''
      const rect = this.dom.container.getBoundingClientRect()
      const fRect = footer.getBoundingClientRect()
      const overlap = Math.max(0, rect.bottom - fRect.top)

      if (overlap > 0) {
        this.dom.container.style.bottom = `${30 + overlap}px`
      }

      if (!this.chatModule.isOpen) {
        this.collisionModule.scanForCollisions()
      }
      ticking = false
    }

    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(checkOverlap)
        ticking = true
      }
    }

    window.addEventListener('scroll', requestTick, {passive: true})
    window.addEventListener('resize', requestTick, {passive: true})
    requestAnimationFrame(checkOverlap)
    setInterval(requestTick, 1000)
  }

  setupMobileViewportHandler() {
    if (!window.visualViewport) return

    const handleResize = () => {
      if (!this.dom.window || !this.dom.container) return

      // If chat is closed, ensure we clean up state and do nothing else
      if (!this.chatModule.isOpen) {
        if (this.isKeyboardAdjustmentActive) {
          this.isKeyboardAdjustmentActive = false
          this.dom.container.style.bottom = ''
          this.dom.window.style.maxHeight = ''
        }
        return
      }

      // Use initialLayoutHeight if available to detect shrink-resize behaviors
      const referenceHeight = this.initialLayoutHeight || window.innerHeight
      const visualHeight = window.visualViewport.height
      const heightDiff = referenceHeight - visualHeight
      const isInputFocused = document.activeElement === this.dom.input

      // Threshold: > 150px difference usually implies keyboard.
      // Also trigger if input is focused and difference is measurable (>50px).
      const isKeyboardOverlay = heightDiff > 150 || (isInputFocused && heightDiff > 50)

      if (isKeyboardOverlay) {
        // Keyboard is open (overlay mode or partial resize)
        this.isKeyboardAdjustmentActive = true

        if (this.dom.controls) {
          this.dom.controls.classList.add('hide-controls-mobile')
        }

        // Manually lift the container to be above the keyboard
        // We use visualViewport height to determine the safe area

        // Calculate vertical centering in the available space above keyboard
        // Available space = visualHeight
        // Desired window height = min(visualHeight - 20, 500) (approx)
        // But we are setting 'bottom'.

        // Let's assume max window height is constrained.
        const safeMargin = 10
        const maxWindowHeight = visualHeight - safeMargin * 2 // Top and bottom margin
        this.dom.window.style.maxHeight = `${maxWindowHeight}px`

        // To center it:
        // The space occupied by keyboard is 'heightDiff'.
        // The space remaining is 'visualHeight'.
        // We want the window to be centered in 'visualHeight'.
        // Bottom position relative to layout viewport = heightDiff + (visualHeight - actualWindowHeight) / 2

        // However, actualWindowHeight is dynamic.
        // Simplified centering:
        // Position bottom at: heightDiff + (visualHeight / 2) - (windowHeight / 2)
        // Better: Use flexbox or CSS transform?
        // No, we are using absolute/fixed positioning.

        // Let's rely on CSS 'bottom' relative to the visual viewport being 'heightDiff'.
        // Then add padding to center.

        // Actually, easiest way to center vertically in the available space:
        // bottom = heightDiff + (visualHeight - this.dom.window.offsetHeight) / 2
        // We need to read offsetHeight.

        requestAnimationFrame(() => {
          if (!this.dom.window) return
          const currentHeight = this.dom.window.offsetHeight
          const spaceAboveKeyboard = visualHeight
          const freeSpace = Math.max(0, spaceAboveKeyboard - currentHeight)
          const verticalPadding = freeSpace / 2

          const centeredBottom = heightDiff + verticalPadding
          this.dom.container.style.bottom = `${centeredBottom}px`
        })

        // Fallback initial set to ensure it jumps up immediately
        this.dom.container.style.bottom = `${heightDiff + 10}px`
      } else {
        // Keyboard is closed
        this.isKeyboardAdjustmentActive = false

        if (this.dom.controls && !isInputFocused) {
          this.dom.controls.classList.remove('hide-controls-mobile')
        }

        // Reset styles to allow CSS / footer overlap logic to take over
        this.dom.container.style.bottom = ''
        this.dom.window.style.maxHeight = ''
      }
    }

    window.visualViewport.addEventListener('resize', handleResize)
    window.visualViewport.addEventListener('scroll', handleResize)

    if (this.dom.input) {
      this.dom.input.addEventListener('focus', handleResize)
      this.dom.input.addEventListener('blur', () => setTimeout(handleResize, 200))
    }
  }

  init() {
    if (this.dom.container) return

    this.loadCSS()
    this.createDOM()
    this.attachEvents()
    this.setupFooterOverlapCheck()
    this.setupMobileViewportHandler()

    setTimeout(() => {
      const ctx = this.getPageContext()
      if (!this.chatModule.isOpen && !this.chatModule.lastGreetedContext) {
        const showSequenceChance = 0.9
        if (this.chatModule.initialBubblePools && this.chatModule.initialBubblePools.length > 0 && Math.random() < showSequenceChance) {
          this.chatModule.startInitialBubbleSequence()
        } else {
          const greet =
            this.chatModule.initialBubbleGreetings && this.chatModule.initialBubbleGreetings.length > 0
              ? this.chatModule.initialBubbleGreetings[Math.floor(Math.random() * this.chatModule.initialBubbleGreetings.length)]
              : 'Hallo!'
          const ctxArr = this.chatModule.contextGreetings[ctx] || this.chatModule.contextGreetings.default || []
          let finalGreet = greet
          if (ctxArr.length && Math.random() < 0.7) {
            const ctxMsg = String(ctxArr[Math.floor(Math.random() * ctxArr.length)] || '').trim()
            finalGreet = ctxMsg
          }
          this.chatModule.showBubble(finalGreet)
          this.chatModule.lastGreetedContext = ctx
        }
      }
    }, 5000)

    this.setupSectionChangeDetection()

    setTimeout(() => {
      this.animationModule.startTypeWriterKnockbackAnimation()
    }, 1500)

    this._onHeroTypingEnd = _ev => {
      try {
        const typeWriter = document.querySelector('.typewriter-title')
        if (!typeWriter || !this.dom || !this.dom.container) return
        const twRect = typeWriter.getBoundingClientRect()
        const robotWidth = 80
        const initialLeft = window.innerWidth - 30 - robotWidth
        const maxLeft = initialLeft - 20
        this.collisionModule.checkForTypewriterCollision(twRect, maxLeft)
      } catch {}
    }
    document.addEventListener('hero:typingEnd', this._onHeroTypingEnd)
  }

  setupSectionChangeDetection() {
    this.setupSectionObservers()
    let lastContext = this.getPageContext()

    const checkContextChange = () => {
      if (this.chatModule.isOpen) return

      const currentContext = this.getPageContext()
      if (currentContext !== lastContext && currentContext !== this.chatModule.lastGreetedContext) {
        lastContext = currentContext
        setTimeout(() => {
          if (this.getPageContext() === currentContext && !this.chatModule.isOpen) {
            this.chatModule.startInitialBubbleSequence()
          }
        }, 2000)
      }
    }

    let scrollTimeout
    this._scrollListener = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        checkContextChange()
        try {
          const tw = document.querySelector('.typewriter-title')
          if (tw && this.dom.container) {
            const twRect = tw.getBoundingClientRect()
            const robotWidth = 80
            const initialLeft = window.innerWidth - 30 - robotWidth
            const maxLeft = initialLeft - 20
            this.collisionModule.checkForTypewriterCollision(twRect, maxLeft)
          }
        } catch {}
      }, 500)
    }
    window.addEventListener('scroll', this._scrollListener, {passive: true})
    this._sectionCheckInterval = setInterval(checkContextChange, 3000)
  }

  destroy() {
    this.chatModule.clearBubbleSequence()
    this.animationModule.stopIdleEyeMovement()
    this.animationModule.stopBlinkLoop()
    if (this._sectionObserver) {
      this._sectionObserver.disconnect()
      this._sectionObserver = null
    }
    if (this._scrollListener) {
      window.removeEventListener('scroll', this._scrollListener)
      this._scrollListener = null
    }
    if (this._onHeroTypingEnd) {
      document.removeEventListener('hero:typingEnd', this._onHeroTypingEnd)
      this._onHeroTypingEnd = null
    }
    if (this._sectionCheckInterval) {
      clearInterval(this._sectionCheckInterval)
      this._sectionCheckInterval = null
    }
    if (this.dom.container && this.dom.container.parentNode) {
      this.dom.container.parentNode.removeChild(this.dom.container)
    }
  }

  calculateMood() {
    const hour = new Date().getHours()
    const {sessions, interactions} = this.analytics
    if (hour >= 0 && hour < 6) return 'night-owl'
    if (hour >= 6 && hour < 10) return 'sleepy'
    if (hour >= 10 && hour < 17) return 'energetic'
    if (hour >= 17 && hour < 22) return 'relaxed'
    if (hour >= 22) return 'night-owl'
    if (sessions > 10 || interactions > 50) return 'enthusiastic'
    return 'normal'
  }

  getMoodGreeting() {
    const greetings = this.chatModule.moodGreetings || (window.robotCompanionTexts && window.robotCompanionTexts.moodGreetings) || {}
    const moodGreets = greetings[this.mood] || greetings['normal'] || ['Hey! Wie kann ich helfen?']
    return moodGreets[Math.floor(Math.random() * moodGreets.length)]
  }

  trackInteraction(_type = 'general') {
    this.analytics.interactions++
    localStorage.setItem('robot-interactions', this.analytics.interactions)
    if (this.analytics.interactions === 10 && !this.easterEggFound.has('first-10')) {
      this.unlockEasterEgg(
        'first-10',
        '🎉 Wow, 10 Interaktionen! Du bist hartnäckig! Hier ist ein Geschenk: Ein geheimes Mini-Game wurde freigeschaltet! 🎮'
      )
    }
    if (this.analytics.interactions === 50 && !this.easterEggFound.has('first-50')) {
      this.unlockEasterEgg('first-50', '🏆 50 Interaktionen! Du bist ein echter Power-User! Respekt! 💪')
    }
  }

  unlockEasterEgg(id, message) {
    this.easterEggFound.add(id)
    localStorage.setItem('robot-easter-eggs', JSON.stringify([...this.easterEggFound]))
    this.chatModule.showBubble(message)
    setTimeout(() => this.chatModule.hideBubble(), 10000)
  }

  trackSectionVisit(context) {
    if (!this.analytics.sectionsVisited.includes(context)) {
      this.analytics.sectionsVisited.push(context)
      const allSections = ['hero', 'features', 'about', 'projects', 'gallery', 'footer']
      const visitedAll = allSections.every(s => this.analytics.sectionsVisited.includes(s))
      if (visitedAll && !this.easterEggFound.has('explorer')) {
        this.unlockEasterEgg('explorer', '🗺️ Du hast alle Bereiche erkundet! Echter Explorer! 🧭')
      }
    }
  }

  loadCSS() {
    if (!document.querySelector('link[href*="robot-companion.css"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/content/components/robot-companion/robot-companion.css'
      document.head.appendChild(link)
    }
  }

  createDOM() {
    const container = document.createElement('div')
    container.id = this.containerId

    const robotSVG = `
        <svg viewBox="0 0 100 100" class="robot-svg">
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
              </filter>
              <filter id="lidShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.35" />
              </filter>
              <linearGradient id="lidGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#0b1220" stop-opacity="0.95" />
                <stop offset="100%" stop-color="#0f172a" stop-opacity="1" />
              </linearGradient>
            </defs>
            <line x1="50" y1="15" x2="50" y2="25" stroke="#40e0d0" stroke-width="2" />
            <circle cx="50" cy="15" r="3" class="robot-antenna-light" fill="#ff4444" />
            <path d="M30,40 a20,20 0 0,1 40,0" fill="#1e293b" stroke="#40e0d0" stroke-width="2" />
            <rect x="30" y="40" width="40" height="15" fill="#1e293b" stroke="#40e0d0" stroke-width="2" />
            <g class="robot-eyes">
              <circle class="robot-pupil" cx="40" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" />
              <path class="robot-lid" d="M34 36 C36 30 44 30 46 36 L46 44 C44 38 36 38 34 44 Z" fill="url(#lidGradient)" filter="url(#lidShadow)" />
              <circle class="robot-pupil" cx="60" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" />
              <path class="robot-lid" d="M54 36 C56 30 64 30 66 36 L66 44 C64 38 56 38 54 44 Z" fill="url(#lidGradient)" filter="url(#lidShadow)" />
            </g>
            <path class="robot-legs" d="M30,60 L70,60 L65,90 L35,90 Z" fill="#0f172a" stroke="#40e0d0" stroke-width="2" />
            <g class="robot-arms">
                <path class="robot-arm left" d="M30,62 Q20,70 25,80" fill="none" stroke="#40e0d0" stroke-width="3" stroke-linecap="round" />
                <path class="robot-arm right" d="M70,62 Q80,70 75,80" fill="none" stroke="#40e0d0" stroke-width="3" stroke-linecap="round" />
            </g>
            <g class="robot-flame" style="opacity: 0;">
                <path d="M40,90 Q50,120 60,90 Q50,110 40,90" fill="#ff9900" />
                <path d="M45,90 Q50,110 55,90" fill="#ffff00" />
            </g>
            <g class="robot-particles" style="opacity: 0;">
                <circle class="particle" cx="20" cy="50" r="2" fill="#40e0d0" opacity="0.6"><animate attributeName="cy" values="50;30;50" dur="2s" repeatCount="indefinite" /></circle>
                <circle class="particle" cx="80" cy="60" r="1.5" fill="#40e0d0" opacity="0.5"><animate attributeName="cy" values="60;40;60" dur="2.5s" repeatCount="indefinite" /></circle>
                <circle class="particle" cx="15" cy="70" r="1" fill="#40e0d0" opacity="0.7"><animate attributeName="cy" values="70;50;70" dur="1.8s" repeatCount="indefinite" /></circle>
            </g>
            <g class="robot-thinking" style="opacity: 0;">
                <circle cx="70" cy="20" r="8" fill="rgba(64, 224, 208, 0.2)" stroke="#40e0d0" stroke-width="1" />
                <text x="70" y="25" font-size="12" fill="#40e0d0" text-anchor="middle">?</text>
            </g>
            <circle cx="50" cy="70" r="5" fill="#2563eb" opacity="0.8"><animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" /></circle>
        </svg>
    `

    container.innerHTML = `
            <div class="robot-chat-window" id="robot-chat-window">
                <div class="chat-header">
                    <div class="chat-title"><span class="chat-status-dot"></span>Cyber Assistant</div>
                    <button class="chat-close-btn">&times;</button>
                </div>
                <div class="chat-messages" id="robot-messages"></div>
                <div class="chat-controls" id="robot-controls"></div>
                <div class="chat-input-area" id="robot-input-area">
                    <input type="text" id="robot-chat-input" placeholder="Frag mich etwas oder wähle eine Option..." />
                    <button id="robot-chat-send">➤</button>
                </div>
            </div>
            <div class="robot-float-wrapper">
                <div class="robot-bubble" id="robot-bubble">
                    <span id="robot-bubble-text">Hallo!</span>
                    <div class="robot-bubble-close">&times;</div>
                </div>
                <button class="robot-avatar" aria-label="Chat öffnen">${robotSVG}</button>
            </div>
        `

    container.style.opacity = '0'
    container.style.transition = 'opacity 220ms ease'
    document.body.appendChild(container)

    this.dom.container = container
    this.dom.window = document.getElementById('robot-chat-window')
    this.dom.bubble = document.getElementById('robot-bubble')
    this.dom.bubbleText = document.getElementById('robot-bubble-text')
    this.dom.bubbleClose = container.querySelector('.robot-bubble-close')
    this.dom.messages = document.getElementById('robot-messages')
    this.dom.controls = document.getElementById('robot-controls')
    this.dom.inputArea = document.getElementById('robot-input-area')
    this.dom.input = document.getElementById('robot-chat-input')
    this.dom.sendBtn = document.getElementById('robot-chat-send')
    this.dom.avatar = container.querySelector('.robot-avatar')
    this.dom.svg = container.querySelector('.robot-svg')
    this.dom.eyes = container.querySelector('.robot-eyes')
    this.dom.flame = container.querySelector('.robot-flame')
    this.dom.legs = container.querySelector('.robot-legs')
    this.dom.arms = {
      left: container.querySelector('.robot-arm.left'),
      right: container.querySelector('.robot-arm.right')
    }
    this.dom.particles = container.querySelector('.robot-particles')
    this.dom.thinking = container.querySelector('.robot-thinking')
    this.dom.closeBtn = container.querySelector('.chat-close-btn')

    requestAnimationFrame(() => this.animationModule.startIdleEyeMovement())
  }

  attachEvents() {
    this.dom.avatar.addEventListener('click', () => this.handleAvatarClick())
    this.dom.closeBtn.addEventListener('click', e => {
      e.stopPropagation()
      this.toggleChat(false)
    })
    this.dom.bubbleClose.addEventListener('click', e => {
      e.stopPropagation()
      const ctx = this.getPageContext()
      this.chatModule.lastGreetedContext = ctx
      this.chatModule.clearBubbleSequence()
      this.chatModule.hideBubble()
    })

    if (this.dom.sendBtn) {
      this.dom.sendBtn.addEventListener('click', () => this.handleUserMessage())
    }

    if (this.dom.input) {
      this.dom.input.addEventListener('keypress', e => {
        if (e.key === 'Enter') this.handleUserMessage()
      })

      this.dom.input.addEventListener('focus', () => {
        if (this.dom.controls) {
          this.dom.controls.classList.add('hide-controls-mobile')
        }
      })

      this.dom.input.addEventListener('blur', () => {
        setTimeout(() => {
          if (this.dom.controls) {
            this.dom.controls.classList.remove('hide-controls-mobile')
          }
        }, 200)
      })
    }
  }

  getPageContext() {
    try {
      if (this.currentObservedContext) return this.currentObservedContext

      const path = (window.location && window.location.pathname) || ''
      const file = path.split('/').pop() || ''
      const lower = path.toLowerCase()
      const midY = (window.innerHeight || 0) / 2

      const sectionCheck = selector => {
        try {
          const el = document.querySelector(selector)
          if (!el) return false
          const r = el.getBoundingClientRect()
          return r.top <= midY && r.bottom >= midY
        } catch {
          return false
        }
      }

      let context = 'default'

      if (sectionCheck('#hero')) context = 'hero'
      else if (sectionCheck('#features')) context = 'features'
      else if (sectionCheck('#about')) context = 'about'
      else if (sectionCheck('#footer-container') || sectionCheck('footer')) context = 'footer'
      else if (lower.includes('projekte')) context = 'projects'
      else if (lower.includes('gallery') || lower.includes('fotos')) context = 'gallery'
      else if (lower.includes('about') && file !== 'index.html') context = 'about'
      else if (lower.includes('karten') || file === 'karten.html') context = 'cards'
      else if (lower === '/' || file === 'index.html' || file === '') context = 'home'
      else {
        const h1 = document.querySelector('h1')
        if (h1) {
          const h1Text = (h1.textContent || '').toLowerCase()
          if (h1Text.includes('projekt')) context = 'projects'
          else if (h1Text.includes('foto') || h1Text.includes('galerie')) context = 'gallery'
        }
      }

      this.trackSectionVisit(context)
      return context
    } catch {
      return 'default'
    }
  }

  setupSectionObservers() {
    if (this._sectionObserver) return
    const sectionMap = [
      {selector: '#hero', ctx: 'hero'},
      {selector: '#features', ctx: 'features'},
      {selector: '#about', ctx: 'about'},
      {selector: '#footer-container', ctx: 'footer'},
      {selector: 'footer', ctx: 'footer'}
    ]

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
            const match = sectionMap.find(s => entry.target.matches(s.selector))
            if (match) this.currentObservedContext = match.ctx
          }
        })
      },
      {threshold: [0.35, 0.5, 0.75]}
    )

    sectionMap.forEach(s => {
      const el = document.querySelector(s.selector)
      if (el) observer.observe(el)
    })

    this._sectionObserver = observer
  }

  showMoodInfo() {
    const moodEmojis = {
      'night-owl': '🦉',
      'sleepy': '😴',
      'energetic': '⚡',
      'relaxed': '😊',
      'enthusiastic': '🤩',
      'normal': '🤖'
    }

    const moodDescriptions = {
      'night-owl': 'Nachteule-Modus aktiv! Ich bin hellwach! 🌙',
      'sleepy': 'Etwas verschlafen heute... ☕',
      'energetic': 'Voller Energie und bereit für Action! 💪',
      'relaxed': 'Entspannt und gelassen unterwegs! 🌅',
      'enthusiastic': 'Super enthusiastisch - du bist ja Power-User! 🎉',
      'normal': 'Ganz normaler Roboter-Modus! 🤖'
    }

    const emoji = moodEmojis[this.mood] || '🤖'
    const desc = moodDescriptions[this.mood] || 'Normaler Modus'
    const stats = `
      📊 Deine Stats:
      • Sessions: ${this.analytics.sessions}
      • Interaktionen: ${this.analytics.interactions}
      • Easter Eggs: ${this.easterEggFound.size}
      • Mood: ${emoji} ${this.mood}
    `

    this.chatModule.addMessage(desc, 'bot')
    this.chatModule.addMessage(stats, 'bot')
    setTimeout(() => this.chatModule.handleAction('start'), 2000)
  }

  // Delegated methods
  fetchAndShowSuggestion() {
    return this.chatModule.fetchAndShowSuggestion()
  }
  toggleChat(force) {
    return this.chatModule.toggleChat(force)
  }
  handleAvatarClick() {
    return this.chatModule.handleAvatarClick()
  }
  handleUserMessage() {
    return this.chatModule.handleUserMessage()
  }
  addMessage(text, type) {
    return this.chatModule.addMessage(text, type)
  }
  addOptions(options) {
    return this.chatModule.addOptions(options)
  }
  handleAction(action) {
    return this.chatModule.handleAction(action)
  }
  showBubble(text) {
    return this.chatModule.showBubble(text)
  }
  hideBubble() {
    return this.chatModule.hideBubble()
  }
  scrollToBottom() {
    return this.chatModule.scrollToBottom()
  }
  startInitialBubbleSequence() {
    return this.chatModule.startInitialBubbleSequence()
  }
  clearBubbleSequence() {
    return this.chatModule.clearBubbleSequence()
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new RobotCompanion())
} else {
  new RobotCompanion()
}
