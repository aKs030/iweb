/**
 * Dynamic Head Loader - Optimierte Version
 * Lädt globale Meta-Tags, Styles und Skripte zentral nach.
 * Verwaltet Titel-Ersetzung und verhindert Redundanz.
 */

;(async function loadSharedHead() {
  // Verhindere mehrfache Ausführung
  if (window.SHARED_HEAD_LOADED) return

  try {
    // 1. Titel der aktuellen Seite sichern
    const existingTitleEl = document.querySelector('title')
    const pageTitle = existingTitleEl ? existingTitleEl.textContent : document.title || 'Abdulkerim — Digital Creator Portfolio'

    const escapeHTML = value =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    const safePageTitle = escapeHTML(pageTitle)

    // 2. Shared Head laden (mit Caching für Performance)
    const resp = await fetch('/content/components/head/head.html', {cache: 'force-cache'})
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    let html = await resp.text()

    // 3. Platzhalter {{PAGE_TITLE}} ersetzen
    html = html.replace(/\{\{PAGE_TITLE}}/g, safePageTitle)

    // 4. HTML in DOM-Knoten umwandeln
    const range = document.createRange()
    range.selectNode(document.head)
    const fragment = range.createContextualFragment(html)

    const escAttr = value => {
      try {
        if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value)
      } catch {
        /* ignore */
      }
      return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }

    // 4a. Dedupe Links & Scripts to avoid double-loading (performance + SEO)
    try {
      const existingStyles = new Set(
        Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
          .map(l => {
            try {
              return new URL(l.getAttribute('href'), window.location.origin).href
            } catch {
              return l.getAttribute('href')
            }
          })
          .filter(Boolean)
      )

      const existingScripts = new Set(
        Array.from(document.querySelectorAll('script[src]'))
          .map(s => {
            try {
              return new URL(s.getAttribute('src'), window.location.origin).href
            } catch {
              return s.getAttribute('src')
            }
          })
          .filter(Boolean)
      )

      const hasCanonical = !!document.querySelector('link[rel="canonical"]')

      Array.from(fragment.querySelectorAll('link[rel][href]')).forEach(link => {
        const rel = (link.getAttribute('rel') || '').toLowerCase()
        const href = link.getAttribute('href')
        if (!rel || !href) return

        if (rel === 'canonical') {
          if (hasCanonical) link.remove()
          return
        }

        if (rel === 'stylesheet') {
          let abs
          try {
            abs = new URL(href, window.location.origin).href
          } catch {
            abs = href
          }
          if (existingStyles.has(abs)) link.remove()
          return
        }

        const relEsc = escAttr(rel)
        const hrefEsc = escAttr(href)
        if (document.querySelector(`link[rel="${relEsc}"][href="${hrefEsc}"]`)) {
          link.remove()
        }
      })

      Array.from(fragment.querySelectorAll('script[src]')).forEach(script => {
        const src = script.getAttribute('src')
        if (!src) return
        let abs
        try {
          abs = new URL(src, window.location.origin).href
        } catch {
          abs = src
        }
        if (existingScripts.has(abs)) script.remove()
      })
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Head-Loader] Dedupe failed:', e)
      }
    }

    // 4b. Markiere Skripte im Fragment zur späteren erneuten Ausführung
    const fragmentScripts = Array.from(fragment.querySelectorAll('script'))
    fragmentScripts.forEach((s, idx) => {
      // Nicht ausführen, wenn bereits speziell blockiert (z.B. consent-blocked via type="text/plain")
      // Kennzeichne ansonsten zur gezielten Re-Initialisierung nach dem Einfügen
      if (s.type && s.type.toLowerCase() === 'text/plain') return
      s.setAttribute('data-exec-on-insert', '1')
      s.setAttribute('data-exec-id', String(idx))
    })

    // 5. Duplikate bereinigen:
    // Wenn das Fragment einen <title> enthält und die Seite auch,
    // entfernen wir den alten Titel der Seite, damit der neue (im Shared Head) gewinnt.
    if (fragment.querySelector('title') && existingTitleEl) {
      existingTitleEl.remove()
    }

    // 5b. Meta-Tags Deduplizierung:
    // Wenn die Seite bereits spezifische Meta-Tags hat (z.B. description, keywords),
    // sollen diese NICHT durch die generischen aus head.html überschrieben/gedoppelt werden.
    const fragmentMetas = Array.from(fragment.querySelectorAll('meta'))
    fragmentMetas.forEach(meta => {
      const name = meta.getAttribute('name')
      const property = meta.getAttribute('property')

      // Check name (description, keywords, author, etc.)
      if (name) {
        // Exclude viewport/charset as they are standard
        if (['viewport', 'charset'].includes(name)) return

        if (document.querySelector(`meta[name="${name}"]`)) {
          meta.remove() // Behalte das existierende Tag der Seite
        }
      }
      // Check property (OG tags)
      else if (property) {
        if (document.querySelector(`meta[property="${property}"]`)) {
          meta.remove()
        }
      }
    })

    // 6. Einfügepunkt finden (<!-- SHARED_HEAD -->)
    let inserted = false
    const childNodes = Array.from(document.head.childNodes)

    for (const node of childNodes) {
      if (node.nodeType === Node.COMMENT_NODE && node.nodeValue.includes('SHARED_HEAD')) {
        node.parentNode.replaceChild(fragment, node)
        inserted = true
        break
      }
    }

    // Fallback: Wenn kein Kommentar gefunden wurde, intelligent einfügen
    if (!inserted) {
      // Das Loader-Skript selbst finden, um davor einzufügen (verhindert FOUC besser)
      const loaderScript = document.currentScript || document.querySelector('script[src*="head-complete.js"]')

      if (loaderScript && loaderScript.parentNode === document.head) {
        loaderScript.parentNode.insertBefore(fragment, loaderScript)
      } else {
        // Fallback 2: Vor dem ersten Style oder Script
        const firstAsset = document.head.querySelector('link[rel="stylesheet"], style, script')
        if (firstAsset) {
          document.head.insertBefore(fragment, firstAsset)
        } else {
          document.head.appendChild(fragment)
        }
      }
    }

    // 7. Status setzen und Event feuern
    window.SHARED_HEAD_LOADED = true
    document.dispatchEvent(new CustomEvent('shared-head:loaded'))

    // 7b. Canonical / OG URL (only for shared-generated tags)
    try {
      const url = new URL(window.location.href)
      url.hash = ''
      url.search = ''
      if (url.pathname.endsWith('/index.html')) {
        url.pathname = url.pathname.slice(0, -'/index.html'.length) + '/'
      }
      const canonicalUrl = url.href

      const canonicalEl = document.querySelector('link[rel="canonical"][data-shared-head="1"]')
      if (canonicalEl) canonicalEl.setAttribute('href', canonicalUrl)

      const ogUrlEl = document.querySelector('meta[property="og:url"][data-shared-head="1"]')
      if (ogUrlEl) ogUrlEl.setAttribute('content', canonicalUrl)

      const twitterUrlEl = document.querySelector('meta[name="twitter:url"][data-shared-head="1"]')
      if (twitterUrlEl) twitterUrlEl.setAttribute('content', canonicalUrl)
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Head-Loader] Could not set canonical/og:url:', e)
      }
    }

    // 7a. Skripte aus dem Shared Head sicher ausführen (insb. Module wie /content/main.js)
    try {
      const toExec = document.head.querySelectorAll('script[data-exec-on-insert="1"]')
      toExec.forEach(oldScript => {
        const newScript = document.createElement('script')
        // Attribute kopieren
        for (const {name, value} of Array.from(oldScript.attributes)) {
          if (name === 'data-exec-on-insert') continue
          newScript.setAttribute(name, value)
        }
        if (oldScript.src) {
          newScript.src = oldScript.src
        } else if (oldScript.textContent && oldScript.textContent.trim()) {
          newScript.textContent = oldScript.textContent
        }
        // Ersetzen, damit der Browser das Skript tatsächlich lädt/ausführt
        oldScript.parentNode.replaceChild(newScript, oldScript)
      })
    } catch (e) {
      // Script execution reinforcement failed - non-critical
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Head-Loader] Script execution reinforcement failed:', e)
      }
    }
    // 8. Ensure a single global loader exists across pages (for consistent UX)
    try {
      // Only inject if not already present in the DOM
      if (!document.getElementById('loadingScreen')) {
        const loaderWrapper = document.createElement('div')
        loaderWrapper.id = 'loadingScreen'
        loaderWrapper.className = 'loading-screen'
        loaderWrapper.setAttribute('aria-hidden', 'true')
        loaderWrapper.setAttribute('aria-label', 'Seite wird geladen')
        loaderWrapper.setAttribute('role', 'status')
        loaderWrapper.setAttribute('aria-live', 'polite')

        const robotWrapper = document.createElement('div')
        robotWrapper.className = 'loading-robot'
        robotWrapper.setAttribute('aria-hidden', 'true')
        robotWrapper.innerHTML = `
        <svg viewBox="0 0 100 100">
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
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
        </svg>`

        loaderWrapper.appendChild(robotWrapper)
        // Prepend so loader sits above page content
        if (document.body) {
          document.body.prepend(loaderWrapper)
          try {
            document.body.classList.add('global-loading-visible')
          } catch {
            /* ignore */
          }
        } else {
          document.addEventListener(
            'DOMContentLoaded',
            () => {
              document.body.prepend(loaderWrapper)
              try {
                document.body.classList.add('global-loading-visible')
              } catch {
                /* ignore */
              }
            },
            {once: true}
          )
        }
      }
    } catch (e) {
      // Non-critical: injection failure shouldn't break the page
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Head-Loader] Could not ensure global loader element:', e)
      }
    }

    // 9. Fallback: Loader automatisch ausblenden, falls keine App-Logik (main.js) übernimmt
    //    Verhindert Hängenbleiben auf simplen statischen Seiten (Legal/Privacy).
    try {
      const MIN_DISPLAY_TIME = 400
      let start = performance.now()

      const hideLoader = () => {
        // Stop if main application (LoadingScreenManager) is present and taking over
        if (window.LoadingScreen && typeof window.LoadingScreen.requestShow === 'function') {
          return
        }
        // Also check for global AppLoadManager if exposed
        if (window.AppLoadManager && typeof window.AppLoadManager.isBlocked === 'function' && window.AppLoadManager.isBlocked()) {
          return
        }

        const el = document.getElementById('loadingScreen')
        if (!el) return
        const elapsed = performance.now() - start
        const wait = Math.max(0, MIN_DISPLAY_TIME - elapsed)
        setTimeout(() => {
          // Double check before acting
          if (window.LoadingScreen && typeof window.LoadingScreen.requestShow === 'function') return

          el.classList.add('hide')
          el.setAttribute('aria-hidden', 'true')
          Object.assign(el.style, {
            opacity: '0',
            pointerEvents: 'none',
            visibility: 'hidden'
          })
          const cleanup = () => {
            el.style.display = 'none'
            el.removeEventListener('transitionend', cleanup)
          }
          el.addEventListener('transitionend', cleanup)
          setTimeout(cleanup, 700)
        }, wait)
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => (start = performance.now()), {
          once: true
        })
      } else {
        start = performance.now()
      }

      // Normalfall: sobald alles geladen ist, ausblenden
      window.addEventListener('load', hideLoader, {once: true})
      // Früheres Sicherheitsnetz: kurz nach DOMContentLoaded ausblenden (falls main.js nicht greift)
      const scheduleEarlyHide = () => setTimeout(hideLoader, 1200)
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleEarlyHide, {once: true})
      } else {
        scheduleEarlyHide()
      }
      // Spätestes Sicherheitsnetz: nach 5s ausblenden
      setTimeout(hideLoader, 5000)
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Head-Loader] Fallback loader hide failed:', e)
      }
    }
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[Head-Loader] Fehler beim Laden des Shared Heads:', err)
    }
  }
})()
