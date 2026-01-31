/**
 * GitHub Repository Configuration
 * @version 3.0.0
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
 * Project categories with icons and themes
 */
export const PROJECT_CATEGORIES = {
  game: {
    icon: 'Gamepad2',
    theme: 'purple',
    keywords: ['game', 'spiel', 'puzzle', 'entertainment', 'play'],
  },
  puzzle: {
    icon: 'Binary',
    theme: 'green',
    keywords: ['logic', 'puzzle', 'math', 'brain', 'number', 'riddle'],
  },
  ui: {
    icon: 'Palette',
    theme: 'pink',
    keywords: ['ui', 'design', 'css', 'color', 'theme', 'style', 'visual'],
  },
  productivity: {
    icon: 'ListTodo',
    theme: 'cyan',
    keywords: ['todo', 'productivity', 'crud', 'task', 'organize', 'list'],
  },
  web: {
    icon: 'Globe',
    theme: 'orange',
    keywords: ['api', 'web', 'fetch', 'ajax', 'http', 'rest', 'network'],
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
