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
        'Entdecke meine privaten Web-Projekte, Experimente mit React & Three.js sowie Open-Source-Beiträge. Einblicke in Code & Design aus Berlin (13507).',
      schemaType: 'CollectionPage',
      keywords: 'Webprojekte, React, Three.js, JavaScript, Coding, Open Source, Berlin Web Developer'
    },
    '/blog/': {
      title: 'Tech Blog & Insights | Abdulkerim Sesli',
      description: 'Artikel über moderne Webentwicklung, JavaScript-Tricks, UI/UX-Design und persönliche Erfahrungen aus der Tech-Welt eines Berliner Developers.',
      schemaType: 'Blog',
      keywords: 'Tech Blog, Webentwicklung, JavaScript, UI/UX, Tutorial, Insights, Berlin'
    },
    '/videos/': {
      title: 'Video-Tutorials & Demos | Abdulkerim Sesli',
      description: 'Visuelle Einblicke in meine Arbeit: Coding-Sessions, Projekt-Demos und Tutorials zu Webtechnologien und Fotografie.',
      schemaType: 'CollectionPage',
      keywords: 'Video Tutorials, Coding Sessions, Projekt Demos, YouTube, Web Development Videos'
    },
    '/gallery/': {
      title: 'Fotografie Portfolio | Abdulkerim Sesli',
      description:
        'Eine kuratierte Sammlung meiner besten Aufnahmen: Urban Photography, Landschaften und experimentelle visuelle Kunst aus Berlin (Reinickendorf/Tegel).',
      schemaType: 'ImageGallery',
      keywords: 'Fotografie, Urban Photography, Landschaftsfotografie, Berlin, Portfolio, Berlin 13507'
    },
    '/about/': {
      title: 'Abdulkerim Sesli — Webentwickler & Digital Creator | Berlin',
      description:
        'Webentwickler, Fotograf & Digital Creator aus Berlin (13507). Projekte, Leistungen und Kontakt — CV herunterladen oder direkt per E‑Mail erreichen.',
      schemaType: 'ProfilePage',
      keywords: 'Webentwickler, Digital Creator, Berlin, Portfolio, Kontakt, Abdulkerim Sesli'
    }
  }

  const currentPath = window.location.pathname.toLowerCase()
  const matchedKey = Object.keys(PAGE_CONFIG).find(key => currentPath.includes(key))
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
    } catch (e) {
      return false
    }
  }

  try {
    const escapeHTML = value =>
      String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

    const safePageTitle = escapeHTML(metaData.title)
    const safePageDesc = escapeHTML(metaData.description)
    const safeKeywords = escapeHTML(metaData.keywords || DEFAULT_META.keywords)

    // Generate BreadcrumbList JSON-LD dynamically for main sections and deeper pages
    try {
      ;(function createBreadcrumbJsonLd() {
        const siteBase = window.location.origin.replace(/\/$/, '')
        const sections = {
          '/projekte/': 'Projekte',
          '/blog/': 'Blog',
          '/videos/': 'Videos',
          '/gallery/': 'Galerie',
          '/about/': 'Über'
        }
        const path = currentPath
        const trail = [{name: 'Startseite', url: siteBase + '/'}]

        // prefer exact section match at path start, else try includes
        const sectionKey =
          Object.keys(sections).find(k => path === k || path.startsWith(k)) || Object.keys(sections).find(k => path.includes(k))

        if (path !== '/' && sectionKey) {
          trail.push({name: sections[sectionKey], url: siteBase + sectionKey})
        }

        // last element: page title (avoid duplicates, avoid adding page title on homepage and on section index pages)
        if (path !== '/') {
          const sectionUrl = sectionKey ? siteBase + sectionKey : null
          const pageUrl = siteBase + path

          if (sectionKey) {
            trail.push({name: sections[sectionKey], url: sectionUrl})
          }

          const lastUrls = trail.map(t => t.url)
          if (!lastUrls.includes(pageUrl) && !trail.some(t => t.name === safePageTitle)) {
            trail.push({name: safePageTitle, url: pageUrl})
          }
        }

        const breadcrumbLd = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          'itemListElement': trail.map((t, i) => ({
            '@type': 'ListItem',
            'position': i + 1,
            'name': t.name,
            'item': t.url
          }))
        }

        // only insert if no existing BreadcrumbList present (dedupe)
        const hasBreadcrumb = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
          .map(s => {
            try {
              return JSON.parse(s.textContent)
            } catch (e) {
              return null
            }
          })
          .some(obj => obj && obj['@type'] === 'BreadcrumbList')

        if (!hasBreadcrumb) {
          const s = document.createElement('script')
          s.type = 'application/ld+json'
          s.textContent = JSON.stringify(breadcrumbLd)
          s.setAttribute('data-exec-on-insert', '1')
          document.head.appendChild(s)
        }
      })()
    } catch (e) {
      /* ignore DOM not available in some environments */
    }

    // Fetch fragment robustly: prefer extensionless path to avoid 3xx redirects
    async function fetchFragment(path, opts = {cache: 'force-cache'}) {
      // Heuristic: prefer .html on localhost/dev to avoid initial 404 noise from servers that
      // don't serve extensionless paths; prefer extensionless on production/CDN for cleaner URLs
      const isLocal = location.hostname === 'localhost' || location.hostname.startsWith('127.') || location.hostname.endsWith('.local')
      const base = path.replace(/\.html$/, '')
      const withHtml = base + '.html'
      const candidates = isLocal ? [withHtml, base] : [base, withHtml]

      let lastErr = null
      for (const p of candidates) {
        try {
          const r = await fetch(p, opts)
          if (r.ok) return r
          lastErr = new Error(`HTTP ${r.status}`)
        } catch (e) {
          lastErr = e
        }
      }
      throw lastErr || new Error('Fragment fetch failed')
    }

    const resp = await fetchFragment('/content/components/head/head.html', {cache: 'force-cache'})
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
                } catch (e) {
                  /* ignore parse errors */
                }
              })
            })
          } catch (e) {
            /* ignore invalid JSON-LD */
          }
        })
      } catch (e) {
        /* ignore */
      }
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
            'position': 1,
            'name': 'Startseite',
            'item': base + '/'
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

      // 2. WebSite Schema mit Sitelinks SearchAction
      if (!document.querySelector('script[data-website-search="1"]') && !existingSchemaType('WebSite')) {
        const websiteSearchSchema = {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          'url': window.location.origin,
          'name': 'Abdulkerim — Digital Creator Portfolio',
          'alternateName': ['AKS Portfolio', 'Abdulkerim Sesli Portfolio'],
          'potentialAction': [
            {
              '@type': 'SearchAction',
              'target': {
                '@type': 'EntryPoint',
                'urlTemplate': window.location.origin + '/?s={search_term_string}'
              },
              'query-input': 'required name=search_term_string'
            },
            {
              '@type': 'ContactAction',
              'target': {
                '@type': 'EntryPoint',
                'urlTemplate': 'mailto:kontakt@abdulkerimsesli.de'
              }
            }
          ]
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
            'name': metaData.title,
            'description': metaData.description,
            'url': window.location.href,
            'author': {
              '@type': 'Person',
              'name': 'Abdulkerim Sesli',
              'url': window.location.origin + '/about/',
              'sameAs': [
                'https://github.com/aKs030',
                'https://linkedin.com/in/abdulkerimsesli',
                'https://twitter.com/abdulkerimsesli',
                'https://de.wikipedia.org/wiki/Abdulkerim_Sesli',
                'https://commons.wikimedia.org/wiki/File:Abdulkerim_Sesli_portrait_2025.png'
              ]
            },
            'publisher': {
              '@id': window.location.origin + '/#organization'
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
              'itemListElement': []
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
            'name': 'Hauptbereiche',
            'description': 'Wichtige Bereiche der Website',
            'itemListElement': [
              {
                '@type': 'ListItem',
                'position': 1,
                'name': 'Projekte',
                'url': window.location.origin + '/projekte/',
                'description': 'Webentwicklung & Coding Projekte'
              },
              {
                '@type': 'ListItem',
                'position': 2,
                'name': 'Blog',
                'url': window.location.origin + '/blog/',
                'description': 'Tech Blog & Insights'
              },
              {
                '@type': 'ListItem',
                'position': 3,
                'name': 'Videos',
                'url': window.location.origin + '/videos/',
                'description': 'Video-Tutorials & Demos'
              },
              {
                '@type': 'ListItem',
                'position': 4,
                'name': 'Galerie',
                'url': window.location.origin + '/gallery/',
                'description': 'Fotografie Portfolio'
              },
              {
                '@type': 'ListItem',
                'position': 5,
                'name': 'Über',
                'url': window.location.origin + '/about/',
                'description': 'Über Abdulkerim Sesli'
              }
            ]
          }
          const script = document.createElement('script')
          script.type = 'application/ld+json'
          script.setAttribute('data-sitelinks', '1')
          script.textContent = JSON.stringify(sitelinksSchema)
          document.head.appendChild(script)
        }

        // 5. FAQPage (if visible in footer) — build from footer FAQ items to avoid duplication
        try {
          if (document.querySelector('.footer-faq-list') && !document.querySelector('script[data-faq="1"]')) {
            const faqItems = Array.from(document.querySelectorAll('.footer-faq-list .faq-item'))
              .map(d => {
                const q = d.querySelector('summary')
                const a = d.querySelector('p')
                if (q && a)
                  return {
                    '@type': 'Question',
                    'name': q.textContent.trim(),
                    'acceptedAnswer': {'@type': 'Answer', 'text': a.textContent.trim()}
                  }
                return null
              })
              .filter(Boolean)
            if (faqItems.length) {
              const faqSchema = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': faqItems}
              const s = document.createElement('script')
              s.type = 'application/ld+json'
              s.setAttribute('data-faq', '1')
              s.textContent = JSON.stringify(faqSchema)
              document.head.appendChild(s)
            }
          }
        } catch (e) {
          /* noop */
        }

        // 6. @graph Consolidation + Speakable support (dupe-safe)
        try {
          if (!document.querySelector('script[data-graph="1"]')) {
            const graph = []

            // Helper to safely parse JSON-LD script text
            const parseSafe = el => {
              try {
                return el && el.textContent ? JSON.parse(el.textContent) : null
              } catch (e) {
                return null
              }
            }

            // Person
            const personEl = document.querySelector('script[type="application/ld+json"][data-person="1"]')
            const personObj = parseSafe(personEl)
            if (personObj) {
              personObj['@id'] = personObj['@id'] || window.location.origin + '/#person'
              // Reference existing Person by @id to avoid duplicating full object and merging reviews
              if (personEl) graph.push({'@id': personObj['@id']})
              else graph.push(personObj)
            } else {
              graph.push({'@type': 'Person', '@id': window.location.origin + '/#person', 'name': 'Abdulkerim Sesli'})
            }

            // Organization
            const orgEl = document.querySelector('script[type="application/ld+json"][data-organization="1"]')
            const orgObj = parseSafe(orgEl)
            if (orgObj) {
              orgObj['@id'] = orgObj['@id'] || window.location.origin + '/#organization'
              // Reference existing Organization by @id to avoid duplicates (prevents combined review/aggregate issues)
              if (orgEl) graph.push({'@id': orgObj['@id']})
              else graph.push(orgObj)
            } else {
              graph.push({
                '@type': 'Organization',
                '@id': window.location.origin + '/#organization',
                'name': 'Abdulkerim — Digital Creator Portfolio'
              })
            }

            // WebSite (merge with SearchAction/contact actions)
            const webEl = document.querySelector('script[type="application/ld+json"][data-website-search="1"]')
            const webObj = parseSafe(webEl)
            if (webObj) {
              // Add speakable on homepage
              if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
                webObj.speakable = webObj.speakable || {'@type': 'SpeakableSpecification', 'cssSelector': []}
                // Prefer obvious selectors if present
                const selectors = ['.hero .lead', '.typewriter-title', '.blog-subline', 'meta[name="description"]']
                webObj.speakable.cssSelector = Array.from(new Set((webObj.speakable.cssSelector || []).concat(selectors)))
              }
              graph.push(webObj)
            }

            // BreadcrumbList if present
            const bcEl = document.querySelector('script[type="application/ld+json"][data-breadcrumb="1"]')
            const bcObj = parseSafe(bcEl)
            if (bcObj) graph.push(bcObj)

            // Sitelinks / ItemList
            const slEl = document.querySelector('script[data-sitelinks="1"]')
            const slObj = parseSafe(slEl)
            if (slObj) graph.push(slObj)

            // FAQPage if present
            const faqEl = document.querySelector('script[data-faq="1"]')
            const faqObj = parseSafe(faqEl)
            if (faqObj) graph.push(faqObj)

            // Only insert if we have at least two useful nodes
            if (graph.length > 0) {
              const g = {'@context': 'https://schema.org', '@graph': graph}
              const s = document.createElement('script')
              s.type = 'application/ld+json'
              s.setAttribute('data-graph', '1')
              s.textContent = JSON.stringify(g)
              document.head.appendChild(s)
            }
          }
        } catch (e) {
          /* noop */
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
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => (start = performance.now()), {once: true})
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
