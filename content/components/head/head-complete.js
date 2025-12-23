/**
 * Dynamic Head Loader - Ultimate Modern SEO & Schema Graph (@graph approach)
 * Version: 2025.1.0
 * * Features:
 * - Centralized Knowledge Graph (verbindet Person, Skills, Site, Page)
 * - Deep Entity Linking via Wikidata (für Knowledge Panel Trigger)
 * - Auto-Detection von Breadcrumbs & Routen
 * - Bereinigt automatisch alte/statische JSON-LD Tags
 */

;(async function loadSharedHead() {
  if (window.SHARED_HEAD_LOADED) return

  // --- 1. GLOBALE DATEN & KONFIGURATION ---
  const BASE_URL = 'https://abdulkerimsesli.de' // Hardcoded für Konsistenz

  // Zentrale Definition der Person/Marke für Wiederverwendung
  const ENTITY_DATA = {
    name: 'Abdulkerim Sesli',
    jobTitle: 'Fotograf & Webentwickler',
    location: 'Berlin, DE',
    description: 'Fotograf und Webentwickler aus Berlin (13507). Spezialisiert auf Urban Photography sowie moderne Webtechnologien (JavaScript, React, Three.js).',
    sameAs: [
      'https://github.com/aKs030',
      'https://linkedin.com/in/abdulkerimsesli',
      'https://twitter.com/abdulkerimsesli',
      'https://www.instagram.com/abdulkerimsesli',
      'https://www.youtube.com/@aks.030',
      'https://de.wikipedia.org/wiki/Abdulkerim_Sesli',
      'https://www.wikidata.org/wiki/Q137477910', // Deine Wikidata ID
      'https://www.wikidata.org/wiki/User:Abdulkerim_sesli'
    ],
    // High-Level Skills mit Wikidata-Verknüpfung für Google Knowledge Graph
    knowsAbout: [
      { '@type': 'Thing', 'name': 'Web Development', 'sameAs': 'https://www.wikidata.org/wiki/Q386275' },
      { '@type': 'Thing', 'name': 'Photography', 'sameAs': 'https://www.wikidata.org/wiki/Q11633' },
      { '@type': 'Thing', 'name': 'React', 'sameAs': 'https://www.wikidata.org/wiki/Q19399674' },
      { '@type': 'Thing', 'name': 'Three.js', 'sameAs': 'https://www.wikidata.org/wiki/Q288402' },
      { '@type': 'Place', 'name': 'Berlin', 'sameAs': 'https://www.wikidata.org/wiki/Q64' }
    ]
  }

  const ROUTES = {
    default: {
      title: 'Abdulkerim — Fotograf & Webentwickler | Berlin',
      description: 'Privates Portfolio von Abdulkerim Sesli aus Berlin. Fotografie, Webentwicklung (React, Three.js) und kreative Projekte.',
      type: 'ProfilePage', // Modern: Die Homepage eines Portfolios ist oft eine ProfilePage
      image: `${BASE_URL}/content/assets/img/og/og-home.png`
    },
    '/projekte/': {
      title: 'Projekte & Code | Abdulkerim Sesli',
      description: 'Web-Projekte, Experimente mit React & Three.js sowie Open-Source-Beiträge.',
      type: 'CollectionPage',
      image: `${BASE_URL}/content/assets/img/og/og-projects.png`
    },
    '/blog/': {
      title: 'Blog & Insights | Abdulkerim Sesli',
      description: 'Artikel über moderne Webentwicklung, JavaScript-Tricks und Tech-Insights.',
      type: 'Blog',
      image: `${BASE_URL}/content/assets/img/og/og-blog.png`
    },
    '/gallery/': {
      title: 'Fotografie Portfolio | Abdulkerim Berlin',
      description: 'Urban Photography, Street & Landscape aus Berlin und Umgebung.',
      type: 'ImageGallery',
      image: `${BASE_URL}/content/assets/img/og/og-gallery.png`
    },
    '/about/': {
      title: 'Über Mich | Abdulkerim Sesli',
      description: 'Lebenslauf, Tech-Stack und Kontakt.',
      type: 'AboutPage',
      image: `${BASE_URL}/content/assets/img/og/og-about.png`
    }
  }

  // Pfad-Logik
  const currentPath = window.location.pathname.toLowerCase()
  const matchedKey = Object.keys(ROUTES).find(key => key !== 'default' && currentPath.includes(key))
  const pageData = matchedKey ? ROUTES[matchedKey] : ROUTES.default
  const pageUrl = window.location.href.split('#')[0]

  // --- 2. TEMPLATE INJECTION (HTML HEAD) ---
  try {
    const escapeHTML = str => String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m])

    // Fetch Template
    const resp = await fetch('/content/components/head/head.html', {cache: 'force-cache'})
    if (!resp.ok) throw new Error(`Head fetch error: ${resp.status}`)
    let html = await resp.text()

    // Platzhalter ersetzen
    html = html.replace(/\{\{PAGE_TITLE\}\}/g, escapeHTML(pageData.title))
    html = html.replace(/\{\{PAGE_DESCRIPTION\}\}/g, escapeHTML(pageData.description))

    // DOM Injection & Cleanup
    const range = document.createRange()
    const fragment = range.createContextualFragment(html)

    // Entferne existierende Duplikate im Head
    const uniqueSelectors = ['title', 'meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]']
    uniqueSelectors.forEach(sel => { const el = document.querySelector(sel); if(el) el.remove() })

    document.head.prepend(fragment)

    // Canonical & OG:URL setzen
    let canonical = document.querySelector('link[rel="canonical"]') || document.createElement('link')
    if (!canonical.parentNode) { canonical.rel = 'canonical'; document.head.appendChild(canonical) }
    canonical.href = pageUrl

    const ogUrl = document.querySelector('meta[property="og:url"]')
    if (ogUrl) ogUrl.content = pageUrl

  } catch (e) {
    console.warn('[Head-Loader] Template Warning:', e)
  }

  // --- 3. MODERN SCHEMA.ORG (@Graph) ---
  const generateSchema = () => {
    const ID = {
      person: `${BASE_URL}/#person`,
      website: `${BASE_URL}/#website`,
      webpage: `${pageUrl}#webpage`,
      breadcrumb: `${pageUrl}#breadcrumb`
    }

    const graph = []

    // A. PERSON (Die zentrale Entität)
    const personNode = {
      '@type': ['Person', 'Photographer'],
      '@id': ID.person,
      'name': ENTITY_DATA.name,
      'alternateName': ['AKS', 'Abdulkerim Berlin', 'Abdul Berlin'],
      'url': BASE_URL,
      'image': {
        '@type': 'ImageObject',
        '@id': `${BASE_URL}/#personImage`,
        'url': 'https://commons.wikimedia.org/wiki/File:Abdulkerim_Sesli_portrait_2025.png',
        'contentUrl': 'https://commons.wikimedia.org/wiki/File:Abdulkerim_Sesli_portrait_2025.png',
        'caption': ENTITY_DATA.name
      },
      'description': ENTITY_DATA.description,
      'jobTitle': ENTITY_DATA.jobTitle,
      'sameAs': ENTITY_DATA.sameAs,
      'knowsAbout': ENTITY_DATA.knowsAbout, // Wichtig für Knowledge Graph
      'address': {
        '@type': 'PostalAddress',
        'addressLocality': 'Berlin',
        'postalCode': '13507',
        'addressCountry': 'DE'
      },
      'email': 'mailto:kontakt@abdulkerimsesli.de'
    }
    graph.push(personNode)

    // B. WEBSITE
    graph.push({
      '@type': 'WebSite',
      '@id': ID.website,
      'url': BASE_URL,
      'name': 'Abdulkerim Portfolio',
      'publisher': { '@id': ID.person },
      'inLanguage': 'de-DE',
      'potentialAction': {
        '@type': 'SearchAction',
        'target': { '@type': 'EntryPoint', 'urlTemplate': `${BASE_URL}/?s={search_term_string}` },
        'query-input': 'required name=search_term_string'
      }
    })

    // C. WEBPAGE (Context-Aware)
    graph.push({
      '@type': pageData.type || 'WebPage',
      '@id': ID.webpage,
      'url': pageUrl,
      'name': pageData.title,
      'description': pageData.description,
      'isPartOf': { '@id': ID.website },
      'about': { '@id': ID.person }, // Diese Seite handelt von der Person
      'primaryImageOfPage': { '@id': ID.person }, // Fallback aufs Profilbild
      'breadcrumb': { '@id': ID.breadcrumb },
      'inLanguage': 'de-DE',
      'datePublished': '2024-01-01T08:00:00+01:00',
      'dateModified': new Date().toISOString()
    })

    // D. BREADCRUMBS
    const segments = window.location.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    const crumbs = [{ '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL }]

    let pathAcc = BASE_URL
    segments.forEach((seg, i) => {
      pathAcc += `/${seg}`
      crumbs.push({
        '@type': 'ListItem',
        'position': i + 2,
        'name': seg.charAt(0).toUpperCase() + seg.slice(1),
        'item': pathAcc
      })
    })

    graph.push({
      '@type': 'BreadcrumbList',
      '@id': ID.breadcrumb,
      'itemListElement': crumbs
    })

    // E. FAQ (Auto-Scraper für Rich Snippets)
    // Findet <details> oder .faq-item Elemente und macht sie zu strukturierten Daten
    const faqNodes = Array.from(document.querySelectorAll('details, .faq-item')).map(el => {
      const q = el.querySelector('summary, h3, .question')?.textContent?.trim()
      const a = el.querySelector('p, div, .answer')?.textContent?.trim()
      return (q && a) ? { '@type': 'Question', 'name': q, 'acceptedAnswer': { '@type': 'Answer', 'text': a } } : null
    }).filter(Boolean)

    if (faqNodes.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        'mainEntity': faqNodes,
        'isPartOf': { '@id': ID.webpage }
      })
    }

    // --- INJECTION ---
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })

    // Alte JSON-LDs entfernen und neues einfügen
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => s.remove())
    document.head.appendChild(script)
  }

  // Trigger
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', generateSchema)
  else generateSchema()

  // --- 4. UI HELPER (Loading Screen) ---
  const hideLoader = () => {
    const el = document.getElementById('loadingScreen')
    if (el) {
      el.classList.add('hide')
      setTimeout(() => el.style.display = 'none', 700)
    }
  }
  window.addEventListener('load', hideLoader)
  setTimeout(hideLoader, 2000)

  window.SHARED_HEAD_LOADED = true
})()
