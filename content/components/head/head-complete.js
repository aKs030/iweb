/**
 * Dynamic Head Loader - Optimierte Version
 * Lädt globale Meta-Tags, Styles und Skripte zentral nach.
 * Verwaltet Titel-Ersetzung und verhindert Redundanz.
 */

;(async function loadSharedHead() {
  // Verhindere mehrfache Ausführung
  if (window.SHARED_HEAD_LOADED) return

  try {
    // 1. Titel und Beschreibung der aktuellen Seite sichern
    const existingTitleEl = document.querySelector('title')
    const pageTitle = existingTitleEl ? existingTitleEl.textContent : document.title || 'Abdulkerim — Digital Creator Portfolio'

    const existingMetaDescEl = document.querySelector('meta[name="description"]')
    const pageDescription =
      existingMetaDescEl && existingMetaDescEl.getAttribute('content')
        ? existingMetaDescEl.getAttribute('content')
        : 'Persönliches Portfolio und digitale Visitenkarte von Abdulkerim Sesli aus Berlin. Einblicke in private Web-Projekte, Fotografie und kreative Experimente.'

    const escapeHTML = value =>
      String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

    const safePageTitle = escapeHTML(pageTitle)

    // 2. Shared Head laden (mit Caching für Performance)
    const resp = await fetch('/content/components/head/head.html', {cache: 'force-cache'})
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    let html = await resp.text()

    // 3. Platzhalter {{PAGE_TITLE}} und {{PAGE_DESCRIPTION}} ersetzen
    html = html.replace(/\{\{PAGE_TITLE}}/g, safePageTitle)
    html = html.replace(/\{\{PAGE_DESCRIPTION}}/g, escapeHTML(pageDescription))

    // 4. HTML in DOM-Knoten umwandeln
    const range = document.createRange()
    range.selectNode(document.head)
    const fragment = range.createContextualFragment(html)

    const escAttr = value => {
      try {
        if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value)
      } catch (e) {
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
            } catch (e) {
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
            } catch (e) {
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
          } catch (e) {
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
        } catch (e) {
          abs = src
        }
        if (existingScripts.has(abs)) script.remove()
      })
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Head-Loader] Dedupe failed:', e)
      }
    }

    // 4b. Markiere/transformiere Skripte im Fragment zur sicheren Handhabung vor dem Einfügen
    // Wichtig: Inline-Skripte werden inert gemacht (type=text/plain), damit sie nicht beim Einfügen
    // automatisch ausgeführt und von CSP blockiert werden. Externe Skripte behalten wir als-is und
    // kennzeichnen sie zur optionalen gezielten Neu-Insertierung nach dem Einfügen.
    const fragmentScripts = Array.from(fragment.querySelectorAll('script'))
    fragmentScripts.forEach((s, idx) => {
      // If explicitly marked as plain text already (consent), skip
      const t = (s.type || '').toLowerCase()
      if (t === 'text/plain') return

      // Preserve LD+JSON inline data (non-executable structured data)
      if (t === 'application/ld+json') {
        // Ensure marker exists so we don't duplicate on later runs
        s.setAttribute('data-exec-on-insert', '1')
        s.setAttribute('data-exec-id', String(idx))
        return
      }

      // External script with src should remain executable (subject to CSP); mark for handling
      if (s.src) {
        s.setAttribute('data-exec-on-insert', '1')
        s.setAttribute('data-exec-id', String(idx))
        return
      }

      // Inline script detected: make inert BEFORE inserting into the document to avoid execution/CSP errors
      try {
        const inertScript = document.createElement('script')
        inertScript.type = 'text/plain'
        inertScript.setAttribute('data-inline-preserved', '1')
        inertScript.setAttribute('data-original-type', s.type || '')
        inertScript.setAttribute('data-exec-id', String(idx))
        inertScript.textContent = s.textContent
        s.parentNode.replaceChild(inertScript, s)
      } catch (e) {
        // If replacement fails, at least mark it to avoid attempts to execute later
        try {
          s.setAttribute('data-inline-preserved', '1')
          s.setAttribute('data-original-type', s.type || '')
        } catch (err) {
          /* ignore */
        }
      }
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

    // 7c. BreadcrumbList JSON-LD generieren (duplikat-sicher)
    try {
      if (!document.querySelector('script[type="application/ld+json"][data-breadcrumb="1"]')) {
        const path = window.location.pathname.replace(/index\.html$/, '')
        const segments = path.split('/').filter(Boolean)
        if (segments.length > 0) {
          const base = window.location.origin
          const itemList = []
          // Home
          itemList.push({
            '@type': 'ListItem',
            'position': 1,
            'name': 'Startseite',
            'item': base + '/'
          })
          // Map some common slugs to readable names
          const slugMap = {
            blog: 'Blog',
            projekte: 'Projekte',
            videos: 'Videos',
            gallery: 'Gallery',
            about: 'Über'
          }

          segments.forEach((seg, i) => {
            const name = slugMap[seg] || decodeURIComponent(seg.replace(/[-_]/g, ' '))
            const href = base + '/' + segments.slice(0, i + 1).join('/') + (i === segments.length - 1 && !path.endsWith('/') ? '' : '/')
            itemList.push({
              '@type': 'ListItem',
              'position': itemList.length + 1,
              'name': name.charAt(0).toUpperCase() + name.slice(1),
              'item': href
            })
          })

          const breadcrumb = {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            'itemListElement': itemList
          }

          const script = document.createElement('script')
          script.type = 'application/ld+json'
          script.setAttribute('data-breadcrumb', '1')
          script.textContent = JSON.stringify(breadcrumb)
          document.head.appendChild(script)
        }
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) console.warn('[Head-Loader] Breadcrumb generation failed', e)
    }

    // 7a. Skripte aus dem Shared Head sicher ausführen (insb. Module wie /content/main.js)
    try {
      const toExec = document.head.querySelectorAll('script[data-exec-on-insert="1"]')
      toExec.forEach(oldScript => {
        // If script has an external src, re-insert it (works with CSP)
        if (oldScript.src) {
          const newScript = document.createElement('script')
          // Copy attributes except the marker
          for (const {name, value} of Array.from(oldScript.attributes)) {
            if (name === 'data-exec-on-insert') continue
            newScript.setAttribute(name, value)
          }
          newScript.src = oldScript.src
          oldScript.parentNode.replaceChild(newScript, oldScript)
          return
        }

        // Allow application/ld+json inline data to be preserved (not executed)
        if (oldScript.type === 'application/ld+json' && oldScript.textContent && oldScript.textContent.trim()) {
          const newScript = document.createElement('script')
          newScript.type = 'application/ld+json'
          newScript.textContent = oldScript.textContent
          oldScript.parentNode.replaceChild(newScript, oldScript)
          return
        }

        // Inline classic/module scripts are blocked by strict CSP. Preserve inertly and warn.
        if (oldScript.textContent && oldScript.textContent.trim()) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(
              '[Head-Loader] Inline script detected in shared head; not executed due to CSP. Move to external file or add CSP hash/nonce.',
              oldScript
            )
          }
          const inertScript = document.createElement('script')
          inertScript.type = 'text/plain'
          inertScript.setAttribute('data-inline-preserved', '1')
          inertScript.setAttribute('data-original-type', oldScript.type || '')
          inertScript.textContent = oldScript.textContent
          oldScript.parentNode.replaceChild(inertScript, oldScript)
          return
        }

        // No executable content - remove marker to avoid duplicates
        oldScript.remove()
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

        const spinner = document.createElement('div')
        spinner.className = 'loader'
        spinner.setAttribute('aria-hidden', 'true')

        loaderWrapper.appendChild(spinner)
        // Prepend so loader sits above page content
        if (document.body) {
          document.body.prepend(loaderWrapper)
          try {
            document.body.classList.add('global-loading-visible')
          } catch (e) {
            /* ignore */
          }
        } else {
          document.addEventListener(
            'DOMContentLoaded',
            () => {
              document.body.prepend(loaderWrapper)
              try {
                document.body.classList.add('global-loading-visible')
              } catch (e) {
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
        const el = document.getElementById('loadingScreen')
        if (!el) return
        const elapsed = performance.now() - start
        const wait = Math.max(0, MIN_DISPLAY_TIME - elapsed)
        setTimeout(() => {
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
