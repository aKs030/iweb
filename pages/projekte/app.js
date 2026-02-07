/**
 * React Projects App - 3D Space Edition
 * @version 8.0.0 - Deep cleanup
 * @description 3D Scroll-based Gallery using Three.js and React
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { useProjects } from './hooks/useProjects.js';
import { ThreeScene } from './components/ThreeScene.js';
import * as Icons from '/content/components/ui/icons.js';

const { createElement: h, Fragment, useState } = React;

/**
 * Main App Component
 */
const App = () => {
  const { projects, loading, error } = useProjects(Icons);

  // State for the currently focused project index (controlled by scroll in ThreeScene)
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);

  // Update active project based on scroll
  const handleScrollUpdate = (index) => {
    setActiveProjectIndex(index);
  };

  if (loading) {
    return h(
      'div',
      { className: 'hud-container' },
      h(
        'div',
        { style: { color: 'white', margin: 'auto' } },
        'Loading Space...',
      ),
    );
  }

  if (error) {
    return h('div', { style: { color: 'red', padding: '2rem' } }, error);
  }

  const activeProject = projects[activeProjectIndex];

  return h(
    Fragment,
    null,
    // 3D Canvas Container
    h(
      'div',
      { id: 'canvas-container' },
      projects.length > 0 &&
        h(ThreeScene, {
          projects,
          onScrollUpdate: handleScrollUpdate,
          onReady: () => {}, // Empty callback since we don't need scene ready state
        }),
    ),

    // HUD Overlay
    h(
      'div',
      { className: 'hud-container' },

      // Active Project Info Panel
      activeProject &&
        h(
          'div',
          {
            className: 'hud-panel visible',
            key: activeProject.id,
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
    console.error('Failed to init projekte app:', error);
  }
};
