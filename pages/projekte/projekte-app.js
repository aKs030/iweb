import {createLogger} from '../../content/utils/shared-utilities.js'

const log = createLogger('projekte-app')

/* global React, ReactDOM */
/**
 * Interactive Projects Module
 * Refactored to use 'htm' for cleaner, JSX-like syntax without a build step.
 * @version 2.0.0
 */

// Use jsDelivr CDN (allowed by CSP in content/head/head.html) instead of unpkg
import htm from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.module.js'

// Bind htm to React's createElement function
const html = htm.bind(React.createElement)

// --- Components ---

// Base Icon Component
const IconBase = ({children, className, style, ...props}) => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    className=${className}
    style=${style}
    ...${props}>
    ${children}
  </svg>
`

// Icons
const ExternalLink = props => html`
  <${IconBase} ...${props}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  <//>
`

const Github = props => html`
  <${IconBase} ...${props}>
    <path
      d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  <//>
`

const ArrowDown = props => html`
  <${IconBase} ...${props}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  <//>
`

const MousePointerClick = props => html`
  <${IconBase} ...${props}>
    <path d="M14 4.1 12 6" />
    <path d="m5.1 8-2.9-.8" />
    <path d="m6 12-1.9 2" />
    <path d="M7.2 2.2 8 5.1" />
    <path
      d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" />
  <//>
`

const Palette = props => html`
  <${IconBase} ...${props}>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path
      d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  <//>
`

const Binary = props => html`
  <${IconBase} ...${props}>
    <rect x="14" y="14" width="4" height="6" rx="2" />
    <rect x="6" y="4" width="4" height="6" rx="2" />
    <path d="M6 20h4" />
    <path d="M14 10h4" />
    <path d="M6 14h2v6" />
    <path d="M14 4h2v6" />
  <//>
`

const Gamepad2 = props => html`
  <${IconBase} ...${props}>
    <line x1="6" x2="10" y1="11" y2="11" />
    <line x1="8" x2="8" y1="9" y2="13" />
    <line x1="15" x2="15.01" y1="12" y2="12" />
    <line x1="18" x2="18.01" y1="10" y2="10" />
    <path d="M17.3 2.9A2 2 0 0 0 15 2H9a2 2 0 0 0-2.3.9C3.8 5.7 3 9.4 4.2 13c1 3 3.6 5 6.8 5h2c3.2 0 5.8-2 6.8-5 1.2-3.6.4-7.3-2.5-10.1Z" />
  <//>
`

const ListTodo = props => html`
  <${IconBase} ...${props}>
    <rect x="3" y="5" width="6" height="6" rx="1" />
    <path d="m3 17 2 2 4-4" />
    <path d="M13 6h8" />
    <path d="M13 12h8" />
    <path d="M13 18h8" />
  <//>
`

const Check = props => html`
  <${IconBase} ...${props}>
    <path d="M20 6 9 17l-5-5" />
  <//>
