/**
 * React Projects App - Without HTM
 * @version 1.0.0
 * @description React app using createElement directly
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { createLogger } from '/content/core/logger.js';
import { toRawGithackUrl, testUrl } from './utils/url.utils.js';
import {
  useToast,
  useModal,
  useProjects,
  useAppManager,
} from './hooks/index.js';
import { URL_TEST_TIMEOUT } from './config/constants.js';

const log = createLogger('react-projekte-app');
const { createElement: h, Fragment } = React;

// Simple SVG Icons (without HTM dependency)
const createIcon = (paths, props = {}) => {
  return h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '24',
      height: '24',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      ...props,
    },
    ...paths,
  );
};

const ExternalLink = (props) =>
  createIcon(
    [
      h('path', {
        key: 1,
        d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
      }),
      h('polyline', { key: 2, points: '15,3 21,3 21,9' }),
      h('line', { key: 3, x1: '10', y1: '14', x2: '21', y2: '3' }),
    ],
    props,
  );

const Github = (props) =>
  createIcon(
    [
      h('path', {
        key: 1,
        d: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22',
      }),
    ],
    props,
  );

const ArrowDown = (props) =>
  createIcon(
    [
      h('line', { key: 1, x1: '12', y1: '5', x2: '12', y2: '19' }),
      h('polyline', { key: 2, points: '19,12 12,19 5,12' }),
    ],
    props,
  );

const Code = (props) =>
  createIcon(
    [
      h('polyline', { key: 1, points: '16,18 22,12 16,6' }),
      h('polyline', { key: 2, points: '8,6 2,12 8,18' }),
    ],
    props,
  );

const Sparkles = (props) =>
  createIcon(
    [
      h('path', {
        key: 1,
        d: 'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
      }),
    ],
    props,
  );

const Rocket = (props) =>
  createIcon(
    [
      h('path', {
        key: 1,
        d: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z',
      }),
      h('path', {
        key: 2,
        d: 'M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z',
      }),
      h('path', { key: 3, d: 'M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0' }),
      h('path', { key: 4, d: 'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5' }),
    ],
    props,
  );

const Palette = (props) =>
  createIcon(
    [
      h('circle', {
        key: 1,
        cx: '13.5',
        cy: '6.5',
        r: '.5',
        fill: 'currentColor',
      }),
      h('circle', {
        key: 2,
        cx: '17.5',
        cy: '10.5',
        r: '.5',
        fill: 'currentColor',
      }),
      h('circle', {
        key: 3,
        cx: '8.5',
        cy: '7.5',
        r: '.5',
        fill: 'currentColor',
      }),
      h('circle', {
        key: 4,
        cx: '6.5',
        cy: '12.5',
        r: '.5',
        fill: 'currentColor',
      }),
      h('path', {
        key: 5,
        d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z',
      }),
    ],
    props,
  );

// Constants for consistent sizing
const ICON_SIZES = {
  xsmall: { width: '0.875rem', height: '0.875rem' },
  small: { width: '1rem', height: '1rem' },
  medium: { width: '1.25rem', height: '1.25rem' },
  large: { width: '2.5rem', height: '2.5rem' },
  xlarge: { width: '3rem', height: '3rem' },
};

// Icon collection for projects
const ICONS = {
  Code,
  Sparkles,
  Rocket,
  Palette,
};

/**
 * Project Mockup Component
 */
