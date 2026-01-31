/**
 * Projects App - No Build Version
 * @version 8.0.0 - Optimized & Clean
 * @description Dynamic project showcase with GitHub integration using htm
 * @performance Optimized with memoization, constants, and GPU acceleration
 * @size Reduced bundle size by removing unused imports and code
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
// @ts-ignore - External CDN module without type definitions
import htm from 'https://esm.sh/htm@3.1.1';
import { createLogger } from '/content/core/logger.js';
import { toRawGithackUrl, testUrl } from './utils/url.utils.js';
import { useToast, useModal, useProjects } from './hooks/index.js';
import { ProjectMockup } from './components/ProjectMockup.js';
import { URL_TEST_TIMEOUT } from './config/constants.js';
import {
  ExternalLink,
  Github,
  ArrowDown,
  Code,
  Sparkles,
  Rocket,
  Palette,
} from '/content/components/ui/icons.js';

const html = htm.bind(React.createElement);
const log = createLogger('projekte-app');

// Constants for consistent sizing
const ICON_SIZES = {
  xsmall: { width: '0.875rem', height: '0.875rem' },
  small: { width: '1rem', height: '1rem' },
  medium: { width: '1.25rem', height: '1.25rem' },
  large: { width: '2.5rem', height: '2.5rem' },
  xlarge: { width: '3rem', height: '3rem' },
};

// Icon collection for projects - only import what's needed dynamically
const ICONS = {
  Code,
  Sparkles,
  Rocket,
  Palette,
};

/**
 * Main App Component
 */