`

// --- DATA ---
const projects = [
  {
    id: 1,
    title: 'Schere Stein Papier',
    description: 'Der Klassiker gegen den Computer!',
    tags: ['JavaScript', 'Game Logic'],
    category: 'Game',
    datePublished: '2023-07-05',
    image: 'https://abdulkerimsesli.de/content/assets/img/og/og-projekte.png',
    appPath: '/projekte/apps/schere-stein-papier/',
    githubPath: 'https://github.com/aKs030/Webgame.git',
    bgStyle: {
      background: 'linear-gradient(to bottom right, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))'
    },
    glowColor: '#a855f7',
    icon: html`
      <${Gamepad2} style=${{color: '#c084fc', width: '32px', height: '32px'}} />
    `,
    previewContent: html`
      <div
        style=${{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          width: '100%',
          height: '100%',
          position: 'relative',
          zIndex: 10
        }}>
        <div style=${{fontSize: '3rem'}}>🪨</div>
        <div style=${{fontSize: '1.5rem', opacity: 0.5}}>VS</div>
        <div style=${{fontSize: '3rem'}}>✂️</div>
      </div>
    `
  },
  {
    id: 2,
    title: 'Zahlen Raten',
    description: 'Finde die geheime Zahl zwischen 1 und 100.',
    tags: ['Logic', 'Input'],
    category: 'Puzzle',
    datePublished: '2024-08-01',
    image: 'https://abdulkerimsesli.de/content/assets/img/og/og-projekte.png',
    appPath: '/projekte/apps/zahlen-raten/',
    githubPath: 'https://github.com/aKs030/Webgame.git',
    bgStyle: {
      background: 'linear-gradient(to bottom right, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2))'
    },
    glowColor: '#10b981',
    icon: html`
      <${Binary} style=${{color: '#34d399', width: '32px', height: '32px'}} />
    `,
    previewContent: html`
      <div
        style=${{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }}>
        <span style=${{fontSize: '4rem', color: '#6ee7b7', fontWeight: 'bold'}}>?</span>
      </div>
    `
  },
  {
    id: 3,
    title: 'Color Changer',
    description: 'Dynamische Hintergrundfarben per Klick.',
    tags: ['DOM', 'Events'],
    category: 'UI',
    datePublished: '2022-03-15',
    image: 'https://abdulkerimsesli.de/content/assets/img/og/og-projekte.png',
    appPath: '/projekte/apps/color-changer/',
    githubPath: 'https://github.com/aKs030/Webgame.git',
    bgStyle: {
      background: 'linear-gradient(to bottom right, rgba(249, 115, 22, 0.2), rgba(236, 72, 153, 0.2))'
    },
    glowColor: '#ec4899',
    icon: html`
      <${Palette} style=${{color: '#f472b6', width: '32px', height: '32px'}} />
    `,
    previewContent: html`
      <div
        style=${{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }}>
        <${Palette} style=${{width: '4rem', height: '4rem', color: '#f472b6'}} />
      </div>
    `
  },
  {
    id: 4,
    title: 'To-Do Liste',
    description: 'Produktivitäts-Tool zum Verwalten von Aufgaben.',
    tags: ['CRUD', 'Arrays'],
    category: 'App',
    datePublished: '2021-11-05',
    image: 'https://abdulkerimsesli.de/content/assets/img/og/og-projekte.png',
    appPath: '/projekte/apps/todo-liste/',
    githubPath: 'https://github.com/aKs030/Webgame.git',
    bgStyle: {
      background: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(6, 182, 212, 0.2))'
    },
    glowColor: '#06b6d4',
    icon: html`
      <${ListTodo} style=${{color: '#22d3ee', width: '32px', height: '32px'}} />
    `,
    previewContent: html`
      <div
        style=${{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }}>
        <${Check} style=${{width: '4rem', height: '4rem', color: '#22d3ee'}} />
      </div>
    `
  }
]

// --- APP ---
function App() {
  const scrollToProjects = () => {
    const firstProject = document.getElementById('project-1')
    if (firstProject) firstProject.scrollIntoView({behavior: 'smooth'})
  }

  // Inject CreativeWork JSON-LD for each project (deduplicated)
  React.useEffect(() => {
    try {
      const siteBase = window.location.origin.replace(/\/$/, '')
      projects.forEach(p => {
        const key = `project-${p.id}`
        if (document.querySelector(`script[data-ld="${key}"]`)) return
        const obj = {
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          'name': p.title,
          'description': p.description,
          'url': siteBase + (p.appPath ? p.appPath : '/projekte/#' + key),
          'author': {'@type': 'Person', 'name': 'Abdulkerim Sesli'},
          'keywords': Array.isArray(p.tags) ? p.tags.join(', ') : p.tags || '',
          'about': p.category,
          'datePublished': p.datePublished,
          'image': p.image
        }
        const s = document.createElement('script')
        s.type = 'application/ld+json'
        s.setAttribute('data-ld', key)
        s.textContent = JSON.stringify(obj)
        document.head.appendChild(s)
      })
    } catch {
      /* ignore in environments where DOM is not available */
    }
  }, [])

  // Modal state for in-page app preview (iframe via srcdoc from raw GitHub)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [modalLoading, setModalLoading] = React.useState(false)
  const [modalError, setModalError] = React.useState('')
  const [modalTitle, setModalTitle] = React.useState('')
  const [modalProject, setModalProject] = React.useState(null)
  const [iframeSrcDoc, setIframeSrcDoc] = React.useState('')

  const RAW_BASE = 'https://raw.githubusercontent.com/aKs030/Webgame/main'

  const openApp = async proj => {
    setModalTitle(proj.title)
    setModalProject(proj)
    setModalError('')
    setModalLoading(true)
    setIframeSrcDoc('')
    setModalOpen(true)

    try {
      const appPathClean = proj.appPath.replace(/\/$/, '')

      // Try candidates: repo-root path and /pages-prefixed path (fallback)
      const candidates = [`${RAW_BASE}${appPathClean}/index.html`, `${RAW_BASE}/pages${appPathClean}/index.html`]

      let res = null
      let htmlText = null
      let chosenBase = null

      for (const url of candidates) {
        try {
          res = await fetch(url, {cache: 'no-store'})
        } catch (e) {
          res = null
        }
        if (res && res.ok) {
          htmlText = await res.text()
          // determine base href corresponding to this url
          const urlObj = new URL(url)
          const basePath = url.replace(/^https:\/\/raw\.githubusercontent\.com\/[^\/]+\/[^\/]+\/[^\/]+/, '')
          // baseHref should point to the directory where index.html lives
          chosenBase = `${RAW_BASE}${basePath.replace(/index\.html$/, '')}`
          break
        }
      }

      if (!htmlText) throw new Error('All fetch attempts failed')

      // Inject <base> so relative assets resolve to raw GitHub path
      if (/<head[^>]*>/i.test(htmlText)) {
        htmlText = htmlText.replace(/<head([^>]*)>/i, `<head$1><base href="${chosenBase}">`)
      } else {
        htmlText = `<base href="${chosenBase}">` + htmlText
      }

      // Ensure viewport meta exists for responsive behavior
      if (!/<meta[^>]+name=["']viewport["']/i.test(htmlText)) {
        if (/<head[^>]*>/i.test(htmlText)) {
          htmlText = htmlText.replace(/<head([^>]*)>/i, `<head$1><meta name="viewport" content="width=device-width, initial-scale=1">`)
        } else {
          htmlText = `<meta name="viewport" content="width=device-width, initial-scale=1">` + htmlText
        }
      }

      // Inject CSS + small script to scale/fit content inside the modal iframe when necessary
      const fitInjection = `
        <style>
          html,body{height:100%;margin:0;box-sizing:border-box}
          body{max-height:100vh;overflow:auto;-webkit-overflow-scrolling:touch}
          #__modal_wrapper{transform-origin:top center;transition:transform .18s ease;}
        </style>
        <script>
          (function(){
            function fitToIframe(){
              try{
                var wrapper = document.getElementById('__modal_wrapper') || document.body;
                var docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, document.documentElement.offsetHeight);
                var winH = window.innerHeight || document.documentElement.clientHeight;
                var padding = 20; // small padding inside modal
                var scale = Math.min(1, (winH - padding) / (docH || 1));
                if (scale < 1) {
                  wrapper.style.transform = 'scale(' + scale + ')';
                } else {
                  wrapper.style.transform = '';
                }
                // ensure top is visible if scaled
                window.scrollTo({top:0});
              } catch(e){console.warn('fitToIframe', e)}
            }
            window.addEventListener('load', function(){
              // wrap body content if not already wrapped
              if (!document.getElementById('__modal_wrapper')){
                var w = document.createElement('div');
                w.id = '__modal_wrapper';
                while (document.body.firstChild) w.appendChild(document.body.firstChild);
                document.body.appendChild(w);
              }
              fitToIframe();
              setTimeout(fitToIframe, 250);
            });
            window.addEventListener('resize', fitToIframe);
            // re-check after DOM mutations (some apps render async)
            var mo = new MutationObserver(function(){fitToIframe()});
            mo.observe(document.body, {childList:true, subtree:true, attributes:true});
          })();
        <\/script>`

      if (/<body[^>]*>/i.test(htmlText)) {
        // inject wrapper and the fit injection before </body>
        htmlText = htmlText.replace(/<body([^>]*)>/i, `<body$1><div id="__modal_wrapper">`)
        if (/<\/body>/i.test(htmlText)) {
          htmlText = htmlText.replace(/<\/body>/i, `${fitInjection}</div></body>`)
        } else {
          htmlText = htmlText + `<div id="__modal_wrapper_end">${fitInjection}</div>`
        }
      } else {
        htmlText = `<div id="__modal_wrapper">` + htmlText + fitInjection + `</div>`
      }

      setIframeSrcDoc(htmlText)
    } catch (err) {
      setModalError('Die App konnte nicht geladen werden. Öffne in neuem Tab.')
      setIframeSrcDoc('')
      console.warn('[Projekte] openApp failed', err)
    } finally {
      setModalLoading(false)
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    setIframeSrcDoc('')
    setModalError('')
    setModalTitle('')
    setModalProject(null)
  }

  const openAppInNewTab = proj => {
    const p = proj || modalProject
    if (!p) return
    const appPathClean = (p.appPath || '').replace(/\/$/, '')
    const baseRepo = (p.githubPath || 'https://github.com/aKs030/Webgame').replace(/\.git$/, '')

    // prefer the path that likely exists in the repo (pages prefix fallback)
    const treeCandidates = [`${baseRepo}/tree/main${appPathClean}`, `${baseRepo}/tree/main/pages${appPathClean}`]

    // Open first candidate — caller can still open in raw tab if needed
    window.open(treeCandidates[0], '_blank', 'noopener')
  }

  return html`
    <${React.Fragment}>
      <!-- Hero Section -->
      <section className="snap-section" id="hero">
        <div className="container-center">
          <div className="badge">
            <span className="badge-dot-container">
              <span className="badge-dot-ping"></span>
              <span className="badge-dot"></span>
            </span>
            JavaScript & React
          </div>
          <h1 className="headline">
            <span className="text-gradient-main">Meine</span>
            <span className="text-gradient-accent">Projekte.</span>
          </h1>
          <p className="description">
            Willkommen in meiner digitalen Werkstatt. Hier sammle ich meine Experimente, vom ersten console.log bis zu interaktiven
            Web-Apps.
          </p>
          <div className="btn-group">
            <button onClick=${scrollToProjects} className="btn btn-primary">
              Los geht's
              <${ArrowDown} style=${{width: '1rem', height: '1rem'}} />
            </button>
          </div>
        </div>
      </section>

      <!-- Project Sections -->
      ${projects.map(
        project => html`
          <section key=${project.id} id=${`project-${project.id}`} className="snap-section">
            <div className="glow-bg" style=${project.bgStyle}></div>
            <div className="project-grid">
              <!-- Left Side (Mockup) -->
              <div
                className="group"
                style=${{
                  order: 2,
                  display: 'flex',
                  justifyContent: 'center',
                  position: 'relative'
                }}>
                <div className="back-glow" style=${{backgroundColor: project.glowColor}}></div>
                <div className="window-mockup">
                  <div className="mockup-content">
                    <div className="mockup-bg-pattern"></div>
                    ${project.previewContent}
                    <div className="mockup-icon">${project.icon}</div>
                  </div>
                </div>
              </div>

              <!-- Right Side (Content) -->
              <div className="project-info" style=${{order: 1}}>
                <div className="project-header">
                  <h2 className="project-title">${project.title}</h2>
                  <div className="divider"></div>
                  <span className="project-category">${project.category}</span>
                </div>
                <p className="project-desc">${project.description}</p>
                <div className="tags-container">
                  ${project.tags.map(
                    (tag, i) => html`
                      <span key=${i} className="tag">${tag}</span>
                    `
                  )}
                </div>
                <div className="project-actions">
                  <button
                    className="btn btn-primary btn-small"
                    onClick=${() => openApp(project)}
                    aria-label=${`App öffnen ${project.title}`}>
                    <${ExternalLink} style=${{width: '1rem', height: '1rem'}} />
                    App öffnen
                  </button>
                  <a
                    className="btn btn-outline btn-small"
                    href=${project.githubPath.replace(/\.git$/, '') + '/tree/main' + project.appPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label=${`Code ${project.title} auf GitHub`}>
                    <${Github} style=${{width: '1rem', height: '1rem'}} />
                    Code
                  </a>
                </div>
              </div>
            </div>
          </section>
        `
      )}

      <!-- Contact Section -->
      <section className="snap-section contact-section" id="contact">
        <div className="container-center">
          <div style=${{marginBottom: '2rem'}}>
            <div className="contact-icon-wrapper">
              <${MousePointerClick} style=${{width: '2.5rem', height: '2.5rem', color: '#60a5fa'}} />
            </div>
          </div>
          <h2 className="contact-title">Lust auf ein Spiel?</h2>
          <p className="contact-text">Ich lerne jeden Tag dazu. Hast du Ideen für mein nächstes kleines Projekt?</p>
          <div className="btn-group">
            <button className="btn btn-primary" style=${{backgroundColor: '#2563eb', color: 'white'}}>Schreib mir</button>
          </div>
        </div>
      </section>

      <!-- In-page App Modal (iframe) -->
      ${modalOpen
        ? html`
            <div
              style=${{
                position: 'fixed',
                inset: 0,
                zIndex: 100000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.6)'
              }}
              role="dialog"
              aria-modal="true">
              <div
                style=${{
                  width: '80vw',
                  height: '70vh',
                  maxWidth: '1000px',
                  maxHeight: '80vh',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                <div style=${{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style=${{color: 'white', fontWeight: 700}}>${modalTitle}</div>
                  <div style=${{display: 'flex', gap: '8px'}}>
                    ${modalLoading
                      ? html`
                          <div style=${{color: 'white', padding: '0.5rem'}}>Lädt…</div>
                        `
                      : null}
                    ${modalError
                      ? html`
                          <div style=${{color: '#ffcccb', padding: '0.5rem'}}>${modalError}</div>
                        `
                      : null}
                    <button className="btn btn-outline" onClick=${() => openAppInNewTab()} style=${{background: 'transparent'}}>
                      In neuem Tab öffnen
                    </button>
                    <button className="btn btn-primary" onClick=${closeModal}>Schließen</button>
                  </div>
                </div>

                <div
                  style=${{
                    flex: '1 1 auto',
                    background: '#000',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                  ${iframeSrcDoc
                    ? html`
                        <iframe
                          srcdoc=${iframeSrcDoc}
                          style=${{width: '100%', height: '100%', border: 'none'}}
                          sandbox="allow-scripts allow-forms allow-pointer-lock allow-popups allow-same-origin"></iframe>
                      `
                    : html`
                        <div style=${{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white'}}>
                          Bitte warten…
                        </div>
                      `}
                </div>
              </div>
            </div>
          `
        : null}
    <//>
  `
}

// Init Function to be called from HTML
export function initProjectsApp() {
  const rootEl = document.getElementById('root')
  if (rootEl && window.ReactDOM && window.React) {
    const root = ReactDOM.createRoot(rootEl)
    root.render(html`
      <${App} />
    `)
  } else {
    // React dependencies or root element missing - fail silently in production
    if (typeof console !== 'undefined' && log.error) {
      log.error('[ProjectsApp] React dependencies or root element missing')
    }
  }
}
