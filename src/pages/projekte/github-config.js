/**
 * GitHub Repository Configuration - Cleaned Up
 * @version 2.0.0
 */

export const GITHUB_CONFIG = {
  // Repository details
  owner: 'aKs030',
  repo: 'Webgame',
  branch: 'main',
  appsPath: 'apps',

  // API endpoints
  apiBase: 'https://api.github.com',
  rawBase: 'https://raw.githubusercontent.com',
  repoBase: 'https://github.com/aKs030/Webgame/tree/main',

  // Rate limiting
  requestDelay: 100, // ms between requests
};

/**
 * Default project categories and their associated icons/themes
 */
export const PROJECT_CATEGORIES = {
  game: {
    icon: 'Gamepad2',
    theme: 'purple',
    keywords: ['game', 'spiel', 'puzzle', 'entertainment'],
  },
  puzzle: {
    icon: 'Binary',
    theme: 'green',
    keywords: ['logic', 'puzzle', 'math', 'brain', 'number'],
  },
  ui: {
    icon: 'Palette',
    theme: 'pink',
    keywords: ['ui', 'design', 'css', 'color', 'theme', 'style'],
  },
  productivity: {
    icon: 'ListTodo',
    theme: 'cyan',
    keywords: ['todo', 'productivity', 'crud', 'task', 'organize'],
  },
  web: {
    icon: 'Globe',
    theme: 'orange',
    keywords: ['api', 'web', 'fetch', 'ajax', 'http', 'rest'],
  },
  utility: {
    icon: 'Zap',
    theme: 'indigo',
    keywords: ['tool', 'utility', 'helper', 'converter', 'calculator'],
  },
  default: {
    icon: 'Code',
    theme: 'indigo',
    keywords: [],
  },
};
