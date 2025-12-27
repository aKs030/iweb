/**
 * Dynamic Head Loader - Ultimate Modern SEO & Schema Graph (@graph approach)
 * Version: 2025.3.4 (Identity Disambiguation & Abdul Berlin)
 * * Features:
 * - [GELB] Icon Fix: Re-Integration von 'Organization' für Logo-Support
 * - [ROT] Snippet Fill: Maximierte Descriptions & Knowledge-Injection
 * - [BLAU] FAQ Booster: Strict Mode + Whitespace Cleaner (gegen "Unbenanntes Element")
 * - [GRÜN] Geo Update: Explizite GeoCoordinates & HomeLocation
 * - [LILA] Identity Fix: Disambiguating Description & Alternate Names (Abdul Berlin)
 */

import {createLogger} from '../../utils/shared-utilities.js'

const log = createLogger('HeadLoader')

;(async function loadSharedHead() {
  if (window.SHARED_HEAD_LOADED) return

  // --- 1. GLOBALE DATEN & KONFIGURATION ---
  const BASE_URL = 'https://abdulkerimsesli.de'

  // A. VISUELLE STEUERUNG (Icons & Business Data)
  const BRAND_DATA = {
    name: 'Abdulkerim Sesli',
    legalName: 'Abdulkerim Sesli — Creative Digital Services',
    alternateName: ['Abdul Sesli', 'Abdul Berlin', 'Abdulkerim Berlin'],
    logo: `${BASE_URL}/content/assets/img/icons/icon-512.png`, // [GELB] Das Icon für Google
    jobTitle: ['Web Developer', 'Photographer'],
    email: 'kontakt@abdulkerimsesli.de',
    areaServed: 'Berlin, Deutschland',
    address: {
      '@type': 'PostalAddress',
      'addressLocality': 'Berlin',
      'postalCode': '13507',
      'addressCountry': 'DE'
    },
    geo: {
      '@type': 'GeoCoordinates',
      'latitude': '52.5733',
      'longitude': '13.2911'
    },
    sameAs: [
      'https://github.com/aKs030',
      'https://linkedin.com/in/abdulkerimsesli',
      'https://twitter.com/abdulkerimsesli',
      'https://www.instagram.com/abdulkerimsesli',
      'https://www.youtube.com/@aks.030'    ]
  }

  // B. INHALTS-STEUERUNG (Snippet Text Füllung)
  // [ROT] Hier füllen wir den Text-Bereich maximal auf (~160 Zeichen + Keywords)
  const ROUTES = {
    'default': {
      title: 'Abdulkerim Sesli | Webentwicklung & Fotografie Berlin | Abdul Berlin',
      description:
        'Offizielles Portfolio von Abdulkerim Sesli (Abdul Berlin). Webentwickler (React, Three.js) und Fotograf aus Berlin. Nicht zu verwechseln mit Hörbuch-Verlagen.',
      type: 'ProfilePage',
      image: `${BASE_URL}/content/assets/img/og/og-home.png`
    },
    '/projekte/': {
      title: 'Referenzen & Code-Projekte | Abdulkerim Sesli',
      description:
        'Entdecke interaktive Web-Experimente aus Berlin (13507). Spezialisiert auf performante React-Lösungen, 3D-Web (Three.js) und modernes UI/UX Design.',
      type: 'CollectionPage',
      image: `${BASE_URL}/content/assets/img/og/og-projects.png`
    },
    '/blog/': {
      title: 'Tech-Blog & Tutorials | Webentwicklung Berlin',
      description:
        'Expertenwissen zu JavaScript, CSS und Web-Architektur. Praxisnahe Tutorials und Einblicke in den Workflow eines Berliner Fullstack-Entwicklers.',
      type: 'Blog',
      image: `${BASE_URL}/content/assets/img/og/og-blog.png`
    },
    '/videos/': {
      title: 'Videos — Abdulkerim Sesli',
      description: 'Eine Auswahl meiner Arbeiten, kurzen Vorstellungen und Behind-the-Scenes.',
      type: 'CollectionPage',
      // NOTE: currently uses og-home.png as a fallback.
      image: `${BASE_URL}/content/assets/img/og/og-home.png`
    },
    '/gallery/': {
      title: 'Fotografie Portfolio | Urban & Portrait Berlin',
      description:
        'Visuelle Ästhetik aus der Hauptstadt. Kuratierte Galerie mit Fokus auf Street Photography, Architektur und atmosphärische Portraits aus Berlin und Umgebung.',
      type: 'ImageGallery',
      image: `${BASE_URL}/content/assets/img/og/og-gallery.png`
    },
    '/about/': {
      title: 'Kontakt & Profil | Abdulkerim Sesli',
      description:
        'Der Mensch hinter dem Code. Detaillierter Lebenslauf, Tech-Stack Übersicht und direkte Kontaktmöglichkeiten für Projektanfragen und Kooperationen.',
      type: 'AboutPage',
      image: `${BASE_URL}/content/assets/img/og/og-about.png`
    }
  }

  // [BLAU] Diese Fragen tauchen direkt in der Google-Suche auf
  const BUSINESS_FAQS = [
    {
      q: 'Welche Dienstleistungen bietest du an?',
      a: 'Ich biete professionelle Webentwicklung (Frontend & Fullstack mit React/Node.js) sowie hochwertige Fotografie-Dienstleistungen (Portrait, Urban, Event) im Raum Berlin an.'
    },
    {
      q: 'Welchen Tech-Stack verwendest du?',
      a: 'Mein Fokus liegt auf modernen JavaScript-Frameworks wie React, Next.js und Vue. Für 3D-Visualisierungen im Web nutze ich Three.js und WebGL.'
    },
    {
      q: 'Bist du für Freelance-Projekte verfügbar?',
      a: 'Ja, ich bin offen für spannende Projektanfragen und Kooperationen. Kontaktieren Sie mich gerne direkt über meine Webseite oder LinkedIn.'
    }
  ]

  // Pfad-Logik
  const currentPath = window.location.pathname.toLowerCase()
  const matchedKey = Object.keys(ROUTES).find(key => key !== 'default' && currentPath.includes(key))
  const pageData = matchedKey ? ROUTES[matchedKey] : ROUTES.default
  const pageUrl = window.location.href.split('#')[0]

  // --- Push stable page metadata to dataLayer for GTM (no PII) ---
  try {
    window.dataLayer = window.dataLayer || []
    const page_meta = {
      page_title: pageData.title || document.title || '',
      page_path: window.location.pathname || '/',
      page_url: pageUrl,
      page_type: pageData.type || 'WebPage',
      page_image: pageData.image || '',
      page_lang: 'de-DE'
    }

    // push a named event so GTM can use it as trigger (and to avoid premature reads)
    window.dataLayer.push({ event: 'pageMetadataReady', page_meta })
  } catch (e) {
    log && log.warn && log.warn('head-complete: pushing page metadata failed', e)
  }

  // --- 2. HTML HEAD UPDATES (lightweight, no heavy DOM replacement) ---
  try {
    const {createLogger} = await import('../../utils/shared-utilities.js')
    const _log = createLogger('HeadLoader')
    // Known production hosts - used in canonical & JSON-LD decisions
    const PROD_HOSTS = ['abdulkerimsesli.de', 'www.abdulkerimsesli.de']

    const _escapeHTML = str =>
      String(str).replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[m])

    const upsertMeta = (nameOrProperty, content, isProperty = false) => {
      if (!content) return
      const selector = isProperty ? `meta[property="${nameOrProperty}"]` : `meta[name="${nameOrProperty}"]`
      let el = document.head.querySelector(selector)
      if (el) {
        el.setAttribute(isProperty ? 'property' : 'name', nameOrProperty)
        el.setAttribute('content', content)
      } else {
        el = document.createElement('meta')
        if (isProperty) el.setAttribute('property', nameOrProperty)
        else el.setAttribute('name', nameOrProperty)
        el.setAttribute('content', content)
        document.head.appendChild(el)
      }
    }

    const upsertLink = (rel, href) => {
      if (!href) return
      let el = document.head.querySelector(`link[rel="${rel}"]`)
      if (el) el.setAttribute('href', href)
      else {
        el = document.createElement('link')
        el.setAttribute('rel', rel)
        el.setAttribute('href', href)
        document.head.appendChild(el)
      }
    }

    // Title: only override if we have a non-empty title
    if (pageData.title && pageData.title.trim()) document.title = pageData.title

    // Meta descriptions and core tags
    upsertMeta('description', pageData.description)
    upsertMeta('robots', 'index, follow, max-image-preview:large')
    upsertMeta('language', 'de-DE')
    upsertMeta('author', 'Abdulkerim Sesli')
    upsertMeta('twitter:card', 'summary_large_image')
    upsertMeta('twitter:creator', '@abdulkerimsesli')

    // Geo Tags for Local SEO (Berlin 13507)
    upsertMeta('geo.region', 'DE-BE')
    upsertMeta('geo.placename', 'Berlin')
    upsertMeta('geo.position', '52.5733;13.2911')
    upsertMeta('ICBM', '52.5733, 13.2911')

    // OpenGraph minimal set (property)
    upsertMeta('og:title', pageData.title, true)
    upsertMeta('og:description', pageData.description, true)
    upsertMeta('og:locale', 'de_DE', true)
    if (pageData.image) upsertMeta('og:image', pageData.image, true)

    // Social URLs - ensure shares show the current page URL
    upsertMeta('og:url', pageUrl, true)
    upsertMeta('twitter:url', pageUrl)

    // Improve social image metadata: alt text (accessibility) and recommended dimensions
    const imageAlt = pageData.title || pageData.description || ''
    if (imageAlt) upsertMeta('twitter:image:alt', imageAlt)
    if (pageData.image) {
      // Try to find real image dimensions from the generated JSON file
      try {
        fetch('/content/utils/og-image-dimensions.json')
          .then(r => (r.ok ? r.json() : null))
          .then(map => {
            if (!map) {
              upsertMeta('og:image:width', '1200', true)
              upsertMeta('og:image:height', '630', true)
              return
            }
            // image path may be absolute URL or relative path; normalize to web path
            const imgPath = pageData.image.startsWith('/') ? pageData.image : pageData.image
            const dims = map[imgPath] || map[pageData.image] || null
            if (dims) {
              upsertMeta('og:image:width', String(dims.width), true)
              upsertMeta('og:image:height', String(dims.height), true)
            } else {
              upsertMeta('og:image:width', '1200', true)
              upsertMeta('og:image:height', '630', true)
            }
          })
          .catch(() => {
            upsertMeta('og:image:width', '1200', true)
            upsertMeta('og:image:height', '630', true)
          })
      } catch {
        upsertMeta('og:image:width', '1200', true)
        upsertMeta('og:image:height', '630', true)
      }
    }

    // Canonical: prefer fixed production origin for known hosts, else use runtime pageUrl
    try {
      // PROD_HOSTS is defined above (shared); determine hostname for env checks
      const hostname = window.location.hostname.toLowerCase()
      const _ensureTrailingSlash = p => (p.endsWith('/') ? p : p + '/')
      // Force Canonical to Production host when true. Set to false to allow dev/staging canonical behavior.
      // Recommended: automatically use production for known hosts, otherwise allow opt-in via data attribute
      const forceProdFlag = PROD_HOSTS.includes(hostname) ||
        document.documentElement.getAttribute('data-force-prod-canonical') === 'true'

      // Compute cleanPath using shared canonical util
      let cleanPath
      try {
        const {getCanonicalPathFromRoutes} = await import('../../utils/canonical-utils.js')
        cleanPath = getCanonicalPathFromRoutes(window.location.pathname, ROUTES)
      } catch {
        // Fallback to previous inline behavior if import fails
        const rawPath = window.location.pathname || '/'
        let pathForMatch = rawPath.replace(/\/\/+/g, '/')
        pathForMatch = pathForMatch.replace(/\/index\.html$/i, '/')
        pathForMatch = pathForMatch.replace(/\.html$/i, '/')
        pathForMatch = pathForMatch.replace(/\/\/+/g, '/')
        if (!pathForMatch.startsWith('/')) pathForMatch = '/' + pathForMatch
        pathForMatch = pathForMatch.endsWith('/') ? pathForMatch : pathForMatch + '/'
        const lowerMatch = pathForMatch.toLowerCase()
        let routeKey = Object.keys(ROUTES).find(k => k !== 'default' && lowerMatch.startsWith(k))
        if (!routeKey) routeKey = Object.keys(ROUTES).find(k => k !== 'default' && lowerMatch.includes(k))
        cleanPath = routeKey ? (routeKey.endsWith('/') ? routeKey : routeKey + '/') : pathForMatch
      }

      const canonicalHref = forceProdFlag
        ? `${BASE_URL}${cleanPath}`
        : PROD_HOSTS.includes(hostname)
          ? `${BASE_URL}${cleanPath}`
          : pageUrl // Fallback for localhost/dev uses raw pageUrl to avoid confusion

      // Ensure that even in non-production environments (like localhost), accessing a "dirty" physical path
      // (e.g. /pages/projekte/index.html) generates a clean canonical URL.
      const isDirtyPath = window.location.pathname.match(/^\/pages\//i) || window.location.pathname.match(/\/index\.html$/i)
      const effectiveCanonical = forceProdFlag
        ? `${BASE_URL}${cleanPath}`
        : (isDirtyPath && !PROD_HOSTS.includes(hostname))
          ? `${window.location.origin}${cleanPath}`
          : canonicalHref

      const canonicalEl = document.head.querySelector('link[rel="canonical"]')
      if (canonicalEl) canonicalEl.setAttribute('href', effectiveCanonical)
      else upsertLink('canonical', effectiveCanonical)

      // Add basic hreflang alternates (German and x-default) to improve language discovery
      const upsertAlternate = (lang, href) => {
        if (!href) return
        let el = document.head.querySelector(`link[rel="alternate"][hreflang="${lang}"]`)
        if (el) el.setAttribute('href', href)
        else {
          el = document.createElement('link')
          el.setAttribute('rel', 'alternate')
          el.setAttribute('hreflang', lang)
          el.setAttribute('href', href)
          document.head.appendChild(el)
        }
      }

      const canonicalOrigin = forceProdFlag ? BASE_URL : window.location.origin
      upsertAlternate('de', `${canonicalOrigin}${cleanPath}`)
      upsertAlternate('x-default', `${canonicalOrigin}${cleanPath}`)
    } catch (err) {
      // Safe fallback log
      log.warn('canonical detection failed', err)
      const canonicalEl = document.head.querySelector('link[rel="canonical"]')
      if (canonicalEl) canonicalEl.setAttribute('href', pageUrl)
      else upsertLink('canonical', pageUrl)
    }

    // Ensure favicon exists (minimal, do not re-inject if present)
    if (!document.head.querySelector('link[rel="icon"]')) {
      const iconLink = document.createElement('link')
      iconLink.rel = 'icon'
      iconLink.href = BRAND_DATA.logo
      document.head.appendChild(iconLink)
    }
    // Ensure PWA manifest & Apple mobile settings
    try {
      upsertLink('manifest', '/manifest.json')
      const addIcon = (href, sizes, type) => {
        if (!href) return
        let el = document.head.querySelector(`link[rel="icon"][sizes="${sizes}"]`)
        if (el) el.setAttribute('href', href)
        else {
          el = document.createElement('link')
          el.setAttribute('rel', 'icon')
          el.setAttribute('sizes', sizes)
          if (type) el.setAttribute('type', type)
          el.setAttribute('href', href)
          document.head.appendChild(el)
        }
      }
      addIcon(`${BASE_URL}/content/assets/img/icons/icon-32.png`, '32x32', 'image/png')
      addIcon(`${BASE_URL}/content/assets/img/icons/icon-16.png`, '16x16', 'image/png')

      let shortcutEl = document.head.querySelector('link[rel="shortcut icon"]')
      if (shortcutEl) shortcutEl.setAttribute('href', `${BASE_URL}/content/assets/img/icons/favicon.ico`)
      else {
        shortcutEl = document.createElement('link')
        shortcutEl.rel = 'shortcut icon'
        shortcutEl.href = `${BASE_URL}/content/assets/img/icons/favicon.ico`
        document.head.appendChild(shortcutEl)
      }
      upsertMeta('theme-color', '#0d0d0d')
      upsertMeta('apple-mobile-web-app-capable', 'yes')
      upsertMeta('apple-mobile-web-app-title', BRAND_DATA.name)
      upsertMeta('apple-mobile-web-app-status-bar-style', 'default')

      let appleIconEl = document.head.querySelector('link[rel="apple-touch-icon"]')
      if (appleIconEl) appleIconEl.setAttribute('href', `${BASE_URL}/content/assets/img/icons/apple-touch-icon.png`)
      else {
        appleIconEl = document.createElement('link')
        appleIconEl.setAttribute('rel', 'apple-touch-icon')
        appleIconEl.setAttribute('sizes', '180x180')
        appleIconEl.setAttribute('href', `${BASE_URL}/content/assets/img/icons/apple-touch-icon.png`)
        document.head.appendChild(appleIconEl)
      }
    } catch (e) {
      // Safe logging in catch block
      log.warn('PWA meta injection failed:', e)
    }
  } catch (e) {
    log.warn('lightweight head update failed:', e)
  }

  // --- 3. SCHEMA GRAPH GENERATION ---
  const generateSchema = () => {
    // Use canonical origin (prod or runtime origin) so JSON-LD stays consistent in local/dev
    const canonicalOrigin = (document.documentElement.getAttribute('data-force-prod-canonical') === 'true') ||
      ['abdulkerimsesli.de', 'www.abdulkerimsesli.de'].includes(window.location.hostname.toLowerCase())
      ? BASE_URL
      : window.location.origin

    const ID = {
      person: `${canonicalOrigin}/#person`,
      org: `${canonicalOrigin}/#organization`,
      website: `${canonicalOrigin}/#website`,
      webpage: `${pageUrl}#webpage`,
      breadcrumb: `${pageUrl}#breadcrumb`
    }

    const graph = []

    // 1. ORGANIZATION (ProfessionalService for Local SEO)
    graph.push({
      '@type': 'ProfessionalService',
      '@id': ID.org,
      'name': BRAND_DATA.legalName,
      'url': BASE_URL,
      'logo': {
        '@type': 'ImageObject',
        'url': BRAND_DATA.logo,
        'width': 512,
        'height': 512
      },
      'image': {
        '@type': 'ImageObject',
        'url': pageData && pageData.image ? pageData.image : BRAND_DATA.logo,
        'width': 1200,
        'height': 630
      },
      'email': BRAND_DATA.email,
      'sameAs': BRAND_DATA.sameAs,
      'address': BRAND_DATA.address || {
        '@type': 'PostalAddress',
        'addressLocality': 'Berlin',
        'addressCountry': 'DE'
      },
      'geo': BRAND_DATA.geo
    })

    // 2. PERSON (Die Haupt-Entität)
    graph.push({
      '@type': ['Person', 'Photographer'],
      '@id': ID.person,
      'name': BRAND_DATA.name,
      'alternateName': BRAND_DATA.alternateName,
      'jobTitle': BRAND_DATA.jobTitle,
      'worksFor': {'@id': ID.org},
      'url': BASE_URL,
      'image': {
        '@type': 'ImageObject',
        '@id': `${BASE_URL}/#personImage`,
        'url': 'https://commons.wikimedia.org/wiki/File:Abdulkerim_Sesli_portrait_2025.png',
        'caption': BRAND_DATA.name
      },
      'description': pageData.description,
      // Identity Disambiguation
      'disambiguatingDescription': 'Webentwickler (React, Three.js) und Fotograf aus Berlin, nicht zu verwechseln mit \'Sesli Kitap\' oder Hörbuch-Verlagen.',
      'sameAs': BRAND_DATA.sameAs,
      'homeLocation': {
        '@type': 'Place',
        'name': 'Berlin',
        'address': BRAND_DATA.address,
        'geo': BRAND_DATA.geo
      },
      'knowsAbout': [
        {'@type': 'Thing', 'name': 'Web Development', 'sameAs': 'https://www.wikidata.org/wiki/Q386275'},
        {'@type': 'Thing', 'name': 'React', 'sameAs': 'https://www.wikidata.org/wiki/Q19399674'},
        {'@type': 'Thing', 'name': 'Three.js', 'sameAs': 'https://www.wikidata.org/wiki/Q28135934'},
        {'@type': 'Thing', 'name': 'JavaScript', 'sameAs': 'https://www.wikidata.org/wiki/Q28865'},
        {'@type': 'Thing', 'name': 'Photography', 'sameAs': 'https://www.wikidata.org/wiki/Q11633'},
        {'@type': 'Thing', 'name': 'Urban Photography'},
        {'@type': 'Place', 'name': 'Berlin', 'sameAs': 'https://www.wikidata.org/wiki/Q64'}
      ]
    })

    // 2.1 SPECIAL: FEATURE SNIPPET OPTIMIZATION (Skills as ItemList)
    // Helps Google display "Skills: React, Three.js..." in snippets
    if (pageUrl.includes('/about') || pageUrl === BASE_URL || pageUrl === `${BASE_URL}/`) {
      graph.push({
        '@type': 'ItemList',
        '@id': `${BASE_URL}/#skills`,
        'name': 'Technische Skills & Kompetenzen',
        'description': 'Kernkompetenzen in der Fullstack-Webentwicklung und Fotografie',
        'itemListElement': [
          {'@type': 'ListItem', 'position': 1, 'name': 'React & Next.js Ecosystem'},
          {'@type': 'ListItem', 'position': 2, 'name': 'Three.js & WebGL 3D-Visualisierung'},
          {'@type': 'ListItem', 'position': 3, 'name': 'Node.js & Backend Architecture'},
          {'@type': 'ListItem', 'position': 4, 'name': 'UI/UX Design & Animation'},
          {'@type': 'ListItem', 'position': 5, 'name': 'Urban & Portrait Photography'}
        ]
      })
    }

    // 2.2 AI CONTEXT EXTRACTION (Raw Text Transformation)
    // Transforms raw page content into a clean, machine-readable format for LLMs
    const extractPageContent = () => {
      try {
        const contentNode = document.querySelector('main') || document.querySelector('article') || document.body
        if (!contentNode) return ''

        // Clone to avoid modifying the live DOM
        const clone = contentNode.cloneNode(true)

        // Remove noise
        const noiseSelectors = [
          'nav',
          'footer',
          'script',
          'style',
          'noscript',
          'iframe',
          '.cookie-banner',
          '.no-ai',
          '[aria-hidden="true"]'
        ]
        noiseSelectors.forEach(sel => clone.querySelectorAll(sel).forEach(el => el.remove()))

        // Extract and clean text
        let text = clone.innerText || clone.textContent || ''
        text = text.replace(/\s+/g, ' ').trim()

        // Limit length to prevent JSON bloat (max 5000 chars is plenty for context)
        return text.length > 5000 ? text.substring(0, 5000) + '...' : text
      } catch {
        return ''
      }
    }
    const aiReadyText = extractPageContent()

    // 3. WEBPAGE (Die Seite selbst)
    graph.push({
      '@type': pageData.type || 'WebPage',
      '@id': ID.webpage,
      'url': pageUrl,
      'name': pageData.title,
      'description': pageData.description,
      'text': aiReadyText, // Direct injection for AI Context
      'isPartOf': {'@id': ID.website},
      'mainEntity': {'@id': ID.person},
      'publisher': {'@id': ID.org},
      'inLanguage': 'de-DE',
      'dateModified': new Date().toISOString()
    })

    // 4. WEBSITE
    graph.push({
      '@type': 'WebSite',
      '@id': ID.website,
      'url': BASE_URL,
      'name': 'Abdulkerim Sesli Portfolio',
      'publisher': {'@id': ID.org},
      'potentialAction': {
        '@type': 'SearchAction',
        'target': `${BASE_URL}/?s={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    })

    // 5. FAQ (STRICT MODE & WHITESPACE CLEANING)
    // Filtert "schmutzige" Strings und setzt stabile IDs, um "Unbenanntes Element" zu verhindern.
    const faqNodes = Array.from(document.querySelectorAll('.faq-item'))
      .map((el, i) => {
        const rawQ = el.querySelector('.question, h3, summary')?.textContent
        const rawA = el.querySelector('.answer, p, div')?.textContent
        const q = rawQ ? String(rawQ).replace(/\s+/g, ' ').trim() : ''
        const a = rawA ? String(rawA).replace(/\s+/g, ' ').trim() : ''
        if (!q || q.length < 2) return null
        return {
          '@type': 'Question',
          '@id': `${pageUrl}#faq-q${i + 1}`,
          'name': q,
          'acceptedAnswer': {'@type': 'Answer', 'text': a || 'Details ansehen'}
        }
      })
      .filter(Boolean)

    let faqEntities = faqNodes
    if (faqEntities.length === 0) {
      const isHomepage = window.location.pathname === '/' || window.location.pathname === ''
      const hasBusinessFaqFlag = !!document.querySelector('[data-inject-business-faq]')
      if (isHomepage || hasBusinessFaqFlag) {
        const fallbackFaqNodes = BUSINESS_FAQS.map((item, i) => ({
          '@type': 'Question',
          '@id': `${pageUrl}#faq-q${i + 1}`,
          'name': String(item.q).replace(/\s+/g, ' ').trim(),
          'acceptedAnswer': {'@type': 'Answer', 'text': String(item.a).replace(/\s+/g, ' ').trim()}
        }))
        faqEntities = fallbackFaqNodes
      }
    }

    if (faqEntities.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        'name': pageData && pageData.title ? `${pageData.title} — FAQ` : 'Häufig gestellte Fragen',
        'mainEntity': faqEntities,
        'isPartOf': {'@id': ID.webpage}
      })
    }

    // 6. BREADCRUMBS
    const segments = window.location.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    const crumbs = [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': {'@id': BASE_URL, 'name': 'Home'}
      }
    ]
    let pathAcc = canonicalOrigin
    segments.forEach((seg, i) => {
      pathAcc += `/${seg}`
      const name = seg.charAt(0).toUpperCase() + seg.slice(1)
      crumbs.push({
        '@type': 'ListItem',
        'position': i + 2,
        'name': name,
        'item': {'@id': pathAcc, 'name': name}
      })
    })
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': ID.breadcrumb,
      'name': (pageData && pageData.title) || document.title || 'Navigationspfad',
      'itemListElement': crumbs
    })

    // INJECTION
    const ldId = 'head-complete-ldjson'
    let script = document.getElementById(ldId)
    const payload = JSON.stringify({'@context': 'https://schema.org', '@graph': graph})
    if (script) {
      script.textContent = payload
    } else {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.id = ldId
      script.textContent = payload
      document.head.appendChild(script)
    }
  }

  // Trigger schema generation
  const scheduleSchema = () => {
    if ('requestIdleCallback' in window) {
      try {
        requestIdleCallback(generateSchema, {timeout: 1500})
      } catch {
        setTimeout(generateSchema, 1200)
      }
    } else {
      setTimeout(generateSchema, 1200)
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleSchema)
  else scheduleSchema()

  // UI Helper
  const hideLoader = () => {
    const el = document.getElementById('loadingScreen')
    if (el) {
      el.classList.add('hide')
      setTimeout(() => (el.style.display = 'none'), 700)
    }
  }
  window.addEventListener('load', hideLoader)
  setTimeout(hideLoader, 2000)
  window.SHARED_HEAD_LOADED = true
})()