const ProjectMockup = ({ project, isAppOpen, appUrl }) => {
  const wrapperRef = React.useRef(null);
  const iframeRef = React.useRef(null);
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const [iframeLoaded, setIframeLoaded] = React.useState(false);

  React.useEffect(() => {
    let canceled = false;

    const findPreviewUrl = async () => {
      try {
        const candidates = [];
        const gh = project.githubPath || '';
        if (gh) {
          const raw = toRawGithackUrl(gh);
          if (raw) candidates.push(raw);
        }
        if (project.appPath) {
          const appUrl = project.appPath.endsWith('/')
            ? `${project.appPath}index.html`
            : project.appPath;
          candidates.push(appUrl);
        }

        for (const url of candidates) {
          if (!url || canceled) continue;
          if (await testUrl(url, URL_TEST_TIMEOUT)) {
            if (!canceled) setPreviewUrl(url);
            return;
          }
        }
      } catch (err) {
        log.debug('Preview URL resolution failed:', err);
      }
    };

    findPreviewUrl();
    return () => {
      canceled = true;
    };
  }, [project]);

  // Show full app if opened, otherwise show preview
  const displayUrl = isAppOpen && appUrl ? appUrl : previewUrl;
  const iframeClass = isAppOpen ? 'mockup-iframe-full' : 'mockup-iframe';

  const handleIframeLoad = React.useCallback(() => {
    setIframeLoaded(true);
    const iframe = iframeRef.current;
    if (iframe && isAppOpen) {
      // Focus iframe for better interactivity
      setTimeout(() => {
        if ('focus' in iframe && typeof iframe.focus === 'function') {
          iframe.focus();
        }
      }, 100);
    }
  }, [isAppOpen]);

  return h(
    'div',
    {
      className: 'mockup-iframe-wrapper u-center',
      ref: wrapperRef,
    },
    displayUrl
      ? h(
          Fragment,
          null,
          !iframeLoaded &&
            isAppOpen &&
            h('div', { className: 'app-loading' }, 'App wird geladen...'),
          h('iframe', {
            className: iframeClass,
            ref: iframeRef,
            src: displayUrl,
            scrolling: isAppOpen ? 'auto' : 'auto',
            sandbox:
              'allow-scripts allow-same-origin allow-forms allow-popups allow-modals',
            frameBorder: '0',
            title: `${isAppOpen ? 'App' : 'Preview'}: ${project.title}`,
            loading: isAppOpen ? 'eager' : 'eager',
            allow: isAppOpen
              ? 'fullscreen; clipboard-read; clipboard-write'
              : '',
            style: isAppOpen
              ? {
                  width: '100%',
                  height: '100%',
                  minHeight: '500px',
                  border: 'none',
                  background: '#ffffff',
                }
              : {},
            onLoad: handleIframeLoad,
            onError: () => {
              log.warn(
                `Failed to load ${isAppOpen ? 'app' : 'preview'} for ${project.title}`,
              );
              setIframeLoaded(true);
            },
          }),
        )
      : project.previewContent ||
          h('div', { className: 'app-loading' }, 'Keine Vorschau verfügbar'),
  );
};

/**
 * Main App Component
 */
