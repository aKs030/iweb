import { createLogger } from '/content/core/logger.js';
import { createProjectsData, GitHubUrlConverter } from './projects-data.js';

const log = createLogger('projekte-app');

/* global React, ReactDOM */
/**
 * Interactive Projects Module - Modernized & Compact
 * @version 3.0.0
 */

import htm from 'https://esm.sh/htm@3.1.1';
const html = htm.bind(React.createElement);

// --- Components ---

// Base Icon Component
const IconBase = ({ children, className, style, ...props }) => html`
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
    ...${props}
  >
    ${children}
  </svg>
`;

// Icons
const ExternalLink = (props) => html`
  <${IconBase} ...${props}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  <//>
`;

const Github = (props) => html`
  <${IconBase} ...${props}>
    <path
      d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
    />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  <//>
`;

const ArrowDown = (props) => html`
  <${IconBase} ...${props}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  <//>
`;

const MousePointerClick = (props) => html`
  <${IconBase} ...${props}>
    <path d="M14 4.1 12 6" />
    <path d="m5.1 8-2.9-.8" />
    <path d="m6 12-1.9 2" />
    <path d="M7.2 2.2 8 5.1" />
    <path
      d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"
    />
  <//>
`;

const Palette = (props) => html`
  <${IconBase} ...${props}>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path
      d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
    />
  <//>
`;

const Binary = (props) => html`
  <${IconBase} ...${props}>
    <rect x="14" y="14" width="4" height="6" rx="2" />
    <rect x="6" y="4" width="4" height="6" rx="2" />
    <path d="M6 20h4" />
    <path d="M14 10h4" />
    <path d="M6 14h2v6" />
    <path d="M14 4h2v6" />
  <//>
`;

const Gamepad2 = (props) => html`
  <${IconBase} ...${props}>
    <line x1="6" x2="10" y1="11" y2="11" />
    <line x1="8" x2="8" y1="9" y2="13" />
    <line x1="15" x2="15.01" y1="12" y2="12" />
    <line x1="18" x2="18.01" y1="10" y2="10" />
    <path
      d="M17.3 2.9A2 2 0 0 0 15 2H9a2 2 0 0 0-2.3.9C3.8 5.7 3 9.4 4.2 13c1 3 3.6 5 6.8 5h2c3.2 0 5.8-2 6.8-5 1.2-3.6.4-7.3-2.5-10.1Z"
    />
  <//>
`;

const ListTodo = (props) => html`
  <${IconBase} ...${props}>
    <rect x="3" y="5" width="6" height="6" rx="1" />
    <path d="m3 17 2 2 4-4" />
    <path d="M13 6h8" />
    <path d="M13 12h8" />
    <path d="M13 18h8" />
  <//>
`;

const Check = (props) => html`
  <${IconBase} ...${props}>
    <path d="M20 6 9 17l-5-5" />
  <//>
`;

const Code = (props) => html`
  <${IconBase} ...${props}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  <//>
`;

const Globe = (props) => html`
  <${IconBase} ...${props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  <//>
`;

const Zap = (props) => html`
  <${IconBase} ...${props}>
    <path
      d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
    />
  <//>
`;

