/**
 * Projects Data Configuration
 * @version 1.1.0
 *
 * This file contains all project definitions for the interactive projects showcase.
 * Separated from the main app logic for better maintainability.
 */

// Note: htm is imported in projekte-app.js and passed via the html parameter

// Common styles for consistency
const ICON_SIZE = { width: '32px', height: '32px' };
const LARGE_ICON_SIZE = { width: '4rem', height: '4rem' };

// Preview font sizes
const PREVIEW_FONT = {
  large: '4rem',
  medium: '3rem',
  small: '1.5rem',
};

// GitHub repository base URL
const GITHUB_BASE = 'https://github.com/aKs030/Webgame/tree/main/apps';

// Default Open Graph image
const DEFAULT_OG_IMAGE =
  'https://www.abdulkerimsesli.de/content/assets/img/og/og-projekte-800.webp';

// Theme colors for consistent design system
const THEME_COLORS = {
  purple: {
    icon: '#c084fc',
    preview: '#c084fc',
    gradient: ['rgba(99, 102, 241, 0.2)', 'rgba(168, 85, 247, 0.2)'],
  },
  green: {
    icon: '#34d399',
    preview: '#6ee7b7',
    gradient: ['rgba(34, 197, 94, 0.2)', 'rgba(16, 185, 129, 0.2)'],
  },
  pink: {
    icon: '#f472b6',
    preview: '#f472b6',
    gradient: ['rgba(249, 115, 22, 0.2)', 'rgba(236, 72, 153, 0.2)'],
  },
  cyan: {
    icon: '#22d3ee',
    preview: '#22d3ee',
    gradient: ['rgba(59, 130, 246, 0.2)', 'rgba(6, 182, 212, 0.2)'],
  },
};

/**
 * Helper function to create gradient backgrounds
 * @param {string[]} colors - Array of two gradient colors (rgba format)
 * @returns {Object} Style object with gradient background
 */
const createGradient = (colors) => ({
  background: `linear-gradient(to bottom right, ${colors[0]}, ${colors[1]})`,
});

/**
 * Creates the static projects array (overrides)
 * @param {Function} html - htm template function bound to React.createElement
 * @param {Object} icons - Object containing icon components
 * @returns {Array} Array of project objects
 */
export function getStaticProjects(html, icons) {
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
      githubPath: `${GITHUB_BASE}/schere-stein-papier`,
      bgStyle: createGradient(THEME_COLORS.purple.gradient),
      glowColor: '#5586f7ff',
      icon: html`
        <${Gamepad2}
          style=${{ color: THEME_COLORS.purple.icon, ...ICON_SIZE }}
        />
      `,
      previewContent: html`
        <div className="preview-container-vs">
          <div style=${{ fontSize: PREVIEW_FONT.medium }}>🪨</div>
          <div style=${{ fontSize: PREVIEW_FONT.small, opacity: 0.5 }}>VS</div>
          <div style=${{ fontSize: PREVIEW_FONT.medium }}>✂️</div>
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
      githubPath: `${GITHUB_BASE}/zahlen-raten`,
      bgStyle: createGradient(THEME_COLORS.green.gradient),
      glowColor: '#10b981',
      icon: html`
        <${Binary} style=${{ color: THEME_COLORS.green.icon, ...ICON_SIZE }} />
      `,
      previewContent: html`
        <div className="preview-container">
          <span
            style=${{
              fontSize: PREVIEW_FONT.large,
              color: THEME_COLORS.green.preview,
              fontWeight: 'bold',
            }}
            >?</span
          >
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
      githubPath: `${GITHUB_BASE}/color-changer`,
      bgStyle: createGradient(THEME_COLORS.pink.gradient),
      glowColor: '#ec4899',
      icon: html`
        <${Palette} style=${{ color: THEME_COLORS.pink.icon, ...ICON_SIZE }} />
      `,
      previewContent: html`
        <div className="preview-container">
          <${Palette}
            style=${{ color: THEME_COLORS.pink.preview, ...LARGE_ICON_SIZE }}
          />
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
      githubPath: `${GITHUB_BASE}/todo-liste`,
      bgStyle: createGradient(THEME_COLORS.cyan.gradient),
      glowColor: '#06b6d4',
      icon: html`
        <${ListTodo} style=${{ color: THEME_COLORS.cyan.icon, ...ICON_SIZE }} />
      `,
      previewContent: html`
        <div className="preview-container">
          <${Check}
            style=${{ color: THEME_COLORS.cyan.preview, ...LARGE_ICON_SIZE }}
          />
        </div>
      `,
    },
  ];
}

/**
 * Merges dynamic projects with static overrides
 * Prefers static configuration for presentation if the project exists in both.
 * @param {Array} staticList - The hand-crafted project definitions
 * @param {Array} dynamicList - The projects fetched from GitHub
 * @returns {Array} Merged project list
 */
export function mergeProjects(staticList, dynamicList) {
  // Create a map of static projects by GitHub Path (normalized)
  const staticMap = new Map();
  staticList.forEach((p) => {
    if (p.githubPath) {
      // remove trailing slash and standardize
      const key = p.githubPath.replace(/\/$/, '').toLowerCase();
      staticMap.set(key, p);
    }
  });

  // Map dynamic projects, substituting with static override if available
  const merged = dynamicList.map((dyn) => {
    const key = dyn.githubPath.replace(/\/$/, '').toLowerCase();
    if (staticMap.has(key)) {
      // Use the static version (preserves custom icons, previews, colors)
      return staticMap.get(key);
    }
    return dyn;
  });

  return merged;
}