const App = () => {
  const { projects, loading, error } = useProjects(ICONS);
  const toast = useToast();
  const modal = useModal();
  const { openApps, toggleApp, closeApp, isAppOpen, openAppCount } =
    useAppManager();

  const scrollToProjects = React.useCallback(() => {
    const firstProject = document.getElementById('project-1');
    firstProject?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleToggleProject = React.useCallback(
    (project) => {
      const appUrl = project?.appPath;

      if (!appUrl) {
        // Fallback to GitHub if no app URL
        const githubUrl = project?.githubPath;
        if (githubUrl) {
          window.open(githubUrl, '_blank', 'noopener,noreferrer');
          toast.show(`✓ ${project?.title} auf GitHub geöffnet`);
        } else {
          toast.show('⚠️ Keine URL gefunden');
        }
        return;
      }

      const wasOpen = isAppOpen(project.id);
      toggleApp(project);

      if (wasOpen) {
        toast.show(`✓ ${project?.title} geschlossen`);
      } else {
        toast.show(`✓ ${project?.title} geöffnet`);

        // Scroll to app after opening
        setTimeout(() => {
          const projectElement = document.getElementById(
            `project-${project.id}`,
          );
          if (projectElement) {
            projectElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }
        }, 100);
      }
    },
    [toggleApp, isAppOpen, toast],
  );

  const handleModalOverlayClick = React.useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        modal.close();
      }
    },
    [modal],
  );

  if (error) {
    return h(
      'section',
      { className: 'snap-section' },
      h(
        'div',
        { className: 'loading-container' },
        h('p', { className: 'error-message' }, error),
      ),
    );
  }

  const projectSections = React.useMemo(() => {
    return projects.map((project, index) => {
      const isVisible = index < 3;
      const isAppOpenState = isAppOpen(project.id);
      const appUrl = project?.appPath;

      return h(
        'section',
        {
          key: `project-${project.id}`,
          id: `project-${project.id}`,
          className: `snap-section ${isAppOpenState ? 'snap-section-expanded' : ''}`,
        },
        h(
          'div',
          {
            style: {
              width: '100%',
              maxWidth: isAppOpenState ? 'none' : '1200px',
              margin: '0 auto',
            },
          },
          h(
            'div',
            {
              className: `project-card ${isAppOpenState ? 'project-card-expanded' : ''}`,
            },
            // Show full app or normal card content
            isAppOpenState
              ? // Full App View
                h(
                  'div',
                  { className: 'app-fullscreen' },
                  h(
                    'div',
                    { className: 'app-header' },
                    h('h2', { className: 'app-title' }, project.title),
                    h(
                      'div',
                      { className: 'app-header-actions' },
                      h(
                        'button',
                        {
                          className:
                            'btn btn-outline btn-small app-fullscreen-btn',
                          onClick: () => {
                            const iframe = document.querySelector(
                              `#project-${project.id} .app-iframe`,
                            );
                            if (iframe) {
                              try {
                                const element = iframe;
                                if (
                                  'requestFullscreen' in element &&
                                  typeof element.requestFullscreen ===
                                    'function'
                                ) {
                                  element.requestFullscreen();
                                } else if (
                                  'webkitRequestFullscreen' in element &&
                                  typeof element.webkitRequestFullscreen ===
                                    'function'
                                ) {
                                  element.webkitRequestFullscreen();
                                } else if (
                                  'msRequestFullscreen' in element &&
                                  typeof element.msRequestFullscreen ===
                                    'function'
                                ) {
                                  element.msRequestFullscreen();
                                }
                              } catch (error) {
                                console.warn(
                                  'Fullscreen not supported:',
                                  error,
                                );
                              }
                            }
                          },
                          'aria-label': `${project.title} im Vollbild öffnen`,
                        },
                        'Vollbild',
                      ),
                      h(
                        'button',
                        {
                          className: 'btn btn-outline btn-small app-close-btn',
                          onClick: () => handleToggleProject(project),
                          'aria-label': `${project.title} schließen`,
                        },
                        'Schließen',
                      ),
                    ),
                  ),
                  h(
                    'div',
                    {
                      className: 'app-content',
                    },
                    h(
                      'div',
                      {
                        className: 'app-iframe-wrapper',
                        onMouseDown: (e) => {
                          // Ensure iframe gets focus when clicked
                          const iframe =
                            e.currentTarget.querySelector('.app-iframe');
                          if (iframe) {
                            setTimeout(() => {
                              if (
                                'focus' in iframe &&
                                typeof iframe.focus === 'function'
                              ) {
                                iframe.focus();
                              }
                              try {
                                if (
                                  iframe.contentWindow &&
                                  'focus' in iframe.contentWindow
                                ) {
                                  iframe.contentWindow.focus();
                                }
                              } catch (e) {
                                // Cross-origin restriction, ignore
                              }
                            }, 10);
                          }
                        },
                      },
                      h('iframe', {
                        className: 'app-iframe card-integrated-iframe',
                        src: appUrl,
                        scrolling: 'auto',
                        sandbox:
                          'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-pointer-lock allow-top-navigation-by-user-activation',
                        frameBorder: '0',
                        title: `App: ${project.title}`,
                        loading: 'eager',
                        allow:
                          'fullscreen; clipboard-read; clipboard-write; autoplay',
                        referrerPolicy: 'strict-origin-when-cross-origin',
                        tabIndex: 0,
                        style: {
                          width: '100%',
                          height: '100%',
                          minHeight: '500px',
                          border: 'none',
                          borderRadius: '0 0 2rem 2rem',
                          background: '#ffffff',
                          pointerEvents: 'auto',
                          userSelect: 'auto',
                        },
                        onLoad: (e) => {
                          // Ensure iframe is properly loaded and interactive
                          const iframe = e.target;
                          try {
                            if (iframe && 'contentWindow' in iframe) {
                              // Force focus to make iframe interactive - multiple attempts
                              const focusIframe = () => {
                                if (
                                  'focus' in iframe &&
                                  typeof iframe.focus === 'function'
                                ) {
                                  iframe.focus();
                                }
                                // Also try to focus the content window
                                try {
                                  if (
                                    iframe.contentWindow &&
                                    'focus' in iframe.contentWindow
                                  ) {
                                    iframe.contentWindow.focus();
                                  }
                                } catch (e) {
                                  // Cross-origin restriction, ignore
                                }
                              };

                              // Focus immediately and after a delay
                              focusIframe();
                              setTimeout(focusIframe, 100);
                              setTimeout(focusIframe, 500);

                              log.debug(
                                `App ${project.title} loaded successfully`,
                              );
                            }
                          } catch (error) {
                            log.warn(
                              `App ${project.title} may have loading issues:`,
                              error,
                            );
                          }
                        },
                        onError: (e) => {
                          log.error(`Failed to load app ${project.title}:`, e);
                          // Show error state without trying to access iframe content
                          const iframe = e.target;
                          if (iframe && iframe.parentElement) {
                            // Create error message element
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'app-error';
                            errorDiv.innerHTML = `
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem; text-align: center;">
                              <p style="margin: 0 0 1rem 0; color: #dc2626;">Fehler beim Laden der App</p>
                              <button 
                                onclick="this.parentElement.parentElement.previousElementSibling.src = this.parentElement.parentElement.previousElementSibling.src; this.parentElement.parentElement.remove();"
                                style="padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; cursor: pointer;"
                              >
                                Erneut versuchen
                              </button>
                            </div>
                          `;
                            iframe.style.display = 'none';
                            iframe.parentElement.appendChild(errorDiv);
                          }
                        },
                      }),
                    ),
                  ),
                )
              : // Normal Card View
                h(
                  Fragment,
                  null,
                  h(
                    'div',
                    { className: 'window-mockup' },
                    h(
                      'div',
                      { className: 'mockup-content' },
                      isVisible
                        ? h(ProjectMockup, {
                            project,
                            isAppOpen: false,
                            appUrl: null,
                          })
                        : h('div', { className: 'u-center' }, 'Loading...'),
                      h('div', { className: 'mockup-icon' }, project.icon),
                    ),
                  ),
                  h(
                    'div',
                    { className: 'project-info' },
                    h(
                      'div',
                      { className: 'project-header' },
                      h('h2', { className: 'project-title' }, project.title),
                      h(
                        'span',
                        { className: 'project-category' },
                        project.category,
                      ),
                    ),
                    h('p', { className: 'project-desc' }, project.description),
                    h(
                      'div',
                      { className: 'tags-container' },
                      ...(project.tags?.map((tag, i) =>
                        h(
                          'span',
                          {
                            key: `tag-${project.id}-${i}-${tag}`,
                            className: 'tag',
                          },
                          tag,
                        ),
                      ) || []),
                    ),
                    h(
                      'div',
                      { className: 'project-actions' },
                      h(
                        'button',
                        {
                          className: 'btn btn-primary btn-small',
                          onClick: () => handleToggleProject(project),
                          'aria-label': `${project.title} öffnen`,
                        },
                        h(Rocket, { style: ICON_SIZES.small }),
                        'App öffnen',
                      ),
                      h(
                        'a',
                        {
                          className: 'btn btn-outline btn-small',
                          href: project.githubPath,
                          target: '_blank',
                          rel: 'noopener noreferrer',
                          'aria-label': `Quellcode von ${project.title} auf GitHub ansehen`,
                        },
                        h(Github, { style: ICON_SIZES.small }),
                        'Code',
                      ),
                    ),
                  ),
                ),
          ),
        ),
      );
    });
  }, [projects, isAppOpen, handleToggleProject]);

  return h(
    Fragment,
    null,
    // Hero Section
    h(
      'section',
      { className: 'snap-section hero-section', id: 'hero' },
      h(
        'div',
        { className: 'container' },
        h(
          'div',
          { className: 'headline-animation' },
          h(
            'div',
            { className: 'floating-icons' },
            h(Code, {
              className: 'icon-float icon-1',
              style: ICON_SIZES.large,
            }),
            h(Sparkles, {
              className: 'icon-float icon-2',
              style: { width: '2rem', height: '2rem' },
            }),
            h(Palette, {
              className: 'icon-float icon-3',
              style: ICON_SIZES.large,
            }),
            h(Rocket, {
              className: 'icon-float icon-4',
              style: ICON_SIZES.xlarge,
            }),
          ),
          h(
            'p',
            { className: 'headline-text' },
            'Entdecke meine interaktiven Web-Projekte – von experimentellen Prototypen bis zu vollständigen Anwendungen. Alle Projekte werden dynamisch aus meinem GitHub Repository geladen.',
          ),
        ),

        loading
          ? h(
              'div',
              { className: 'hero-stats loading' },
              h(
                'div',
                { className: 'stat-item' },
                h(Sparkles, { style: ICON_SIZES.medium }),
                h('span', { className: 'stat-label' }, 'Lade Projekte...'),
              ),
            )
          : h(
              'div',
              { className: 'hero-stats' },
              h(
                'div',
                { className: 'stat-item' },
                h(Rocket, {
                  style: { ...ICON_SIZES.medium, color: '#60a5fa' },
                }),
                h('span', { className: 'stat-value' }, projects.length),
                h(
                  'span',
                  { className: 'stat-label' },
                  projects.length === 1 ? 'Projekt' : 'Projekte',
                ),
              ),
              h('div', { className: 'stat-divider' }),
              h(
                'div',
                { className: 'stat-item' },
                h(Code, { style: { ...ICON_SIZES.medium, color: '#34d399' } }),
                h(
                  'span',
                  { className: 'stat-value' },
                  new Set(projects.flatMap((p) => p.tags || [])).size,
                ),
                h('span', { className: 'stat-label' }, 'Technologien'),
              ),
              h('div', { className: 'stat-divider' }),
              h(
                'div',
                { className: 'stat-item' },
                h(Github, {
                  style: { ...ICON_SIZES.medium, color: '#a78bfa' },
                }),
                h('span', { className: 'stat-value' }, openAppCount || 'Open'),
                h(
                  'span',
                  { className: 'stat-label' },
                  openAppCount > 0 ? 'Apps offen' : 'Source',
                ),
              ),
            ),

        h(
          'div',
          { className: 'btn-group' },
          h(
            'button',
            {
              onClick: scrollToProjects,
              className: 'btn btn-primary btn-compact',
              disabled: loading,
              'aria-label': 'Zu den Projekten scrollen',
            },
            loading ? 'Lade...' : 'Projekte ansehen',
            loading
              ? h(Sparkles, { style: ICON_SIZES.small })
              : h(ArrowDown, { style: ICON_SIZES.small }),
          ),
          !loading &&
            projects.length > 0 &&
            h(
              'a',
              {
                href: 'https://github.com/Abdulkader-Safi?tab=repositories',
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'btn btn-outline btn-compact',
                'aria-label': 'GitHub Repositories ansehen',
              },
              h(Github, { style: ICON_SIZES.small }),
              'Alle auf GitHub',
            ),
        ),
      ),
    ),

    // Loading State
    loading &&
      h(
        'section',
        { className: 'snap-section' },
        h(
          'div',
          { className: 'loading-container' },
          h('div', { className: 'loading-spinner' }),
          h('p', null, 'Lade Projekte aus GitHub Repository...'),
        ),
      ),

    // Error State
    error &&
      h(
        'section',
        { className: 'snap-section' },
        h(
          'div',
          { className: 'loading-container' },
          h('p', { className: 'error-message' }, error),
        ),
      ),

    // Projects Sections
    ...projectSections,

    // Toast Notification
    toast.message &&
      h(
        'div',
        {
          className: 'toast-notification',
          role: 'status',
          'aria-live': 'polite',
        },
        toast.message,
      ),

    // Modal Preview
    modal.isOpen &&
      h(
        'div',
        {
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'modal-title',
          className: 'modal-overlay',
          onClick: handleModalOverlayClick,
        },
        h(
          'div',
          { className: 'modal-wrapper' },
          h(
            'div',
            { className: 'modal-header' },
            h(
              'div',
              { className: 'modal-header-title' },
              h('strong', { id: 'modal-title' }, modal.title),
            ),
            h(
              'div',
              { className: 'modal-header-actions' },
              h(
                'a',
                {
                  href: modal.url,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  className: 'btn btn-outline btn-small',
                  'aria-label': 'In neuem Tab öffnen',
                },
                h(ExternalLink, { style: ICON_SIZES.xsmall }),
                'Neuer Tab',
              ),
              h(
                'button',
                {
                  className: 'btn btn-primary btn-small',
                  onClick: modal.close,
                  'aria-label': 'Modal schließen',
                },
                'Schließen',
              ),
            ),
          ),
          h(
            'div',
            { className: 'modal-body' },
            modal.isLoading &&
              h(
                'div',
                { className: 'iframe-loader', 'aria-live': 'polite' },
                h('div', { className: 'loading-spinner' }),
                h('p', { style: { marginTop: '1rem' } }, 'Lade Vorschau…'),
              ),
            h('iframe', {
              src: modal.url,
              onLoad: modal.handleLoad,
              className: 'modal-iframe',
              sandbox:
                'allow-scripts allow-same-origin allow-forms allow-popups',
              title: `Vorschau: ${modal.title}`,
              loading: 'lazy',
            }),
          ),
        ),
      ),
  );
};

/**
 * Initialize React Projects App
 */
export const initReactProjectsApp = () => {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    log.error('Root element #root not found in DOM');
    return;
  }

  try {
    log.info('Initializing React Projects App...');
    const root = createRoot(rootEl);
    root.render(h(App));
    log.info('React Projects App rendered successfully');
  } catch (error) {
    log.error('Failed to render React Projects App:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unbekannter Fehler';

    rootEl.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #ef4444; background: rgba(0,0,0,0.8); border-radius: 1rem; margin: 2rem;">
        <h2>Fehler beim Laden der Projekte</h2>
        <p><strong>Details:</strong> ${errorMessage}</p>
        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; background: #4444ff; color: white; border: none; border-radius: 4px;">
          Seite neu laden
        </button>
      </div>
    `;
  }
};
