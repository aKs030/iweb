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
      String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

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
    // Global page loader removed — no DOM-injection or fallback hide logic
    // The application now relies on component-local loading indicators and SectionLoader events.
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[Head-Loader] Fehler beim Laden des Shared Heads:', err)
    }
  }
})()
