/**
 * Projects Data Configuration
 * @version 1.0.0
 *
 * This file contains all project definitions for the interactive projects showcase.
 * Separated from the main app logic for better maintainability.
 */

// Note: htm is imported in projekte-app.js and passed via the html parameter

// Common styles for consistency
const ICON_SIZE = { width: '32px', height: '32px' };
const LARGE_ICON_SIZE = { width: '4rem', height: '4rem' };

// Default Open Graph image
const DEFAULT_OG_IMAGE = 'https://abdulkerimsesli.de/content/assets/img/og/og-projekte.png';

/**
 * Creates the projects array with icon and preview components
 * @param {Function} html - htm template function bound to React.createElement
 * @param {Object} icons - Object containing icon components
 * @returns {Array} Array of project objects
 */
export function createProjectsData(html, icons) {
  const { Gamepad2, Binary, Palette, ListTodo, Check } = icons;

  return [
    {
      id: 1,
      title: 'Schere Stein Papier',
      description: 'Der Klassiker gegen den Computer!',
      tags: ['JavaScript', 'Game Logic'],
      category: 'Game',
      datePublished: '2023-07-05',
      image: DEFAULT_OG_IMAGE,
      appPath: '/projekte/apps/schere-stein-papier/',
      githubPath: 'https://github.com/aKs030/Webgame/tree/main/apps/schere-stein-papier',
      bgStyle: {
        background:
          'linear-gradient(to bottom right, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
      },
      glowColor: '#5586f7ff',
      icon: html` <${Gamepad2} style=${{ color: '#c084fc', ...ICON_SIZE }} /> `,
      previewContent: html`
        <div className="preview-container-vs">
          <div style=${{ fontSize: '3rem' }}>🪨</div>
          <div style=${{ fontSize: '1.5rem', opacity: 0.5 }}>VS</div>
          <div style=${{ fontSize: '3rem' }}>✂️</div>
        </div>
      `,
    },
    {
      id: 2,
      title: 'Zahlen Raten',
      description: 'Finde die geheime Zahl zwischen 1 und 100.',
      tags: ['Logic', 'Input'],
      category: 'Puzzle',
      datePublished: '2024-08-01',
      image: DEFAULT_OG_IMAGE,
      appPath: '/projekte/apps/zahlen-raten/',
      githubPath: 'https://github.com/aKs030/Webgame/tree/main/apps/zahlen-raten',
      bgStyle: {
        background:
          'linear-gradient(to bottom right, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2))',
      },
      glowColor: '#10b981',
      icon: html` <${Binary} style=${{ color: '#34d399', ...ICON_SIZE }} /> `,
      previewContent: html`
        <div className="preview-container">
          <span style=${{ fontSize: '4rem', color: '#6ee7b7', fontWeight: 'bold' }}>?</span>
        </div>
      `,
    },
    {
      id: 3,
      title: 'Color Changer',
      description: 'Dynamische Hintergrundfarben per Klick.',
      tags: ['DOM', 'Events'],
      category: 'UI',
      datePublished: '2022-03-15',
      image: DEFAULT_OG_IMAGE,
      appPath: '/projekte/apps/color-changer/',
      githubPath: 'https://github.com/aKs030/Webgame/tree/main/apps/color-changer',
      bgStyle: {
        background:
          'linear-gradient(to bottom right, rgba(249, 115, 22, 0.2), rgba(236, 72, 153, 0.2))',
      },
      glowColor: '#ec4899',
      icon: html` <${Palette} style=${{ color: '#f472b6', ...ICON_SIZE }} /> `,
      previewContent: html`
        <div className="preview-container">
          <${Palette} style=${{ color: '#f472b6', ...LARGE_ICON_SIZE }} />
        </div>
      `,
    },
    {
      id: 4,
      title: 'To-Do Liste',
      description: 'Produktivitäts-Tool zum Verwalten von Aufgaben.',
      tags: ['CRUD', 'Arrays'],
      category: 'App',
      datePublished: '2021-11-05',
      image: DEFAULT_OG_IMAGE,
      appPath: '/projekte/apps/todo-liste/',
      githubPath: 'https://github.com/aKs030/Webgame/tree/main/apps/todo-liste',
      bgStyle: {
        background:
          'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(6, 182, 212, 0.2))',
      },
      glowColor: '#06b6d4',
      icon: html` <${ListTodo} style=${{ color: '#22d3ee', ...ICON_SIZE }} /> `,
      previewContent: html`
        <div className="preview-container">
          <${Check} style=${{ color: '#22d3ee', ...LARGE_ICON_SIZE }} />
        </div>
      `,
    },
  ];
}
