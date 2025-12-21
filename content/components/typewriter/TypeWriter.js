// ===== TypeWriter (Final Optimiert) =====
import {createLogger, getElementById, shuffle, TimerManager} from '../../utils/shared-utilities.js'

const log = createLogger('TypeWriter')

// Helper: CSS Variables setzen
const setCSSVars = (el, vars) => Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v))

// Helper: Line Measurer
function makeLineMeasurer(subtitleEl) {
  const measurer = document.createElement('div')
  measurer.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:normal;pointer-events:none'
  document.body.appendChild(measurer)

  const cs = getComputedStyle(subtitleEl)
  ;[
    'font-size',
    'line-height',
    'font-family',
    'font-weight',
    'letter-spacing',
    'word-spacing',
    'font-kerning',
    'font-variant-ligatures',
    'text-transform',
    'text-rendering',
    'word-break',
    'overflow-wrap',
    'hyphens'
  ].forEach(p => measurer.style.setProperty(p, cs.getPropertyValue(p)))

  const getLineHeight = () => {
    const lh = cs.lineHeight.trim()
    if (lh.endsWith('px')) {
      const v = parseFloat(lh)
      if (!isNaN(v)) return v
    }
    const num = parseFloat(lh)
    if (!isNaN(num)) {
      const fs = parseFloat(cs.fontSize)
      if (!isNaN(fs)) return num * fs
    }
    measurer.innerHTML = '<span style="display:inline-block">A</span>'
    return measurer.firstChild.getBoundingClientRect().height || 0
  }

  const _measure = text => {
    measurer.innerHTML = ''
    const span = document.createElement('span')
    span.textContent = text

    measurer.appendChild(span)

    const rect = subtitleEl.getBoundingClientRect()
    const available = Math.max(0, window.innerWidth - (rect.left || 0) - 12)
    const cap = Math.min(window.innerWidth * 0.92, 820)
    measurer.style.width = Math.max(1, Math.min(available || cap, cap)) + 'px'

    const lh = getLineHeight()
    const h = span.getBoundingClientRect().height
    if (!lh || !h) return 1

    const max = parseInt(cs.getPropertyValue('--reserve-lines')) || 6
    return Math.max(1, Math.min(max, Math.round(h / lh)))
  }

  const getLines = text => {
    measurer.innerHTML = ''
    const words = text.split(' ')
    const lines = []
    let currentLine = []

    const rect = subtitleEl.getBoundingClientRect()
    const available = Math.max(0, window.innerWidth - (rect.left || 0) - 12)
    const cap = Math.min(window.innerWidth * 0.92, 820)
    measurer.style.width = Math.max(1, Math.min(available || cap, cap)) + 'px'

    const lh = getLineHeight()
    if (!lh) return [text]

    words.forEach(word => {
      const testLine = currentLine.length ? currentLine.join(' ') + ' ' + word : word
      measurer.textContent = testLine

      if (measurer.getBoundingClientRect().height > lh * 1.1) {
        if (currentLine.length) {
          lines.push(currentLine.join(' '))
          currentLine = [word]
        } else {
          lines.push(word)
          currentLine = []
        }
      } else {
        currentLine.push(word)
      }
    })

    if (currentLine.length) {
      lines.push(currentLine.join(' '))
    }

    return lines.length ? lines : [text]
  }

  return {
    getLines,
    reserveFor(text) {
      const lh = getLineHeight()
      const linesArr = getLines(text)
      const lines = linesArr.length

      setCSSVars(subtitleEl, {
        '--lh-px': lh ? `${lh}px` : '0px',
        '--gap-px': lh ? `${lh * 0.25}px` : '0px',
        '--lines': String(lines)
      })

      subtitleEl.setAttribute('data-lines', String(lines))
      return lines
    }
  }
}

export class TypeWriter {
  constructor({
    textEl,
    authorEl,
    quotes,
    wait = 2400,
    typeSpeed = 85,
    deleteSpeed = 40,
    shuffle: doShuffle = true,
    loop = true,
    onBeforeType = null
  }) {
    if (!textEl || !authorEl || !quotes?.length) {
      log.error('TypeWriter: Missing required parameters')
      return
    }

    this.quotes = quotes.filter(q => q?.text)
    if (!this.quotes.length) return log.error('No valid quotes')

    Object.assign(this, {
      textEl,
      authorEl,
      wait,
      typeSpeed,
      deleteSpeed,
      shuffle: doShuffle,
      loop,
      onBeforeType,
      timerManager: new TimerManager(),
      _isDeleting: false,
      _txt: ''
    })

    this._queue = this._createQueue()
    this._index = this._queue.shift()
    this._current = this.quotes[this._index]

    document.body.classList.add('has-typingjs')
    if (this.onBeforeType) {
      const res = this.onBeforeType(this._current.text)
      if (typeof res === 'string') this._current.text = res
    }
    this._tick()
  }

  destroy() {
    this.timerManager.clearAll()
    document.body.classList.remove('has-typingjs')
  }

  _createQueue() {
    return this.shuffle ? shuffle([...Array(this.quotes.length).keys()]) : [...Array(this.quotes.length).keys()]
  }

  _nextQuote() {
    if (!this._queue.length) {
      if (!this.loop) return null
      this._queue = this._generateQueue(this._index)
    }
    this._index = this._queue.shift()
    return (this._current = this.quotes[this._index])
  }

  _generateQueue(_lastIndex) {
    if (this.quotes.length <= 1) return [0]
    return this._createQueue()
  }

