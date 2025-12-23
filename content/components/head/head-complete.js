/**
 * Dynamic Head Loader - Ultimate Modern SEO & Schema Graph (@graph approach)
 * Version: 2025.3.0 (Rich Snippet "Visual Maximizer" Edition)
 * * Features:
 * - [GELB] Icon Fix: Re-Integration von 'Organization' für Logo-Support
 * - [ROT] Snippet Fill: Maximierte Descriptions & Knowledge-Injection
 * - [BLAU] FAQ Booster: Statische Business-FAQs für garantierten Rich-Snippet-Bereich
 */

;(async function loadSharedHead() {
  if (window.SHARED_HEAD_LOADED) return

  // --- 1. GLOBALE DATEN & KONFIGURATION ---
  const BASE_URL = 'https://abdulkerimsesli.de'

  // A. VISUELLE STEUERUNG (Icons & Business Data)
  const BRAND_DATA = {
    name: 'Abdulkerim Sesli',
    legalName: 'Abdulkerim Sesli — Creative Digital Services',
    logo: `${BASE_URL}/content/assets/img/icons/icon-512.png`, // [GELB] Das Icon für Google
    jobTitle: 'Fotograf & Fullstack Webentwickler',
    email: 'kontakt@abdulkerimsesli.de',
    areaServed: 'Berlin, Deutschland',
    sameAs: [
      'https://github.com/aKs030',
      'https://linkedin.com/in/abdulkerimsesli',
      'https://twitter.com/abdulkerimsesli',
      'https://www.instagram.com/abdulkerimsesli',
      'https://www.youtube.com/@aks.030',
      'https://de.wikipedia.org/wiki/Abdulkerim_Sesli',
      'https://www.wikidata.org/wiki/Q137477910'
    ]
  }

  // B. INHALTS-STEUERUNG (Snippet Text Füllung)
  // [ROT] Hier füllen wir den Text-Bereich maximal auf (~160 Zeichen + Keywords)
  const ROUTES = {
    'default': {
      title: 'Abdulkerim Sesli | Digitale Visitenkarte & Portfolio Berlin',
      description:
        'Offizielles Portfolio von Abdulkerim Sesli. Professionelle Webentwicklung (React, Three.js) und Urban Photography aus Berlin. Jetzt Referenzen ansehen & kontaktieren.',
      type: 'ProfilePage',
      image: `${BASE_URL}/content/assets/img/og/og-home.png`
    },
    '/projekte/': {
      title: 'Referenzen & Code-Projekte | Abdulkerim Sesli',
      description:
        'Entdecke interaktive Web-Experimente und Business-Anwendungen. Spezialisiert auf performante React-Lösungen, 3D-Web (Three.js) und modernes UI/UX Design.',
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

  // C. FAQ GENERATOR (Der "Blaue Bereich")
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

  // --- 2. HTML HEAD INJECTION ---
  try {
    const escapeHTML = str =>
      String(str).replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[m])

    let html = `
<!--
  Modern Head Template
  - Static Meta Tags only
  - No bloated inline JSON-LD (handled by head-complete.js)
  - Security & Performance headers optimized
-->

<!-- Base -->
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

<!-- Google Gtag (Base Loader) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-1036079663"></script>
<script src="/content/components/head/head-inline.js" defer></script>

<!-- Dynamic Content Placeholders (Filled by head-complete.js) -->
<title>{{PAGE_TITLE}}</title>
<meta name="description" content="{{PAGE_DESCRIPTION}}" />

<!-- Core SEO -->
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="language" content="de-DE" />
<meta name="author" content="Abdulkerim Sesli" />
<meta name="google-site-verification" content="oJc1G_If9jFjJK_dse2vt7ayvVYSDBNLPWTpyxiYcBs" />
<link rel="canonical" href="https://abdulkerimsesli.de/" />

<!-- Geo / Local SEO -->
<meta name="geo.region" content="DE-BE" />
<meta name="geo.placename" content="Berlin" />
<meta name="geo.position" content="52.5200;13.4050" />
<meta name="ICBM" content="52.5200, 13.4050" />

<!-- Social Media / Open Graph Base -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Abdulkerim — Fotograf & Webentwickler" />
<meta property="og:locale" content="de_DE" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:creator" content="@abdulkerimsesli" />

<!-- Icons -->
<link rel="icon" href="/content/assets/img/icons/favicon.svg" type="image/svg+xml" />
<link rel="icon" type="image/png" sizes="192x192" href="/content/assets/img/icons/icon-192.png" />
<link rel="apple-touch-icon" href="/content/assets/img/icons/icon-192.png" />
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#2c2c2e" media="(prefers-color-scheme: dark)" />

<!-- CSS Resources -->
<link rel="stylesheet" href="/content/styles/root.css" />
<link rel="stylesheet" href="/content/components/menu/menu.css" />
<link rel="stylesheet" href="/content/components/footer/footer.css" />

<!-- Font Loading Strategy (No Preload to avoid warnings, Font-Display Swap in CSS) -->
<style>
  @font-face {
    font-family: 'Inter';
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url('/content/assets/fonts/InterVariable.woff2') format('woff2-variations');
  }
  body {
    font-family: 'Inter', sans-serif;
  }
</style>

<!-- Scripts -->
<script type="module" src="/content/main.js"></script>

<!-- Note: Structured Data (Schema.org) is generated dynamically by head-complete.js -->

`

    html = html.replace(/\{\{PAGE_TITLE\}\}/g, escapeHTML(pageData.title))
    html = html.replace(/\{\{PAGE_DESCRIPTION\}\}/g, escapeHTML(pageData.description))

    const range = document.createRange()
    const fragment = range.createContextualFragment(html)

    const uniqueSelectors = ['title', 'meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]']
    uniqueSelectors.forEach(sel => {
      const el = document.querySelector(sel)
      if (el) el.remove()
    })

    document.head.prepend(fragment)

    const canonical = document.querySelector('link[rel="canonical"]') || document.createElement('link')
    if (!canonical.parentNode) {
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = pageUrl

    // [GELB] Sicherstellen, dass Favicon für Browser-Tabs da ist (Google nutzt dies auch als Fallback)
    const existingIcon = document.querySelector('link[rel="icon"]')
    if (!existingIcon) {
      const iconLink = document.createElement('link')
      iconLink.rel = 'icon'
      iconLink.href = BRAND_DATA.logo
      document.head.appendChild(iconLink)
    }
  } catch (e) {
    console.warn('[Head-Loader] Template Warning:', e)
  }

  // --- 3. SCHEMA GRAPH GENERATION ---
  const generateSchema = () => {
    const ID = {
      person: `${BASE_URL}/#person`,
      org: `${BASE_URL}/#organization`,
      website: `${BASE_URL}/#website`,
      webpage: `${pageUrl}#webpage`,
      breadcrumb: `${pageUrl}#breadcrumb`
    }

    const graph = []

    // 1. ORGANIZATION (Für das Logo [GELB])
    // Wir definieren eine "Ein-Mann-Organisation", um das Logo-Feld valide nutzen zu können
    graph.push({
      '@type': 'Organization',
      '@id': ID.org,
      'name': BRAND_DATA.legalName,
      'url': BASE_URL,
      'logo': {
        '@type': 'ImageObject',
        'url': BRAND_DATA.logo,
        'width': 512,
        'height': 512
      },
      'email': BRAND_DATA.email,
      'sameAs': BRAND_DATA.sameAs
    })

    // 2. PERSON (Die Haupt-Entität)
    graph.push({
      '@type': ['Person', 'Photographer'],
      '@id': ID.person,
      'name': BRAND_DATA.name,
      'jobTitle': BRAND_DATA.jobTitle,
      'worksFor': {'@id': ID.org}, // Verknüpfung zur Org
      'url': BASE_URL,
      'image': {
        '@type': 'ImageObject',
        '@id': `${BASE_URL}/#personImage`,
        'url': 'https://commons.wikimedia.org/wiki/File:Abdulkerim_Sesli_portrait_2025.png',
        'caption': BRAND_DATA.name
      },
      'description': pageData.description, // [ROT] Nutzt die optimierte Beschreibung
      'sameAs': BRAND_DATA.sameAs,
      'knowsAbout': [
        {'@type': 'Thing', 'name': 'Web Development', 'sameAs': 'https://www.wikidata.org/wiki/Q386275'},
        {'@type': 'Thing', 'name': 'Photography', 'sameAs': 'https://www.wikidata.org/wiki/Q11633'},
        {'@type': 'Place', 'name': 'Berlin', 'sameAs': 'https://www.wikidata.org/wiki/Q64'}
      ]
    })

    // 3. WEBPAGE (Die Seite selbst)
    graph.push({
      '@type': pageData.type || 'WebPage',
      '@id': ID.webpage,
      'url': pageUrl,
      'name': pageData.title,
      'description': pageData.description,
      'isPartOf': {'@id': ID.website},
      'mainEntity': {'@id': ID.person}, // Profil-Fokus
      'publisher': {'@id': ID.org}, // Org-Publisher für Logo-Vererbung
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

    // 5. FAQ (Der "Blaue Bereich" [BLAU])
    // Zuerst prüfen wir, ob echte FAQs auf der Seite sind
    let faqNodes = Array.from(document.querySelectorAll('details, .faq-item'))
      .map(el => {
        const q = el.querySelector('summary, h3, .question')?.textContent?.trim()
        const a = el.querySelector('p, div, .answer')?.textContent?.trim()
        return q && a ? {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} : null
      })
      .filter(Boolean)

    // Fallback: Wenn keine echten FAQs da sind, injizieren wir die Business-Visitenkarte
    if (faqNodes.length === 0) {
      faqNodes = BUSINESS_FAQS.map(item => ({
        '@type': 'Question',
        'name': item.q,
        'acceptedAnswer': {'@type': 'Answer', 'text': item.a}
      }))
    }

    if (faqNodes.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        'mainEntity': faqNodes,
        'isPartOf': {'@id': ID.webpage}
      })
    }

    // 6. BREADCRUMBS
    const segments = window.location.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    const crumbs = [{'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL}]
    let pathAcc = BASE_URL
    segments.forEach((seg, i) => {
      pathAcc += `/${seg}`
      crumbs.push({'@type': 'ListItem', 'position': i + 2, 'name': seg.charAt(0).toUpperCase() + seg.slice(1), 'item': pathAcc})
    })
    graph.push({'@type': 'BreadcrumbList', '@id': ID.breadcrumb, 'itemListElement': crumbs})

    // INJECTION
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify({'@context': 'https://schema.org', '@graph': graph})
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => s.remove())
    document.head.appendChild(script)
  }

  // Trigger
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', generateSchema)
  else generateSchema()

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
