/**
 * Dynamic Head Loader - Optimierte Version
 * Lädt globale Meta-Tags, Styles und Skripte zentral nach.
 * Verwaltet Titel-Ersetzung und verhindert Redundanz.
 *
 * Konfiguration: Automatische Erkennung der Kategorie und Metadaten basierend auf der URL.
 */

;(async function loadSharedHead() {
  // Verhindere mehrfache Ausführung
  if (window.SHARED_HEAD_LOADED) return

  // --- SEO CONFIGURATION ---
  const DEFAULT_META = {
    title: 'Abdulkerim — Digital Creator Portfolio',
    description:
      'Persönliches Portfolio und digitale Visitenkarte von Abdulkerim Sesli aus Berlin. Webentwicklung, Fotografie und kreative Experimente.',
    schemaType: 'WebSite'
  }

  const PAGE_CONFIG = {
    '/projekte/': {
      title: 'Webentwicklung & Coding Projekte | Abdulkerim Sesli',
      description:
        'Entdecke meine privaten Web-Projekte, Experimente mit React & Three.js sowie Open-Source-Beiträge. Einblicke in Code & Design.',
      schemaType: 'CollectionPage'
    },
    '/blog/': {
      title: 'Tech Blog & Insights | Abdulkerim Sesli',
      description:
        'Artikel über moderne Webentwicklung, JavaScript-Tricks, UI/UX-Design und persönliche Erfahrungen aus der Tech-Welt.',
      schemaType: 'Blog'
    },
    '/videos/': {
      title: 'Video-Tutorials & Demos | Abdulkerim Sesli',
      description:
        'Visuelle Einblicke in meine Arbeit: Coding-Sessions, Projekt-Demos und Tutorials zu Webtechnologien und Fotografie.',
      schemaType: 'CollectionPage'
    },
    '/gallery/': {
      title: 'Fotografie Portfolio | Abdulkerim Sesli',
      description:
        'Eine kuratierte Sammlung meiner besten Aufnahmen: Urban Photography, Landschaften und experimentelle visuelle Kunst aus Berlin.',
      schemaType: 'ImageGallery'
    },
    '/about/': {
      title: 'Über mich | Abdulkerim Sesli',
      description:
        'Wer ist Abdulkerim Sesli? Einblicke in meinen Werdegang als Webentwickler, meine Philosophie und meine Leidenschaft für digitale Kreation.',
      schemaType: 'ProfilePage'
    }
  }

  // Ermittle aktuelle Seite (Case-Insensitive Match)
  const currentPath = window.location.pathname.toLowerCase()
  let matchedKey = Object.keys(PAGE_CONFIG).find(key => currentPath.includes(key))
  const metaData = matchedKey ? PAGE_CONFIG[matchedKey] : DEFAULT_META

  try {
    const escapeHTML = value =>
      String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

    const safePageTitle = escapeHTML(metaData.title)
    const safePageDesc = escapeHTML(metaData.description)

    // 2. Shared Head laden (mit Caching für Performance)
    const resp = await fetch('/content/components/head/head.html', {cache: 'force-cache'})
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    let html = await resp.text()

    // 3. Platzhalter {{PAGE_TITLE}} und {{PAGE_DESCRIPTION}} ersetzen
    html = html.replace(/\{\{PAGE_TITLE}}/g, safePageTitle)
    html = html.replace(/\{\{PAGE_DESCRIPTION}}/g, safePageDesc)

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

    // 4a. Dedupe Links & Scripts
    // Da wir die HTML-Seiten bereinigt haben, ist die "Deduplizierung" nun eher ein "Schutz vor doppelter Ausführung"
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

      Array.from(fragment.querySelectorAll('link[rel][href]')).forEach(link => {
        const rel = (link.getAttribute('rel') || '').toLowerCase()
        const href = link.getAttribute('href')
        if (!rel || !href) return

        // Canonical und OG:URL werden unten dynamisch gesetzt, Platzhalter entfernen wir hier nicht
        // es sei denn, wir finden sie doppelt
        if (rel === 'canonical' && document.querySelector('link[rel="canonical"]')) {
           // Wir vertrauen hier auf das fragment, da wir die Seiten bereinigt haben.
           // Falls DOCH noch ein Canonical im HTML war, entfernen wir es zugunsten des Shared Heads (unten korrigiert)
           document.querySelector('link[rel="canonical"]').remove();
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
      console.warn('[Head-Loader] Dedupe failed:', e)
    }

    // 4b. Skript-Handling (Inert/Execute)
    const fragmentScripts = Array.from(fragment.querySelectorAll('script'))
    fragmentScripts.forEach((s, idx) => {
      const t = (s.type || '').toLowerCase()
      if (t === 'text/plain') return

      if (t === 'application/ld+json' || s.src) {
        s.setAttribute('data-exec-on-insert', '1')
        s.setAttribute('data-exec-id', String(idx))
        return
      }

      try {
        const inertScript = document.createElement('script')
        inertScript.type = 'text/plain'
        inertScript.setAttribute('data-inline-preserved', '1')
        inertScript.setAttribute('data-original-type', s.type || '')
        inertScript.setAttribute('data-exec-id', String(idx))
        inertScript.textContent = s.textContent
        s.parentNode.replaceChild(inertScript, s)
      } catch (e) { /* ignore */ }
    })

    // 5. Aufräumen alter Tags (falls noch vorhanden durch statisches HTML)
    // Wir erzwingen nun die Hoheit des Shared Heads.
    if (fragment.querySelector('title') && document.querySelector('title')) {
      document.querySelector('title').remove()
    }
    const metaNamesToRemove = ['description', 'keywords', 'author'];
    metaNamesToRemove.forEach(name => {
         const existing = document.querySelector(`meta[name="${name}"]`);
         if(existing) existing.remove();
    });
    // Entferne alle OG/Twitter Tags, um Konflikte zu vermeiden
    document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach(el => el.remove());


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

    // Fallback insertion
    if (!inserted) {
      const loaderScript = document.currentScript || document.querySelector('script[src*="head-complete.js"]')
      if (loaderScript && loaderScript.parentNode === document.head) {
        loaderScript.parentNode.insertBefore(fragment, loaderScript)
      } else {
        const firstAsset = document.head.querySelector('link[rel="stylesheet"], style, script')
        if (firstAsset) {
          document.head.insertBefore(fragment, firstAsset)
        } else {
          document.head.appendChild(fragment)
        }
      }
    }

    // 7. Canonical & OG URL setzen
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
      console.warn('[Head-Loader] Could not set canonical/og:url:', e)
    }

    // 8. Breadcrumb & Page Specific Schema
    try {
      // Breadcrumb logic (existing)
       if (!document.querySelector('script[type="application/ld+json"][data-breadcrumb="1"]')) {
        const path = window.location.pathname.replace(/index\.html$/, '')
        const segments = path.split('/').filter(Boolean)
        if (segments.length > 0) {
          const base = window.location.origin
          const itemList = []
          itemList.push({ '@type': 'ListItem', 'position': 1, 'name': 'Startseite', 'item': base + '/' })
          const slugMap = { blog: 'Blog', projekte: 'Projekte', videos: 'Videos', gallery: 'Gallery', about: 'Über' }

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

      // Specific Schema Type Injection
      if (metaData.schemaType && metaData.schemaType !== 'WebSite') {
         const schemaScript = document.createElement('script');
         schemaScript.type = 'application/ld+json';
         schemaScript.setAttribute('data-page-schema', '1');

         const baseSchema = {
             "@context": "https://schema.org",
             "@type": metaData.schemaType,
             "name": metaData.title,
             "description": metaData.description,
             "url": window.location.href,
             "author": { "@type": "Person", "name": "Abdulkerim Sesli" }
         };

         // Enhance specific types
         if (metaData.schemaType === 'Blog') {
             // Blog specific additions if needed
         }

         schemaScript.textContent = JSON.stringify(baseSchema);
         document.head.appendChild(schemaScript);
      }

    } catch (e) {
      console.warn('[Head-Loader] Schema generation failed', e)
    }

    // 9. Script Execution Reinforcement
    try {
      const toExec = document.head.querySelectorAll('script[data-exec-on-insert="1"]')
      toExec.forEach(oldScript => {
        if (oldScript.src) {
          const newScript = document.createElement('script')
          for (const {name, value} of Array.from(oldScript.attributes)) {
            if (name === 'data-exec-on-insert') continue
            newScript.setAttribute(name, value)
          }
          newScript.src = oldScript.src
          oldScript.parentNode.replaceChild(newScript, oldScript)
          return
        }
        if (oldScript.type === 'application/ld+json' && oldScript.textContent && oldScript.textContent.trim()) {
          const newScript = document.createElement('script')
          newScript.type = 'application/ld+json'
          newScript.textContent = oldScript.textContent
          oldScript.parentNode.replaceChild(newScript, oldScript)
          return
        }
        oldScript.remove()
      })
    } catch (e) {
       /* ignore */
    }

    // 10. Global Loader Logic
    try {
      if (!document.getElementById('loadingScreen')) {
        const loaderWrapper = document.createElement('div')
        loaderWrapper.id = 'loadingScreen'
        loaderWrapper.className = 'loading-screen'
        loaderWrapper.setAttribute('aria-hidden', 'true')
        loaderWrapper.setAttribute('role', 'status')
        const spinner = document.createElement('div')
        spinner.className = 'loader'
        loaderWrapper.appendChild(spinner)
        if (document.body) document.body.prepend(loaderWrapper)
        else document.addEventListener('DOMContentLoaded', () => document.body.prepend(loaderWrapper), {once: true})
      }
    } catch (e) {}

    // 11. Hide Loader Fallback
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
          Object.assign(el.style, { opacity: '0', pointerEvents: 'none', visibility: 'hidden' })
          const cleanup = () => { el.style.display = 'none'; el.removeEventListener('transitionend', cleanup) }
          el.addEventListener('transitionend', cleanup)
          setTimeout(cleanup, 700)
        }, wait)
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => (start = performance.now()), {once: true})
      else start = performance.now()

      window.addEventListener('load', hideLoader, {once: true})
      setTimeout(hideLoader, 5000)
    } catch (e) {}

    // Finish
    window.SHARED_HEAD_LOADED = true
    document.dispatchEvent(new CustomEvent('shared-head:loaded'))

  } catch (err) {
    console.error('[Head-Loader] Error:', err)
  }
})()
