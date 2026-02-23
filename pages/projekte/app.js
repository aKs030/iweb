/**
 * React Projects App - 3D Space Edition
 * @version 8.0.0 - Deep cleanup
 * @description 3D Scroll-based Gallery using Three.js and React
 */

import {
  createElement as h,
  Fragment,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { useProjects } from './hooks/useProjects.js';
import { ThreeScene } from './components/ThreeScene.js';
import * as Icons from '/content/components/icons/icons.js';
import { i18n } from '/content/core/i18n.js';
const CRAWLER_UA_PATTERN =
  /googlebot|google-inspectiontool|bingbot|slurp|duckduckbot|baiduspider|yandex|facebookexternalhit|twitterbot|linkedinbot|applebot|semrushbot|ahrefsbot/i;

const shouldDisableThreeScene = () => {
  if (typeof window === 'undefined') return false;

  const userAgent =
    typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
  if (CRAWLER_UA_PATTERN.test(userAgent)) return true;

  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const normalizeProjectSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');

/**
 * Main App Component
 */
const App = () => {
  const { projects, loading, error } = useProjects(Icons);
  const [lang, setLang] = useState(i18n.currentLang);

  // State for the currently focused project index (controlled by scroll in ThreeScene)
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [isThreeSceneEnabled] = useState(() => !shouldDisableThreeScene());
  const [popupApp, setPopupApp] = useState(null);
  const [popupSize, setPopupSize] = useState(null);
  const [showCaseStudy, setShowCaseStudy] = useState(false);
  const popupFrameRef = useRef(null);

  useEffect(() => i18n.subscribe(setLang), []);

  useEffect(() => {
    if (activeProjectIndex >= projects.length) {
      setActiveProjectIndex(0);
    }
  }, [activeProjectIndex, projects.length]);

  useEffect(() => {
    if (!projects.length) return;

    const appSlug = normalizeProjectSlug(
      new URLSearchParams(window.location.search).get('app'),
    );
    if (!appSlug) return;

    const appIndex = projects.findIndex((project) => {
      const candidate = normalizeProjectSlug(
        project?.name || project?.title || '',
      );
      return candidate === appSlug;
    });

    if (appIndex >= 0) {
      setActiveProjectIndex(appIndex);
    }
  }, [projects]);

  useEffect(() => {
    if (projects.length === 0) {
      setIsSceneReady(false);
      return;
    }

    // Inject SoftwareApplication Schema.org JSON-LD
    const scriptId = 'projects-schema-ldjson';
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    const CATEGORY_MAP = {
      game: 'GameApplication',
      utility: 'WebApplication',
      productivity: 'WebApplication',
      ui: 'WebApplication',
      web: 'WebApplication',
    };

    const projectsListId =
      'https://www.abdulkerimsesli.de/projekte/#projects-list';
    const seenSlugs = new Set();
    const projectNodes = [];

    projects.forEach((project, index) => {
      const rawSlug = String(
        project?.name || project?.title || `project-${index + 1}`,
      )
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const slug = rawSlug || `project-${index + 1}`;
      if (seenSlugs.has(slug)) return;
      seenSlugs.add(slug);

      const canonicalUrl = `https://www.abdulkerimsesli.de/projekte/?app=${encodeURIComponent(slug)}`;
      const nodeId = `${canonicalUrl}#app`;
      const name = project.title || project.name || `Projekt ${index + 1}`;

      projectNodes.push({
        '@type': 'SoftwareApplication',
        '@id': nodeId,
        name,
        description: project.description,
        applicationCategory: CATEGORY_MAP[project.category] || 'WebApplication',
        applicationSubCategory: project.category || undefined,
        operatingSystem: 'Any',
        url: canonicalUrl,
        ...(project.appPath ? { sameAs: project.appPath } : {}),
        ...(project.image ? { image: [project.image] } : {}),
        ...(Array.isArray(project.tags) && project.tags.length
          ? { keywords: project.tags.join(', ') }
          : {}),
        ...(project.version ? { softwareVersion: project.version } : {}),
        author: {
          '@type': 'Person',
          name: 'Abdulkerim Sesli',
          url: 'https://www.abdulkerimsesli.de/',
        },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
        },
        isPartOf: { '@id': projectsListId },
      });
    });

    const listNode = {
      '@type': 'ItemList',
      '@id': projectsListId,
      name: 'Projekte von Abdulkerim Sesli',
      numberOfItems: projectNodes.length,
      itemListElement: projectNodes.map((node, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@id': node['@id'],
          name: node.name,
          url: node.url,
        },
      })),
    };

    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [listNode, ...projectNodes],
    });
  }, [projects.length]);

  useEffect(() => {
    if (loading || projects.length === 0) return;

    if (!isThreeSceneEnabled) {
      setIsSceneReady(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setIsSceneReady(true);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [loading, projects.length, isThreeSceneEnabled]);

  useEffect(() => {
    if (!popupApp) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('projects-popup-open');
    setPopupSize(null);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPopupApp(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove('projects-popup-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [popupApp]);

  useEffect(() => {
    if (!popupApp) return;

    const onMessage = (event) => {
      const payload = event.data;
      if (!payload || payload.type !== 'card-fit-size') return;

      const frameWindow = popupFrameRef.current?.contentWindow;
      if (frameWindow && event.source !== frameWindow) return;

      const width = Number(payload.width);
      const height = Number(payload.height);
      if (!Number.isFinite(width) || !Number.isFinite(height)) return;

      const clampedWidth = Math.max(320, Math.min(1600, Math.round(width)));
      const clampedHeight = Math.max(240, Math.min(1200, Math.round(height)));
      setPopupSize({ width: clampedWidth, height: clampedHeight });
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [popupApp]);

  const t = (key, fallback, params = {}) => {
    const translated = i18n.t(key, params);
    return translated === key ? fallback : translated;
  };

  const normalizeAppUrl = (url) => {
    if (!url) return url;
    return url.replace('rawcdn.githack.com', 'raw.githack.com');
  };

  const popupAppUrl = (url) => {
    const normalized = normalizeAppUrl(url);
    if (!normalized) return normalized;

    try {
      const parsed = new URL(normalized);
      parsed.searchParams.set('card', '1');
      parsed.searchParams.set('popup', '1');
      return parsed.toString();
    } catch {
      const separator = normalized.includes('?') ? '&' : '?';
      return `${normalized}${separator}card=1&popup=1`;
    }
  };

  const openAppPopup = (event, project) => {
    event.preventDefault();
    const url = popupAppUrl(project?.appPath);
    if (!url) return;

    setPopupApp({
      title: project?.title || t('projects.card.btn_open', 'Open App'),
      url,
    });
  };

  const closeAppPopup = () => setPopupApp(null);

  const requestPopupFit = () => {
    const frameWindow = popupFrameRef.current?.contentWindow;
    if (!frameWindow) return;

    try {
      frameWindow.postMessage({ type: 'card-fit-request' }, '*');
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    if (!popupApp) return;

    const runFitRequest = () => {
      window.requestAnimationFrame(() => {
        requestPopupFit();
      });
    };

    const resizeTimer = window.setTimeout(runFitRequest, 120);
    const lateTimer = window.setTimeout(runFitRequest, 420);

    const onResize = () => runFitRequest();
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      window.clearTimeout(resizeTimer);
      window.clearTimeout(lateTimer);
      window.removeEventListener('resize', onResize);
    };
  }, [popupApp]);

  // Update active project based on scroll
  const handleScrollUpdate = (index) => {
    setActiveProjectIndex(index);
  };

  if (loading) {
    return h(
      'div',
      {
        className: 'launch-screen',
        'data-lang': lang,
        'aria-live': 'polite',
      },
      h(
        'div',
        { className: 'launch-card' },
        h(
          'span',
          { className: 'launch-badge' },
          t('projects.launch.badge', '3D Project Gallery'),
        ),
        h(
          'h1',
          { className: 'launch-title' },
          t('projects.launch.title', 'Starting project view'),
        ),
        h(
          'p',
          { className: 'launch-subtitle' },
          t(
            'projects.launch.subtitle',
            'Apps are loaded from GitHub and prepared for 3D navigation.',
          ),
        ),
        h(
          'div',
          { className: 'launch-status' },
          h('span', { className: 'launch-dot', 'aria-hidden': 'true' }),
          h(
            'span',
            null,
            t(
              'projects.launch.loading',
              'Loading projects and preparing the scene...',
            ),
          ),
        ),
        h(
          'p',
          { className: 'launch-hint' },
          t(
            'projects.launch.hint',
            'After startup you can explore the app list by scrolling.',
          ),
        ),
      ),
    );
  }

  if (error) {
    return h(
      'div',
      {
        className: 'launch-screen launch-screen--error',
        'data-lang': lang,
        'aria-live': 'assertive',
      },
      h(
        'div',
        { className: 'launch-card' },
        h(
          'h2',
          { className: 'launch-title' },
          t(
            'projects.launch.error_title',
            'Projects could not be loaded at startup',
          ),
        ),
        h('p', { className: 'launch-error-copy' }, error),
        h(
          'button',
          {
            type: 'button',
            className: 'btn btn-primary launch-retry',
            onClick: () => window.location.reload(),
          },
          t('projects.launch.retry', 'Reload page'),
        ),
      ),
    );
  }

  if (projects.length === 0) {
    return h(
      'div',
      {
        className: 'launch-screen launch-screen--error',
        'data-lang': lang,
        'aria-live': 'polite',
      },
      h(
        'div',
        { className: 'launch-card' },
        h(
          'h2',
          { className: 'launch-title' },
          t('error.no_content', 'No projects available'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'btn btn-primary launch-retry',
            onClick: () => window.location.reload(),
          },
          t('projects.launch.retry', 'Reload page'),
        ),
      ),
    );
  }

  const activeProject = projects[activeProjectIndex];
  const popupPanelStyle = popupSize
    ? {
        width: `min(calc(100vw - 1rem), ${Math.max(420, popupSize.width + 36)}px)`,
        height: `min(calc(100vh - 1rem), ${Math.max(380, popupSize.height + 86)}px)`,
      }
    : null;

  return h(
    Fragment,
    null,
    // 3D Canvas Container
    h(
      'div',
      { id: 'canvas-container' },
      isThreeSceneEnabled &&
        projects.length > 0 &&
        h(ThreeScene, {
          projects,
          onScrollUpdate: handleScrollUpdate,
          onReady: () => setIsSceneReady(true),
        }),
    ),

    !isSceneReady &&
      h(
        'div',
        { className: 'launch-overlay', 'aria-live': 'polite' },
        h(
          'div',
          { className: 'launch-overlay-card' },
          h('span', { className: 'launch-dot', 'aria-hidden': 'true' }, ' '),
          h(
            'span',
            null,
            t('projects.launch.scene', 'Initializing 3D scene...'),
          ),
        ),
      ),

    popupApp &&
      typeof document !== 'undefined' &&
      document.body &&
      createPortal(
        h(
          'div',
          {
            className: 'app-popup',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('projects.app.popup_title', 'App popup'),
            onClick: (event) => {
              if (event.target === event.currentTarget) {
                closeAppPopup();
              }
            },
          },
          h(
            'div',
            { className: 'app-popup__panel', style: popupPanelStyle },
            h(
              'div',
              { className: 'app-popup__header' },
              h(
                'div',
                { className: 'app-popup__title-wrap' },
                h(
                  'span',
                  { className: 'app-popup__label' },
                  t('projects.launch.source', 'Live from GitHub'),
                ),
                h('strong', { className: 'app-popup__title' }, popupApp.title),
              ),
              h(
                'div',
                { className: 'app-popup__actions' },
                h(
                  'a',
                  {
                    href: popupApp.url,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className: 'btn btn-outline app-popup__action',
                  },
                  t('projects.app.open_tab', 'Open in new tab'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'btn btn-primary app-popup__action',
                    onClick: closeAppPopup,
                  },
                  t('projects.app.close', 'Close'),
                ),
              ),
            ),
            h(
              'div',
              { className: 'app-popup__frame-wrap' },
              h('iframe', {
                className: 'app-popup__frame',
                ref: popupFrameRef,
                src: popupApp.url,
                title: popupApp.title,
                loading: 'eager',
                allow: 'clipboard-read; clipboard-write; fullscreen',
                referrerPolicy: 'no-referrer-when-downgrade',
                onLoad: () => requestPopupFit(),
              }),
            ),
          ),
        ),
        document.body,
      ),

    // HUD Overlay
    h(
      'div',
      {
        className: `hud-container ${isSceneReady ? 'is-ready' : 'is-pending'}`,
      },

      // Active Project Info Panel
      activeProject &&
        h(
          'div',
          {
            className: `hud-panel ${isSceneReady ? 'visible' : ''}`,
            key: activeProject.id,
          },
          h(
            'div',
            { className: 'hud-meta-row' },
            h(
              'span',
              { className: 'hud-meta-pill' },
              t('projects.launch.source', 'Live from GitHub'),
            ),
            h(
              'span',
              { className: 'hud-meta-count' },
              `${activeProjectIndex + 1}/${projects.length}`,
            ),
          ),
          h(
            'span',
            { className: 'hud-category' },
            activeProject.category || 'Project',
          ),
          h('h1', { className: 'hud-title' }, activeProject.title),
          h('p', { className: 'hud-desc' }, activeProject.description),

          // Case Study expandable section
          activeProject.caseStudy &&
            h(
              'div',
              { className: 'hud-case-study' },
              h(
                'button',
                {
                  type: 'button',
                  className: `btn btn-outline hud-case-study-toggle ${showCaseStudy ? 'is-open' : ''}`,
                  onClick: () => setShowCaseStudy((v) => !v),
                  style: {
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.8rem',
                    marginBottom: '0.5rem',
                  },
                },
                showCaseStudy ? '✕ Case Study schließen' : '📋 Case Study',
              ),
              showCaseStudy &&
                h(
                  'div',
                  { className: 'hud-case-study-content' },
                  h(
                    'div',
                    { className: 'hud-cs-block' },
                    h('strong', null, '⚡ Problem'),
                    h('p', null, activeProject.caseStudy.problem),
                  ),
                  h(
                    'div',
                    { className: 'hud-cs-block' },
                    h('strong', null, '💡 Lösung'),
                    h('p', null, activeProject.caseStudy.solution),
                  ),
                  h(
                    'div',
                    { className: 'hud-cs-block' },
                    h('strong', null, '🛠 Tech Stack'),
                    h('p', null, activeProject.caseStudy.techStack.join(' · ')),
                  ),
                  h(
                    'div',
                    { className: 'hud-cs-block' },
                    h('strong', null, '📊 Ergebnis'),
                    h('p', null, activeProject.caseStudy.results),
                  ),
                ),
            ),

          h(
            'div',
            { className: 'hud-actions' },
            activeProject.appPath &&
              h(
                'a',
                {
                  href: normalizeAppUrl(activeProject.appPath),
                  onClick: (event) => openAppPopup(event, activeProject),
                  className: 'btn btn-primary',
                },
                t('projects.card.btn_open', 'Open App'),
              ),

            activeProject.githubPath &&
              h(
                'a',
                {
                  href: activeProject.githubPath,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  className: 'btn btn-outline',
                },
                t('projects.card.btn_code', 'GitHub'),
              ),
          ),
        ),

      // Scroll Indicator
      isThreeSceneEnabled &&
        h(
          'div',
          { className: 'scroll-hint' },
          t('projects.launch.scroll_hint', 'SCROLL TO EXPLORE'),
        ),
    ),
  );
};

export const initReactProjectsApp = () => {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;

  try {
    const root = createRoot(rootEl);
    root.render(h(App));
  } catch {
    // Failed to initialize React app - show error in UI
    if (rootEl) {
      rootEl.innerHTML =
        '<div class="launch-screen launch-screen--error"><div class="launch-card"><h2>App konnte nicht geladen werden</h2></div></div>';
    }
  }
};
