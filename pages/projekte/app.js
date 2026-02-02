/**
 * React Projects App - 3D Space Edition
 * @version 6.0.0
 * @description 3D Scroll-based Gallery using Three.js and React
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { createLogger } from '/content/core/logger.js';
import { createUseTranslation } from '/content/core/react-utils.js';
import { useProjects } from './hooks/index.js';
import { ThreeScene } from './components/ThreeScene.js';

// eslint-disable-next-line no-unused-vars
const log = createLogger('react-projekte-app');
const { createElement: h, Fragment, useState } = React;
const useTranslation = createUseTranslation(React);

/**
 * Main App Component
 */
const App = () => {
  const { projects, loading, error } = useProjects({});
  // eslint-disable-next-line no-unused-vars
  const { t } = useTranslation();

  // State for the currently focused project index (controlled by scroll in ThreeScene)
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);
  const [isSceneReady, setIsSceneReady] = useState(false);

  // We will pass this setter to the Three.js component to update the UI
  const handleScrollUpdate = (index) => {
    setActiveProjectIndex(index);
  };

  if (loading)
    return h(
      'div',
      { className: 'hud-container' },
      h(
        'div',
        { style: { color: 'white', margin: 'auto' } },
        'Loading Space...',
      ),
    );
  if (error)
    return h('div', { style: { color: 'red', padding: '2rem' } }, error);

  const activeProject = projects[activeProjectIndex];

  return h(
    Fragment,
    null,
    // 1. The 3D Canvas Container (Logic will be injected here)
    h(
      'div',
      { id: 'canvas-container' },
      projects.length > 0 &&
        h(ThreeScene, {
          projects,
          onScrollUpdate: handleScrollUpdate,
          onReady: () => setIsSceneReady(true),
        }),
    ),

    // 2. The HUD Overlay
    h(
      'div',
      { className: 'hud-container' },

      // Active Project Info Panel
      activeProject &&
        h(
          'div',
          {
            className: `hud-panel ${isSceneReady ? 'visible' : 'visible' /* temporary for dev */}`,
            key: activeProject.id, // Re-render animation on change
          },
          h(
            'span',
            { className: 'hud-category' },
            activeProject.category || 'Project',
          ),
          h('h1', { className: 'hud-title' }, activeProject.title),
          h('p', { className: 'hud-desc' }, activeProject.description),

          h(
            'div',
            { className: 'hud-actions' },
            activeProject.appPath &&
              h(
                'a',
                {
                  href: activeProject.appPath,
                  target: '_blank',
                  className: 'btn btn-primary',
                },
                'Open App',
              ),

            activeProject.githubPath &&
              h(
                'a',
                {
                  href: activeProject.githubPath,
                  target: '_blank',
                  className: 'btn btn-outline',
                },
                'GitHub',
              ),
          ),
        ),

      // Scroll Indicator
      h('div', { className: 'scroll-hint' }, 'SCROLL TO EXPLORE'),
    ),
  );
};

export const initReactProjectsApp = () => {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;

  try {
    const root = createRoot(rootEl);
    root.render(h(App));
  } catch (error) {
    console.error('Failed to init app:', error);
  }
};