const App = () => {
  const { projects, loading, error } = useProjects(ICONS);
  const toast = useToast();
  const modal = useModal();

  // Memoized scroll handler
  const scrollToProjects = React.useCallback(() => {
    const firstProject = document.getElementById('project-1');
    firstProject?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Memoized project opener with error handling
  const openProject = React.useCallback(
    async (project) => {
      try {
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

        window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        toast.show('✓ App in neuem Tab geöffnet');
      } catch (err) {
        log.error('Failed to open project:', err);
        toast.show('✗ Öffnen fehlgeschlagen');
      }
    },
    [modal, toast, log],
  );

  // Memoized modal close handler
  const handleModalOverlayClick = React.useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        modal.close();
      }
    },
    [modal],
  );

  // Early return for error state
  if (error) {
    return html`
      <section className="snap-section">
        <div className="loading-container">
          <p className="error-message">${error}</p>
        </div>
      </section>
    `;
  }

  // Memoized project sections with lazy loading
  const projectSections = React.useMemo(() => {
    return projects.map((project, index) => {
      const isVisible = index < 3; // Load first 3 projects immediately

      return html`
        <section
          key=${`project-${project.id}`}
          id=${`project-${project.id}`}
          className="snap-section"
        >
          <div
            style=${{
              width: '100%',
              maxWidth: '1200px',
              margin: '0 auto',
            }}
          >
            <div className="project-card">
              <!-- Project Preview -->
              <div className="window-mockup">
                <div className="mockup-content">
                  ${isVisible
                    ? html`<${ProjectMockup} project=${project} />`
                    : html`<div className="u-center">Loading...</div>`}
                  <div className="mockup-icon">${project.icon}</div>
                </div>
              </div>

              <!-- Project Info -->
              <div className="project-info">
                <div className="project-header">
                  <h2 className="project-title">${project.title}</h2>
                  <span className="project-category">${project.category}</span>
                </div>

                <p className="project-desc">${project.description}</p>

                <div className="tags-container">
                  ${project.tags?.map(
                    (tag, i) => html`
                      <span
                        key=${`tag-${project.id}-${i}-${tag}`}
                        className="tag"
                      >
                        ${tag}
                      </span>
                    `,
                  )}
                </div>

                <div className="project-actions">
                  <button
                    className="btn btn-primary btn-small"
                    onClick=${() => openProject(project)}
                    aria-label=${`${project.title} öffnen`}
                  >
                    <${Rocket} style=${ICON_SIZES.small} />
                    App öffnen
                  </button>
                  <a
                    className="btn btn-outline btn-small"
                    href=${project.githubPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label=${`Quellcode von ${project.title} auf GitHub ansehen`}
                  >
                    <${Github} style=${ICON_SIZES.small} />
                    Code
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      `;
    });
  }, [projects, openProject]);

  return html`
    <${React.Fragment}>
      <!-- Hero Section -->
      <section className="snap-section hero-section" id="hero">
        <div className="container">
          <div className="headline-animation">
            <div className="floating-icons">
              <${Code}
                className="icon-float icon-1"
                style=${ICON_SIZES.large}
              />
              <${Sparkles}
                className="icon-float icon-2"
                style=${{ width: '2rem', height: '2rem' }}
              />
              <${Palette}
                className="icon-float icon-3"
                style=${ICON_SIZES.large}
              />
              <${Rocket}
                className="icon-float icon-4"
                style=${ICON_SIZES.xlarge}
              />
            </div>
            <p className="headline-text">
              Entdecke meine interaktiven Web-Projekte – von experimentellen
              Prototypen bis zu vollständigen Anwendungen. Alle Projekte werden
              dynamisch aus meinem GitHub Repository geladen.
            </p>
          </div>

          ${loading
            ? html`
                <div className="hero-stats loading">
                  <div className="stat-item">
                    <${Sparkles} style=${ICON_SIZES.medium} />
                    <span className="stat-label">Lade Projekte...</span>
                  </div>
                </div>
              `
            : html`
                <div className="hero-stats">
                  <div className="stat-item">
                    <${Rocket}
                      style=${{ ...ICON_SIZES.medium, color: '#60a5fa' }}
                    />
                    <span className="stat-value">${projects.length}</span>
                    <span className="stat-label">
                      ${projects.length === 1 ? 'Projekt' : 'Projekte'}
                    </span>
                  </div>
                  <div className="stat-divider" />
                  <div className="stat-item">
                    <${Code}
                      style=${{ ...ICON_SIZES.medium, color: '#34d399' }}
                    />
                    <span className="stat-value">
                      ${new Set(projects.flatMap((p) => p.tags || [])).size}
                    </span>
                    <span className="stat-label">Technologien</span>
                  </div>
                  <div className="stat-divider" />
                  <div className="stat-item">
                    <${Github}
                      style=${{ ...ICON_SIZES.medium, color: '#a78bfa' }}
                    />
                    <span className="stat-value">Open</span>
                    <span className="stat-label">Source</span>
                  </div>
                </div>
              `}

          <div className="btn-group">
            <button
              onClick=${scrollToProjects}
              className="btn btn-primary btn-compact"
              disabled=${loading}
              aria-label="Zu den Projekten scrollen"
            >
              ${loading ? 'Lade...' : 'Projekte ansehen'}
              ${loading
                ? html`<${Sparkles} style=${ICON_SIZES.small} />`
                : html`<${ArrowDown} style=${ICON_SIZES.small} />`}
            </button>
            ${!loading &&
            projects.length > 0 &&
            html`
              <a
                href="https://github.com/Abdulkader-Safi?tab=repositories"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-compact"
                aria-label="GitHub Repositories ansehen"
              >
                <${Github} style=${ICON_SIZES.small} />
                Alle auf GitHub
              </a>
            `}
          </div>
        </div>
      </section>

      <!-- Loading State -->
      ${loading &&
      html`
        <section className="snap-section">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Lade Projekte aus GitHub Repository...</p>
          </div>
        </section>
      `}

      <!-- Error State -->
      ${error &&
      html`
        <section className="snap-section">
          <div className="loading-container">
            <p className="error-message">${error}</p>
          </div>
        </section>
      `}

      <!-- Projects Sections -->
      ${projectSections}

      <!-- Toast Notification -->
      ${toast.message &&
      html`
        <div className="toast-notification" role="status" aria-live="polite">
          ${toast.message}
        </div>
      `}

      <!-- Modal Preview -->
      ${modal.isOpen &&
      html`
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="modal-overlay"
          onClick=${handleModalOverlayClick}
        >
          <div className="modal-wrapper">
            <div className="modal-header">
              <div className="modal-header-title">
                <strong id="modal-title">${modal.title}</strong>
              </div>
              <div className="modal-header-actions">
                <a
                  href=${modal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-small"
                  aria-label="In neuem Tab öffnen"
                >
                  <${ExternalLink} style=${ICON_SIZES.xsmall} />
                  Neuer Tab
                </a>
                <button
                  className="btn btn-primary btn-small"
                  onClick=${modal.close}
                  aria-label="Modal schließen"
                >
                  Schließen
                </button>
              </div>
            </div>
            <div className="modal-body">
              ${modal.isLoading &&
              html`
                <div className="iframe-loader" aria-live="polite">
                  <div className="loading-spinner" />
                  <p style=${{ marginTop: '1rem' }}>Lade Vorschau…</p>
                </div>
              `}
              <iframe
                src=${modal.url}
                onLoad=${modal.handleLoad}
                className="modal-iframe"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title=${`Vorschau: ${modal.title}`}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      `}
    <//>
  `;
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
    log.info('Initializing Projects App v8.0 (htm)...');
    const root = createRoot(rootEl);
    root.render(html`<${App} />`);
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
