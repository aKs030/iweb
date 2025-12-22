/**
 * Dynamic Head Loader - Google SEO Optimized Version
 * Erweitert um:
 * - Optimierte Icons für Google-Suche
 * - Erweiterte Schema.org Markups
 * - Sitelinks-Optimierung
 * - Kategorien und Navigationsstruktur
 */

;(async function loadSharedHead() {
  if (window.SHARED_HEAD_LOADED) return

  // --- SEO CONFIGURATION ---
  const DEFAULT_META = {
    title: 'Abdulkerim — Digital Creator Portfolio',
    description:
      'Persönliches Portfolio und digitale Visitenkarte von Abdulkerim Sesli aus Berlin. Webentwicklung, Fotografie und kreative Experimente.',
    schemaType: 'WebSite',
    keywords: 'Webentwicklung, JavaScript, React, Three.js, Fotografie, Portfolio, Berlin'
  }

  const PAGE_CONFIG = {
    '/projekte/': {
      title: 'Webentwicklung & Coding Projekte | Abdulkerim Sesli',
      description:
        'Entdecke meine privaten Web-Projekte, Experimente mit React & Three.js sowie Open-Source-Beiträge. Einblicke in Code & Design.',
      schemaType: 'CollectionPage',
      keywords: 'Webprojekte, React, Three.js, JavaScript, Coding, Open Source'
    },
    '/blog/': {
      title: 'Tech Blog & Insights | Abdulkerim Sesli',
      description:
        'Artikel über moderne Webentwicklung, JavaScript-Tricks, UI/UX-Design und persönliche Erfahrungen aus der Tech-Welt.',
      schemaType: 'Blog',
      keywords: 'Tech Blog, Webentwicklung, JavaScript, UI/UX, Tutorial, Insights'
    },
    '/videos/': {
      title: 'Video-Tutorials & Demos | Abdulkerim Sesli',
      description:
        'Visuelle Einblicke in meine Arbeit: Coding-Sessions, Projekt-Demos und Tutorials zu Webtechnologien und Fotografie.',
      schemaType: 'CollectionPage',
      keywords: 'Video Tutorials, Coding Sessions, Projekt Demos, YouTube'
    },
    '/gallery/': {
      title: 'Fotografie Portfolio | Abdulkerim Sesli',
      description:
        'Eine kuratierte Sammlung meiner besten Aufnahmen: Urban Photography, Landschaften und experimentelle visuelle Kunst aus Berlin.',
      schemaType: 'ImageGallery',
      keywords: 'Fotografie, Urban Photography, Landschaftsfotografie, Berlin, Portfolio'
    },
    '/about/': {
      title: 'Über mich | Abdulkerim Sesli',
      description:
        'Wer ist Abdulkerim Sesli? Einblicke in meinen Werdegang als Webentwickler, meine Philosophie und meine Leidenschaft für digitale Kreation.',
      schemaType: 'ProfilePage',
      keywords: 'Über mich, Webentwickler, Berlin, Digital Creator, Persönliches'
    }
  }

  const currentPath = window.location.pathname.toLowerCase()
  let matchedKey = Object.keys(PAGE_CONFIG).find(key => currentPath.includes(key))
  const metaData = matchedKey ? PAGE_CONFIG[matchedKey] : DEFAULT_META

  // Helper: check whether a JSON-LD script of a given @type already exists in the document
  const existingSchemaType = type => {
    try {
      return Array.from(document.querySelectorAll('script[type="application/ld+json"]')).some(s => {
        try {
          const j = JSON.parse(s.textContent)
          if (Array.isArray(j)) return j.some(x => x && x['@type'] === type)
          return j && j['@type'] === type
        } catch (e) {
          return false
        }
      })
    } catch (e) { return false }
  }

  try {
    const escapeHTML = value =>
      String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

    const safePageTitle = escapeHTML(metaData.title)
    const safePageDesc = escapeHTML(metaData.description)
    const safeKeywords = escapeHTML(metaData.keywords || DEFAULT_META.keywords)

    const resp = await fetch('/content/components/head/head.html', {cache: 'force-cache'})
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    let html = await resp.text()

    html = html.replace(/\{\{PAGE_TITLE}}/g, safePageTitle)
    html = html.replace(/\{\{PAGE_DESCRIPTION}}/g, safePageDesc)
    html = html.replace(/\{\{PAGE_KEYWORDS}}/g, safeKeywords)

    const range = document.createRange()
    range.selectNode(document.head)
    const fragment = range.createContextualFragment(html)

    // Dedupe und Script-Handling wie bisher...
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

        if (rel === 'canonical' && document.querySelector('link[rel="canonical"]')) {
          document.querySelector('link[rel="canonical"]').remove()
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

      // Additionally: dedupe JSON-LD by @type — if the fragment provides a JSON-LD type, remove existing scripts of the same type
      try {
        const fragLd = Array.from(fragment.querySelectorAll('script[type="application/ld+json"]'))
        fragLd.forEach(s => {
          try {
            const parsed = JSON.parse(s.textContent)
            const types = []
            if (Array.isArray(parsed)) parsed.forEach(it => it && it['@type'] && types.push(it['@type']))
            else if (parsed && parsed['@type']) types.push(parsed['@type'])

            types.forEach(t => {
              Array.from(document.querySelectorAll('script[type="application/ld+json"]')).forEach(existing => {
                try {
                  const ej = JSON.parse(existing.textContent)
                  const existingTypes = Array.isArray(ej) ? ej.map(x => x['@type']) : [ej['@type']]
                  if (existingTypes.includes(t)) existing.remove()
                } catch (e) { /* ignore parse errors */ }
              })
            })
          } catch (e) { /* ignore invalid JSON-LD */ }
        })
      } catch (e) { /* ignore */ }

    } catch (e) {
      console.warn('[Head-Loader] Dedupe failed:', e)
    }

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
      } catch (e) {}
    })

    if (fragment.querySelector('title') && document.querySelector('title')) {
      document.querySelector('title').remove()
    }
    const metaNamesToRemove = ['description', 'keywords', 'author']
    metaNamesToRemove.forEach(name => {
      const existing = document.querySelector(`meta[name="${name}"]`)
      if (existing) existing.remove()
    })
    document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach(el => el.remove())

    let inserted = false
    const childNodes = Array.from(document.head.childNodes)
    for (const node of childNodes) {
      if (node.nodeType === Node.COMMENT_NODE && node.nodeValue.includes('SHARED_HEAD')) {
        // Before inserting, remove any JSON-LD markers from the fragment if the document already contains them
        try {
          const markerSelectors = [
            'script[type="application/ld+json"][data-person]',
            'script[type="application/ld+json"][data-website-search]',
            'script[type="application/ld+json"][data-organization]',
            'script[type="application/ld+json"][data-sitelinks]'
          ];
          markerSelectors.forEach(sel => {
            if (document.querySelector(sel)) {
              const nodes = fragment.querySelectorAll(sel);
              nodes.forEach(n => n.remove());
            }
          });
        } catch (e) { /* ignore */ }

        node.parentNode.replaceChild(fragment, node)
        inserted = true
        break
      }
    }

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

    // Canonical & OG URL setzen
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

    // ERWEITERTE SCHEMA.ORG MARKUPS
    try {
      // 1. Breadcrumb Schema
      if (!document.querySelector('script[type="application/ld+json"][data-breadcrumb="1"]')) {
        const path = window.location.pathname.replace(/index\.html$/, '')
        const segments = path.split('/').filter(Boolean)
        if (segments.length > 0) {
          const base = window.location.origin
          const itemList = []
          itemList.push({
            '@type': 'ListItem',
            position: 1,
            name: 'Startseite',
            item: base + '/'
          })

          const slugMap = {
            blog: 'Blog',
            projekte: 'Projekte',
            videos: 'Videos',
            gallery: 'Gallery',
            about: 'Über'
          }

          segments.forEach((seg, i) => {
            const name = slugMap[seg] || decodeURIComponent(seg.replace(/[-_]/g, ' '))
            const href =
              base +
              '/' +
              segments.slice(0, i + 1).join('/') +
              (i === segments.length - 1 && !path.endsWith('/') ? '' : '/')
            itemList.push({
              '@type': 'ListItem',
              position: itemList.length + 1,
              name: name.charAt(0).toUpperCase() + name.slice(1),
              item: href
            })
          })

          const breadcrumb = {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: itemList
          }
          const script = document.createElement('script')
          script.type = 'application/ld+json'
          script.setAttribute('data-breadcrumb', '1')
          script.textContent = JSON.stringify(breadcrumb)
          document.head.appendChild(script)
        }
      }

      // 2. WebSite Schema mit Sitelinks SearchAction
      if (!document.querySelector('script[data-website-search="1"]') && !existingSchemaType('WebSite')) {
        const websiteSearchSchema = {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          url: window.location.origin,
          name: 'Abdulkerim — Digital Creator Portfolio',
          alternateName: ['AKS Portfolio', 'Abdulkerim Sesli Portfolio'],
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: window.location.origin + '/?s={search_term_string}'
            },
            'query-input': 'required name=search_term_string'
          }
        }
        const script = document.createElement('script')
        script.type = 'application/ld+json'
        script.setAttribute('data-website-search', '1')
        script.textContent = JSON.stringify(websiteSearchSchema)
        document.head.appendChild(script)
      }

      // 3. Page-specific Schema
      if (metaData.schemaType && metaData.schemaType !== 'WebSite') {
        if (!document.querySelector('script[data-page-schema="1"]') && !existingSchemaType(metaData.schemaType)) {
          const baseSchema = {
            '@context': 'https://schema.org',
            '@type': metaData.schemaType,
            name: metaData.title,
            description: metaData.description,
            url: window.location.href,
            author: {
              '@type': 'Person',
              name: 'Abdulkerim Sesli',
              url: window.location.origin + '/about/',
              sameAs: [
                'https://github.com/aKs030',
                'https://linkedin.com/in/abdulkerimsesli',
                'https://twitter.com/abdulkerimsesli'
              ]
            },
            publisher: {
              '@type': 'Organization',
              name: 'Abdulkerim — Digital Creator Portfolio',
              logo: {
                '@type': 'ImageObject',
                url: window.location.origin + '/content/assets/img/icons/icon-512.png',
                width: 512,
                height: 512
              }
            }
          }

          // Erweiterte Schema-Typen
          if (metaData.schemaType === 'Blog') {
            baseSchema.blogPost = []
            baseSchema.inLanguage = 'de-DE'
          } else if (metaData.schemaType === 'ImageGallery') {
            baseSchema.associatedMedia = []
          } else if (metaData.schemaType === 'CollectionPage') {
            baseSchema.mainEntity = {
              '@type': 'ItemList',
              itemListElement: []
            }
          }

          const schemaScript = document.createElement('script')
          schemaScript.type = 'application/ld+json'
          schemaScript.setAttribute('data-page-schema', '1')
          schemaScript.textContent = JSON.stringify(baseSchema)
          document.head.appendChild(schemaScript)
        }
      }

      // 4. Sitelinks Schema für Google
      if (currentPath === '/' || currentPath === '/index.html') {
        if (!document.querySelector('script[data-sitelinks="1"]')) {
          const sitelinksSchema = {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Hauptbereiche',
            description: 'Wichtige Bereiche der Website',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Projekte',
                url: window.location.origin + '/projekte/',
                description: 'Webentwicklung & Coding Projekte'
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Blog',
                url: window.location.origin + '/blog/',
                description: 'Tech Blog & Insights'
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: 'Videos',
                url: window.location.origin + '/videos/',
                description: 'Video-Tutorials & Demos'
              },
              {
                '@type': 'ListItem',
                position: 4,
                name: 'Galerie',
                url: window.location.origin + '/gallery/',
                description: 'Fotografie Portfolio'
              },
              {
                '@type': 'ListItem',
                position: 5,
                name: 'Über',
                url: window.location.origin + '/about/',
                description: 'Über Abdulkerim Sesli'
              }
            ]
          }
          const script = document.createElement('script')
          script.type = 'application/ld+json'
          script.setAttribute('data-sitelinks', '1')
          script.textContent = JSON.stringify(sitelinksSchema)
          document.head.appendChild(script)
        }
      }
    } catch (e) {
      console.warn('[Head-Loader] Schema generation failed', e)
    }

    // Script Execution
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
    } catch (e) {}

    // Loading Screen
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
        else
          document.addEventListener('DOMContentLoaded', () => document.body.prepend(loaderWrapper), {
            once: true
          })
      }
    } catch (e) {}

    // Hide Loader
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
          Object.assign(el.style, {opacity: '0', pointerEvents: 'none', visibility: 'hidden'})
          const cleanup = () => {
            el.style.display = 'none'
            el.removeEventListener('transitionend', cleanup)
          }
          el.addEventListener('transitionend', cleanup)
          setTimeout(cleanup, 700)
        }, wait)
      }
      if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', () => (start = performance.now()), {once: true})
      else start = performance.now()

      window.addEventListener('load', hideLoader, {once: true})
      setTimeout(hideLoader, 5000)
    } catch (e) {}

    window.SHARED_HEAD_LOADED = true
    document.dispatchEvent(new CustomEvent('shared-head:loaded'))
  } catch (err) {
    console.error('[Head-Loader] Error:', err)
  }
})()