// --- APP ---
function App() {
  const [projects, setProjects] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // Load projects on component mount
  React.useEffect(() => {
    async function loadProjects() {
      try {
        setLoading(true);
        const loadedProjects = await createProjectsData(html, {
          Gamepad2,
          Binary,
          Palette,
          ListTodo,
          Check,
          Code,
          Globe,
          Zap,
        });
        setProjects(loadedProjects);
      } catch (err) {
        console.error('Failed to load projects:', err);
        setError('Projekte konnten nicht geladen werden');
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  const scrollToProjects = () => {
    const firstProject = document.getElementById('project-1');
    if (firstProject) {
      firstProject.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Modal preview state for opening apps in a popup
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalUrl, setModalUrl] = React.useState('');
  const [modalTitle, setModalTitle] = React.useState('');
  const [iframeLoading, setIframeLoading] = React.useState(true);
  const [toastMsg, setToastMsg] = React.useState('');
  const toastTimerRef = React.useRef(null);
  const showToast = (msg, ms = 2600) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(''), ms);
  };

  const testUrl = async (url, timeout = 2500) => {
    if (!url) return false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return res?.ok;
    } catch {
      return false;
    }
  };

  const openDirect = async (project) => {
    const gh = project.githubPath || '';
    const candidates = [];

    if (gh) {
      const rawGithack = GitHubUrlConverter.toRawGithack(gh);
      const jsDelivr = GitHubUrlConverter.toJsDelivr(gh);
      if (rawGithack) candidates.push(rawGithack);
      if (jsDelivr) candidates.push(jsDelivr);
    }

    if (project.appPath) {
      candidates.push(
        project.appPath.endsWith('/')
          ? project.appPath + 'index.html'
          : project.appPath,
      );
    }

    // Test URLs in parallel and use first successful one
    try {
      const results = await Promise.allSettled(
        candidates.map(async (url) => {
          const isValid = await testUrl(url, 2000);
          return isValid ? url : null;
        }),
      );

      const validUrl = results
        .filter((result) => result.status === 'fulfilled' && result.value)
        .map((result) => result.value)[0];

      if (validUrl) {
        setModalTitle(project.title);
        setModalUrl(validUrl);
        setIframeLoading(true);
        setModalOpen(true);
        try {
          document.body.style.overflow = 'hidden';
        } catch {
          /* ignore */
        }
        return;
      }
    } catch (error) {
      console.warn('URL testing failed:', error);
    }

    // Fallback: open in new tab
    const fallbackUrl = candidates[0] || project.githubPath || '';
    if (fallbackUrl) {
      try {
        window.open(fallbackUrl, '_blank', 'noopener');
        showToast('App in neuem Tab geöffnet');
      } catch {
        showToast('Öffnen im Tab fehlgeschlagen');
      }
    } else {
      showToast('Keine gültige App-URL vorhanden');
    }
  };

  const closeAppModal = () => {
    setModalOpen(false);
    setModalUrl('');
    setModalTitle('');
    try {
      document.body.style.overflow = '';
    } catch {
      /* ignore */
    }
  };

  // Project mockup component: tries to resolve an embed-friendly URL (raw.githack/jsDelivr/appPath)
  // and renders an iframe scaled to fit the mockup box (no internal scroll). Falls back to the
  // project's existing `previewContent` when no embed URL is available.
  const ProjectMockup = ({ project }) => {
    const wrapperRef = React.useRef(null);
    const iframeRef = React.useRef(null);
    const [previewUrl, setPreviewUrl] = React.useState(null);

    React.useEffect(() => {
      let canceled = false;
      (async () => {
        try {
          const gh = project.githubPath || '';
          const candidates = [];
          if (gh) {
            const raw = GitHubUrlConverter.toRawGithack(gh);
            const js = GitHubUrlConverter.toJsDelivr(gh);
            if (raw) candidates.push(raw);
            if (js) candidates.push(js);
          }
          if (project.appPath)
            candidates.push(
              project.appPath.endsWith('/')
                ? project.appPath + 'index.html'
                : project.appPath,
            );

          for (const url of candidates) {
            if (!url) continue;
            if (await testUrl(url, 2500)) {
              if (!canceled) setPreviewUrl(url);
              return;
            }
          }
        } catch {
          // ignore
        }
      })();
      return () => {
        canceled = true;
      };
    }, [project]);

    // Scale iframe to fit wrapper while keeping aspect ratio
    React.useEffect(() => {
      if (!previewUrl) return;
      const wrapper = wrapperRef.current;
      const iframe = iframeRef.current;
      if (!wrapper || !iframe) return;
      const baseW = 1024;
      const baseH = 768;
      const apply = () => {
        const w = wrapper.clientWidth;
        const h = wrapper.clientHeight;
        const scale = Math.min(1, w / baseW, h / baseH);
        iframe.style.transform = `scale(${scale})`;
      };
      apply();
      const ro = new ResizeObserver(apply);
      ro.observe(wrapper);
      return () => ro.disconnect();
    }, [previewUrl]);

    return html`
      <div className="mockup-iframe-wrapper u-center" ref=${wrapperRef}>
        ${previewUrl
          ? html`
              <iframe
                className="mockup-iframe"
                ref=${iframeRef}
                src=${previewUrl}
                scrolling="no"
                sandbox="allow-scripts allow-same-origin allow-forms"
                frameborder="0"
                title=${project.title}
              ></iframe>
            `
          : project.previewContent}
      </div>
    `;
  };

  // Cleanup toast timer on unmount
  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return html`
    <${React.Fragment}>
      <!-- Hero Section -->
      <section className="snap-section" id="hero">
        <div
          className="container"
          style=${{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}
        >
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
            Willkommen in meiner digitalen Werkstatt. Hier sammle ich meine
            Experimente, vom ersten console.log bis zu interaktiven Web-Apps.
            ${loading ? 'Projekte werden dynamisch aus GitHub geladen...' : ''}
          </p>
          <div className="btn-group">
            <button
              onClick=${scrollToProjects}
              className="btn btn-primary"
              disabled=${loading}
            >
              ${loading ? 'Lade...' : "Los geht's"}
              <${ArrowDown} style=${{ width: '1rem', height: '1rem' }} />
            </button>
          </div>
        </div>
      </section>

      <!-- Loading State -->
      ${loading
        ? html`
            <section className="snap-section">
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Lade Projekte aus GitHub Repository...</p>
              </div>
            </section>
          `
        : null}

      <!-- Error State -->
      ${error
        ? html`
            <section className="snap-section">
              <div className="loading-container">
                <p className="error-message">${error}</p>
              </div>
            </section>
          `
        : null}

      <!-- Projects Sections - Individual Snap Sections -->
      ${projects.map(
        (project) => html`
          <section
            key=${project.id}
            id=${`project-${project.id}`}
            className="snap-section"
          >
            <div
              style=${{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}
            >
              <div className="project-card">
                <!-- Project Preview -->
                <div className="window-mockup">
                  <div className="mockup-content">
                    <${ProjectMockup} project=${project} />
                    <div className="mockup-icon">${project.icon}</div>
                  </div>
                </div>

                <!-- Project Info -->
                <div className="project-info">
                  <div className="project-header">
                    <h2 className="project-title">${project.title}</h2>
                    <span className="project-category"
                      >${project.category}</span
                    >
                  </div>

                  <p className="project-desc">${project.description}</p>

                  <div className="tags-container">
                    ${project.tags.map(
                      (tag, i) => html`
                        <span key=${i} className="tag">${tag}</span>
                      `,
                    )}
                  </div>

                  <div className="project-actions">
                    <button
                      className="btn btn-primary btn-small"
                      onClick=${() => openDirect(project)}
                      aria-label=${`App öffnen ${project.title}`}
                    >
                      <${ExternalLink}
                        style=${{ width: '1rem', height: '1rem' }}
                      />
                      App öffnen
                    </button>
                    <a
                      className="btn btn-outline btn-small"
                      href=${project.githubPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label=${`Code ${project.title} auf GitHub`}
                    >
                      <${Github} style=${{ width: '1rem', height: '1rem' }} />
                      Code
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        `,
      )}
      ${toastMsg
        ? html` <div className="toast-notification">${toastMsg}</div> `
        : null}
      ${modalOpen
        ? html`
            <div
              role="dialog"
              aria-modal="true"
              aria-label=${`Vorschau ${modalTitle}`}
              className="modal-overlay"
              onClick=${(e) => e.target === e.currentTarget && closeAppModal()}
            >
              <div className="modal-wrapper">
                <div className="modal-header">
                  <div className="modal-header-title">
                    <strong>${modalTitle}</strong>
                  </div>
                  <div className="modal-header-actions">
                    <a
                      href=${modalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-small"
                    >
                      <${ExternalLink}
                        style=${{ width: '0.875rem', height: '0.875rem' }}
                      />
                      Neuer Tab
                    </a>
                    <button
                      className="btn btn-primary btn-small"
                      onClick=${closeAppModal}
                      aria-label="Schließen"
                    >
                      Schließen
                    </button>
                  </div>
                </div>
                <div className="modal-body">
                  ${iframeLoading
                    ? html`
                        <div className="iframe-loader">
                          <div className="loading-spinner"></div>
                          <p style=${{ marginTop: '1rem' }}>Lade Vorschau…</p>
                        </div>
                      `
                    : null}
                  <iframe
                    src=${modalUrl}
                    onLoad=${() => setIframeLoading(false)}
                    className="modal-iframe"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    title=${`Vorschau von ${modalTitle}`}
                  ></iframe>
                </div>
              </div>
            </div>
          `
        : null}

      <!-- Contact Section -->
      <section className="contact-section" id="contact">
        <div style=${{ textAlign: 'center' }}>
          <div className="contact-icon-wrapper">
            <${MousePointerClick}
              style=${{ width: '2rem', height: '2rem', color: '#60a5fa' }}
            />
          </div>
          <h2 className="contact-title">Lust auf ein Spiel?</h2>
          <p className="contact-text">
            Ich lerne jeden Tag dazu. Hast du Ideen für mein nächstes kleines
            Projekt?
          </p>
          <div className="btn-group">
            <button
              className="btn btn-primary"
              style=${{
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: 'white',
              }}
            >
              Schreib mir
            </button>
          </div>
        </div>
      </section>
    <//>
  `;
}

// Init Function to be called from HTML
export function initProjectsApp() {
  const rootEl = document.getElementById('root');
  if (rootEl && window.ReactDOM && window.React) {
    const root = ReactDOM.createRoot(rootEl);
    root.render(html` <${App} /> `);
  } else {
    // React dependencies or root element missing - fail silently in production
    if (typeof console !== 'undefined' && log.error) {
      log.error('React dependencies or root element missing');
    }
  }
}
