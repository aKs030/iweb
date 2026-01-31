/**
 * Projects App - Modern JSX Version
 * @version 6.0.0
 * @description Dynamic project showcase with GitHub integration using JSX
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { createLogger } from '/content/core/logger.js';
import { toRawGithackUrl, testUrl } from './utils/url.utils.js';
import { useToast, useModal, useProjects } from './hooks/index.js';
import { ProjectMockup } from './components/ProjectMockup.jsx';
import { URL_TEST_TIMEOUT } from './config/constants.js';
import {
  ExternalLink,
  Github,
  ArrowDown,
  Code,
  Sparkles,
  Rocket,
  Gamepad2,
  Binary,
  Palette,
  ListTodo,
  Check,
  Globe,
  Zap,
} from '/content/components/ui/icons.js';

const log = createLogger('projekte-app');

// Icon collection for projects
const ICONS = {
  Gamepad2,
  Binary,
  Palette,
  ListTodo,
  Check,
  Code,
  Globe,
  Zap,
  Sparkles,
  Rocket,
};

/**
 * Main App Component
 */
const App = () => {
  const { projects, loading, error } = useProjects(ICONS);
  const toast = useToast();
  const modal = useModal();

  // Smooth scroll to first project
  const scrollToProjects = React.useCallback(() => {
    const firstProject = document.getElementById('project-1');
    firstProject?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Open project in modal or new tab
  const openProject = React.useCallback(
    async (project) => {
      const gh = project.githubPath || '';
      const rawGithack = gh ? toRawGithackUrl(gh) : '';

      // Try to open in modal with embed-friendly URL
      if (rawGithack && (await testUrl(rawGithack, URL_TEST_TIMEOUT))) {
        modal.open(rawGithack, project.title);
        return;
      }

      // Fallback: open in new tab
      const fallbackUrl = project.appPath || project.githubPath || '';
      if (!fallbackUrl) {
        toast.show('⚠️ Keine gültige App-URL vorhanden');
        return;
      }

      try {
        window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        toast.show('✓ App in neuem Tab geöffnet');
      } catch {
        toast.show('✗ Öffnen fehlgeschlagen');
      }
    },
    [modal, toast],
  );

  return (
    <>
      {/* Hero Section */}
      <section className="snap-section hero-section" id="hero">
        <div className="container">
          <div className="badge" role="status">
            <span className="badge-dot-container" aria-hidden="true">
              <span className="badge-dot-ping" />
              <span className="badge-dot" />
            </span>
            <Code style={{ width: '1rem', height: '1rem' }} />
            <span>JavaScript & React</span>
          </div>

          <h1 className="headline">
            <span className="text-gradient-main">Meine</span>
            <span className="text-gradient-accent">Projekte</span>
          </h1>

          <p className="description">
            Entdecke meine interaktiven Web-Projekte – von experimentellen
            Prototypen bis zu vollständigen Anwendungen. Alle Projekte werden
            dynamisch aus meinem GitHub Repository geladen.
          </p>

          {loading ? (
            <div className="hero-stats loading">
              <div className="stat-item">
                <Sparkles
                  style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    color: '#60a5fa',
                  }}
                />
                <span className="stat-label">Lade Projekte...</span>
              </div>
            </div>
          ) : (
            <div className="hero-stats">
              <div className="stat-item">
                <Rocket
                  style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    color: '#60a5fa',
                  }}
                />
                <span className="stat-value">{projects.length}</span>
                <span className="stat-label">
                  {projects.length === 1 ? 'Projekt' : 'Projekte'}
                </span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <Code
                  style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    color: '#34d399',
                  }}
                />
                <span className="stat-value">
                  {new Set(projects.flatMap((p) => p.tags || [])).size}
                </span>
                <span className="stat-label">Technologien</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <Github
                  style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    color: '#a78bfa',
                  }}
                />
                <span className="stat-value">Open</span>
                <span className="stat-label">Source</span>
              </div>
            </div>
          )}

          <div className="btn-group">
            <button
              onClick={scrollToProjects}
              className="btn btn-primary"
              disabled={loading}
              aria-label="Zu den Projekten scrollen"
            >
              {loading ? 'Lade...' : 'Projekte ansehen'}
              {loading ? (
                <Sparkles style={{ width: '1rem', height: '1rem' }} />
              ) : (
                <ArrowDown style={{ width: '1rem', height: '1rem' }} />
              )}
            </button>
            {!loading && projects.length > 0 && (
              <a
                href="https://github.com/Abdulkader-Safi?tab=repositories"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                aria-label="GitHub Repositories ansehen"
              >
                <Github style={{ width: '1rem', height: '1rem' }} />
                Alle auf GitHub
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Loading State */}
      {loading && (
        <section className="snap-section">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Lade Projekte aus GitHub Repository...</p>
          </div>
        </section>
      )}

      {/* Error State */}
      {error && (
        <section className="snap-section">
          <div className="loading-container">
            <p className="error-message">{error}</p>
          </div>
        </section>
      )}

      {/* Projects Sections */}
      {projects.map((project) => (
        <section
          key={`project-${project.id}`}
          id={`project-${project.id}`}
          className="snap-section"
        >
          <div
            style={{
              width: '100%',
              maxWidth: '1200px',
              margin: '0 auto',
            }}
          >
            <div className="project-card">
              {/* Project Preview */}
              <div className="window-mockup">
                <div className="mockup-content">
                  <ProjectMockup project={project} />
                  <div className="mockup-icon">{project.icon}</div>
                </div>
              </div>

              {/* Project Info */}
              <div className="project-info">
                <div className="project-header">
                  <h2 className="project-title">{project.title}</h2>
                  <span className="project-category">{project.category}</span>
                </div>

                <p className="project-desc">{project.description}</p>

                <div className="tags-container">
                  {project.tags?.map((tag, i) => (
                    <span key={`tag-${project.id}-${i}-${tag}`} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="project-actions">
                  <button
                    className="btn btn-primary btn-small"
                    onClick={() => openProject(project)}
                    aria-label={`${project.title} öffnen`}
                  >
                    <Rocket style={{ width: '1rem', height: '1rem' }} />
                    App öffnen
                  </button>
                  <a
                    className="btn btn-outline btn-small"
                    href={project.githubPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Quellcode von ${project.title} auf GitHub ansehen`}
                  >
                    <Github style={{ width: '1rem', height: '1rem' }} />
                    Code
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Toast Notification */}
      {toast.message && (
        <div
          className="toast-notification"
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      {/* Modal Preview */}
      {modal.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && modal.close()}
        >
          <div className="modal-wrapper">
            <div className="modal-header">
              <div className="modal-header-title">
                <strong id="modal-title">{modal.title}</strong>
              </div>
              <div className="modal-header-actions">
                <a
                  href={modal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-small"
                  aria-label="In neuem Tab öffnen"
                >
                  <ExternalLink
                    style={{ width: '0.875rem', height: '0.875rem' }}
                  />
                  Neuer Tab
                </a>
                <button
                  className="btn btn-primary btn-small"
                  onClick={modal.close}
                  aria-label="Modal schließen"
                >
                  Schließen
                </button>
              </div>
            </div>
            <div className="modal-body">
              {modal.isLoading && (
                <div className="iframe-loader" aria-live="polite">
                  <div className="loading-spinner" />
                  <p style={{ marginTop: '1rem' }}>Lade Vorschau…</p>
                </div>
              )}
              <iframe
                src={modal.url}
                onLoad={modal.handleLoad}
                className="modal-iframe"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title={`Vorschau: ${modal.title}`}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Initialize Projects App
 */
export const initProjectsApp = () => {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    log.error('Root element #root not found in DOM');
    return;
  }

  try {
    log.info('Initializing Projects App v6.0 (JSX)...');
    const root = createRoot(rootEl);
    root.render(<App />);
    log.info('Projects App rendered successfully');
  } catch (error) {
    log.error('Failed to render Projects App:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unbekannter Fehler';
    
    rootEl.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #ef4444;">
        <h2>Fehler beim Laden der Projekte</h2>
        <p>${errorMessage}</p>
        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer;">
          Seite neu laden
        </button>
      </div>
    `;
  }
};