  _renderText(text) {
    if (!this.textEl) return

    const lines = text.includes('\n') ? text.split('\n') : [text]
    this.textEl.innerHTML = ''
    lines.forEach(line => {
      const span = document.createElement('span')
      span.textContent = line
      span.className = 'typed-line'
      this.textEl.appendChild(span)
    })
  }

  _tick() {
    if (!this._current?.text) return this._handleQuoteTransition()

    const full = String(this._current.text)
    const author = String(this._current.author || '')

    this._txt = this._isDeleting ? full.substring(0, Math.max(0, this._txt.length - 1)) : full.substring(0, this._txt.length + 1)

    this._renderText(this._txt)
    if (this.authorEl) this.authorEl.textContent = author

    let delay = this._isDeleting ? this.deleteSpeed : this.typeSpeed

    // Satzzeichen-Pausen
    if (!this._isDeleting && this._txt.length) {
      const pauseMap = {
        ',': 120,
        '.': 300,
        '…': 400,
        '!': 250,
        '?': 250,
        ';': 180,
        ':': 180,
        '—': 220,
        '–': 180
      }
      delay += pauseMap[this._txt.slice(-1)] || 0
    }

    if (!this._isDeleting && this._txt === full) {
      try {
        document.dispatchEvent(new CustomEvent('hero:typingEnd', {detail: {text: full, author}}))
      } catch {}
      delay = this.wait
      this._isDeleting = true
    } else if (this._isDeleting && !this._txt) {
      delay = this._handleQuoteTransition()
      if (delay === null) return
    }

    this.timerManager.setTimeout(() => this._tick(), delay)
  }

  _handleQuoteTransition() {
    this._isDeleting = false
    // minimal: no container locking

    const next = this._nextQuote()
    if (!next) {
      this.destroy()
      return null
    }

    if (this.onBeforeType) {
      const res = this.onBeforeType(next.text)
      if (typeof res === 'string') next.text = res
    }
    return 600
  }
}

// ===== Hero Init Helper =====
export async function initHeroSubtitle(options = {}) {
  try {
    // Idempotency check
    if (window.__typeWriterInitialized) return true

    const subtitleEl = document.querySelector('.typewriter-title')
    const typedText = getElementById('typedText')
    const typedAuthor = getElementById('typedAuthor')

    if (!subtitleEl || !typedText || !typedAuthor) return false

    window.__typeWriterInitialized = true

    const {default: quotes} = await import('./TypeWriterText.js')

    if (!quotes?.length) return false

    let cfg = {}
    if (options.heroDataModule?.typewriterConfig) {
      cfg = options.heroDataModule.typewriterConfig
    } else if (options.ensureHeroDataModule) {
      try {
        cfg = (await options.ensureHeroDataModule())?.typewriterConfig || {}
      } catch {}
    }

    const measurer = makeLineMeasurer(subtitleEl)

    // Local helper to check and adjust bottom spacing to prevent footer overlap
    const checkFooterOverlap = el => {
      try {
        el.style.removeProperty('bottom')
        const rect = el.getBoundingClientRect()
        const footer = document.querySelector('#site-footer')
        if (!footer) return
        const fRect = footer.getBoundingClientRect()
        const overlap = Math.max(0, rect.bottom - (fRect.top - 24))
        if (overlap > 0) {
          const base = document.body.classList.contains('footer-expanded')
            ? 'clamp(8px,1.5vw,16px)'
            : el.classList.contains('typewriter-title--fixed')
              ? 'clamp(16px,2.5vw,32px)'
              : 'clamp(12px,2vw,24px)'
          setCSSVars(el, {bottom: `calc(${base} + ${overlap}px)`})
        }
      } catch {}
    }

    const start = () => {
      const tw = new TypeWriter({
        textEl: typedText,
        authorEl: typedAuthor,
        quotes,
        wait: 2400,
        typeSpeed: 85,
        deleteSpeed: 40,
        shuffle: true,
        loop: true,
        // minimal: don't use smart breaks here
        ...cfg,
        onBeforeType: text => {
          subtitleEl.classList.add('is-locked')

          // Calculate lines and format text with newlines
          const linesArr = measurer.getLines(text)
          const formattedText = linesArr.join('\n')

          const lines = measurer.reserveFor(text)
          const cs = getComputedStyle(subtitleEl)
          const lh = parseFloat(cs.getPropertyValue('--lh-px')) || 0
          const gap = parseFloat(cs.getPropertyValue('--gap-px')) || 0

          setCSSVars(subtitleEl, {
            '--box-h': `${Math.max(0, lines * lh + (lines - 1) * gap)}px`
          })
          // Use rAF to ensure layout is updated before measuring
          requestAnimationFrame(() => checkFooterOverlap(subtitleEl))

          return formattedText
        }
      })

      // Remove lock after typing ends (released for next measure)
      document.addEventListener('hero:typingEnd', () => {
        try {
          subtitleEl.classList.remove('is-locked')
        } catch {}
      })

      // Robust polling to fix race conditions on initial load
      const pollOverlap = () => {
        checkFooterOverlap(subtitleEl)
      }

      // Check immediately, then poll for a short duration
      pollOverlap()
      const pollInterval = setInterval(pollOverlap, 100)
      setTimeout(() => clearInterval(pollInterval), 2000)

      // Also check when footer explicitly reports loaded
      document.addEventListener('footer:loaded', pollOverlap, {once: true})
      // And on resize
      window.addEventListener('resize', () => requestAnimationFrame(pollOverlap), {
        passive: true
      })

      if (window.location.search.includes('debug')) window.__typeWriter = tw
    }

    ;(document.fonts?.ready ?? Promise.resolve()).then(start)
    return true
  } catch (e) {
    log.error('Init failed', e)
    return false
  }
}
