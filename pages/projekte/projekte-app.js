import { createLogger } from '/content/core/logger.js';
import { createProjectsData } from './projects-data.js';
import { toRawGithackUrl, testUrl } from './project-utils.js';

const log = createLogger('projekte-app');

/**
 * Interactive Projects Module - Modernized & Compact
 * @version 3.0.0
 */

import React from 'https://esm.sh/react@19.0.0';
import { createRoot } from 'https://esm.sh/react-dom@19.0.0/client';
import htm from 'https://esm.sh/htm@3.1.1';
import {
  ExternalLink,
  Github,
  ArrowDown,
  MousePointerClick,
  Palette,
  Binary,
  Gamepad2,
  ListTodo,
  Check,
  Code,
  Globe,
  Zap,
} from '/content/components/ui/icons.js';
const html = htm.bind(React.createElement);

// --- APP ---
const App = () => {
  const [projects, setProjects] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // Load projects on component mount
  React.useEffect(() => {
    async function loadProjects() {
      try {
        log.info('Starting to load projects...');
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
        log.info(`Loaded ${loadedProjects.length} projects`);
        setProjects(loadedProjects);
      } catch (err) {
        log.error('Failed to load projects:', err);
        setError(`Projekte konnten nicht geladen werden: ${err.message}`);
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

  const openDirect = async (project) => {
    // Try rawcdn.githack.com for embed-friendly preview
    const gh = project.githubPath || '';
    const rawGithack = gh ? toRawGithackUrl(gh) : '';

    if (rawGithack && (await testUrl(rawGithack, 2500))) {
      setModalTitle(project.title);
      setModalUrl(rawGithack);
      setIframeLoading(true);
      setModalOpen(true);
      try {
        document.body.style.overflow = 'hidden';
      } catch {
        /* ignore */
      }
      return;
    }

    // Fallback: open appPath or githubPath in new tab
    const fallbackUrl = project.appPath || project.githubPath || '';
    if (!fallbackUrl) {
      showToast('Keine gültige App-URL vorhanden');
      return;
    }
    try {
      window.open(fallbackUrl, '_blank', 'noopener');
      showToast('App in neuem Tab geöffnet');
    } catch {
      showToast('Öffnen im Tab fehlgeschlagen');
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

  // Project mockup component: tries to resolve an embed-friendly URL and renders
  // an iframe scaled to fit the mockup box. Falls back to previewContent when unavailable.
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

          // Try rawcdn.githack.com first
          if (gh) {
            const raw = toRawGithackUrl(gh);
            if (raw) candidates.push(raw);
          }

          // Fallback to appPath
          if (project.appPath) {
            candidates.push(
              project.appPath.endsWith('/')
                ? project.appPath + 'index.html'
                : project.appPath,
            );
          }

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
            Experimente, vom ersten Code bis zu interaktiven Web-Apps.
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
};

// Init Function to be called from HTML
export const initProjectsApp = () => {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    log.error('Root element #root not found in DOM');
    return;
  }

  try {
    log.info('Initializing Projects App...');
    const root = createRoot(rootEl);
    root.render(html` <${App} /> `);
    log.info('Projects App rendered successfully');
  } catch (error) {
    log.error('Failed to render Projects App:', error);
    // Show error in UI
    rootEl.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #ef4444;">
        <h2>Fehler beim Laden der Projekte</h2>
        <p>${error.message}</p>
        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer;">
          Seite neu laden
        </button>
      </div>
    `;
  }
};
