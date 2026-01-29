import React from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import { createLogger } from '/core/logger.js';
import { createProjectsData } from './projects-data.js';
import { ExternalLink, GitHubIcon } from '/components/ui/icons.js';

const log = createLogger('ProjekteApp');
const html = htm.bind(React.createElement);

// --- Components ---

const ProjectCard = ({ project }) => {
  const handleCardClick = (e) => {
    // Wenn auf Links geklickt wird, Event nicht bubblen lassen
    if (e.target.closest('a')) return;
    window.open(project.appUrl, '_blank');
  };

  return html`
    <article
      className="project-card fade-in-up"
      onClick=${handleCardClick}
      style=${{ cursor: 'pointer' }}
    >
      <div className="project-image-container">
        <img
          src=${project.preview}
          alt=${`Vorschau von ${project.name}`}
          className="project-image"
          loading="lazy"
          onError=${(e) => {
            e.target.src =
              '/assets/img/og/og-projekte-800.webp';
          }}
        />
        <div className="project-overlay">
          <a
            href=${project.appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-overlay"
            aria-label=${`Öffne ${project.name}`}
          >
            Vorschau <${ExternalLink} />
          </a>
        </div>
      </div>
      <div className="project-content">
        <div className="project-header">
          <h3 className="project-title">${project.name}</h3>
          <a
            href=${project.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
            aria-label="Zum GitHub Repository"
            onClick=${(e) => e.stopPropagation()}
          >
            <${GitHubIcon} />
          </a>
        </div>
        <p className="project-description">${project.description}</p>
        <div className="project-tech-stack">
          ${project.tech.map(
            (t) => html`<span className="tech-badge">${t}</span>`,
          )}
        </div>
      </div>
    </article>
  `;
};

const ProjectsGrid = () => {
  const [projects, setProjects] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const loadProjects = async () => {
      try {
        // Nutze createProjectsData für konsistentes Caching & Fallback
        const data = await createProjectsData();
        setProjects(data);
      } catch (err) {
        log.error('Failed to load projects:', err);
        setError('Projekte konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  if (loading) {
    return html`
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Lade Projekte...</p>
      </div>
    `;
  }

  if (error) {
    return html`
      <div className="error-state">
        <p>${error}</p>
        <button onClick=${() => window.location.reload()} className="btn-retry">
          Erneut versuchen
        </button>
      </div>
    `;
  }

  return html`
    <div className="projects-grid">
      ${projects.map((p) => html`<${ProjectCard} key=${p.id} project=${p} />`)}
    </div>
  `;
};

// --- Main App ---

const ProjekteApp = () => {
  return html`
    <div className="container-projekte">
      <header className="projekte-header fade-in">
        <h1>Meine Projekte</h1>
        <p>
          Eine Auswahl meiner Web-Experimente, Tools und Anwendungen. Alle
          Projekte sind Open Source auf GitHub verfügbar.
        </p>
      </header>

      <${ProjectsGrid} />
    </div>
  `;
};

// Mount function exported for loader
export function initProjectsApp() {
  const rootEl = document.getElementById('projekte-root');
  if (rootEl) {
    createRoot(rootEl).render(React.createElement(ProjekteApp));
  }
}

// Auto-mount if script loaded directly (optional, keeps compatibility)
if (document.readyState !== 'loading') {
    const rootEl = document.getElementById('projekte-root');
    if (rootEl && !rootEl._reactRootContainer) {
       // Check if already mounted or wait for init
    }
}
