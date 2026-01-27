/**
 * Projects Data Configuration - Modernized & Compact
 * @version 3.0.0
 */

import { GITHUB_CONFIG, PROJECT_CATEGORIES } from './github-config.js';

// URL Conversion utilities
export const GitHubUrlConverter = {
  toRawGithack: (ghUrl) => {
    try {
      const m = /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/.exec(
        ghUrl,
      );
      if (m) {
        const [, owner, repo, branch, path] = m;
        return `https://rawcdn.githack.com/${owner}/${repo}/${branch}/${path}/index.html`;
      }
    } catch {
      /* ignore */
    }
    return '';
  },

  toJsDelivr: (ghUrl) => {
    try {
      const m = /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/.exec(
        ghUrl,
      );
      if (m) {
        const [, owner, repo, branch, path] = m;
        return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}/index.html`;
      }
    } catch {
      /* ignore */
    }
    return '';
  },

  toRaw: (ghUrl) => {
    try {
      const m = /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/.exec(
        ghUrl,
      );
      if (m) {
        const [, owner, repo, branch, path] = m;
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}/index.html`;
      }
    } catch {
      /* ignore */
    }
    return '';
  },
};

// Common styles for consistency
const ICON_SIZE = { width: '32px', height: '32px' };

// Default Open Graph image
const DEFAULT_OG_IMAGE =
  'https://www.abdulkerimsesli.de/content/assets/img/og/og-projekte-800.webp';

// Theme colors for consistent design system
const THEME_COLORS = {
  purple: {
    icon: '#c084fc',
    gradient: ['rgba(99, 102, 241, 0.2)', 'rgba(168, 85, 247, 0.2)'],
  },
  green: {
    icon: '#34d399',
    gradient: ['rgba(34, 197, 94, 0.2)', 'rgba(16, 185, 129, 0.2)'],
  },
  pink: {
    icon: '#f472b6',
    gradient: ['rgba(249, 115, 22, 0.2)', 'rgba(236, 72, 153, 0.2)'],
  },
  cyan: {
    icon: '#22d3ee',
    gradient: ['rgba(59, 130, 246, 0.2)', 'rgba(6, 182, 212, 0.2)'],
  },
  orange: {
    icon: '#fb923c',
    gradient: ['rgba(251, 146, 60, 0.2)', 'rgba(249, 115, 22, 0.2)'],
  },
  indigo: {
    icon: '#818cf8',
    gradient: ['rgba(129, 140, 248, 0.2)', 'rgba(99, 102, 241, 0.2)'],
  },
};

/**
 * Helper function to create gradient backgrounds
 */
const createGradient = (colors) => ({
  background: `linear-gradient(to bottom right, ${colors[0]}, ${colors[1]})`,
});

/**
 * Fetches repository contents from GitHub API
 */
async function fetchGitHubContents(path = '') {
  const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Projekte-Loader/1.0',
      },
    });

    if (!response.ok) {
      console.error(
        `GitHub API error: ${response.status} - ${response.statusText}`,
      );
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Failed to fetch GitHub contents:`, error);
    return [];
  }
}

/**
 * Fetches project metadata from package.json or README
 */
async function fetchProjectMetadata(projectPath) {
  const metadataUrl = `${GITHUB_CONFIG.rawBase}/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${projectPath}/package.json`;

  try {
    console.log(`🔍 Checking metadata for: ${projectPath}`);
    const packageResponse = await fetch(metadataUrl, { method: 'HEAD' });

    if (packageResponse.ok) {
      const contentResponse = await fetch(metadataUrl);
      if (contentResponse.ok) {
        const packageData = await contentResponse.json();
        console.log(`✅ Found package.json for ${projectPath}:`, packageData);
        return {
          title: packageData.name || projectPath.split('/').pop(),
          description:
            packageData.description || 'Ein interaktives Web-Projekt',
          tags: packageData.keywords || ['JavaScript'],
          category: packageData.category || 'App',
          version: packageData.version || '1.0.0',
        };
      }
    }
  } catch (error) {
    console.warn(`⚠️ Could not fetch metadata for ${projectPath}:`, error);
  }

  // Default metadata
  const defaultMeta = {
    title: projectPath
      .split('/')
      .pop()
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase()),
    description: 'Ein interaktives Web-Projekt',
    tags: ['JavaScript'],
    category: 'App',
    version: '1.0.0',
  };

  console.log(`📝 Using default metadata for ${projectPath}:`, defaultMeta);
  return defaultMeta;
}

/**
 * Maps project to appropriate icon and theme
 */
function getProjectIconAndTheme(project, icons, html) {
  const title = project.title.toLowerCase();
  const tags = project.tags.map((tag) => tag.toLowerCase());
  const category = project.category.toLowerCase();
  const description = project.description.toLowerCase();

  const allText = `${title} ${tags.join(' ')} ${category} ${description}`;

  let bestMatch = PROJECT_CATEGORIES.default;
  let maxMatches = 0;

  for (const [categoryKey, categoryData] of Object.entries(
    PROJECT_CATEGORIES,
  )) {
    if (categoryKey === 'default') continue;

    const matches = categoryData.keywords.filter((keyword) =>
      allText.includes(keyword),
    ).length;

    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = categoryData;
    }
  }

  const IconComponent = icons[bestMatch.icon] || icons.Code;
  const theme = THEME_COLORS[bestMatch.theme] || THEME_COLORS.indigo;

  return {
    icon: html`<${IconComponent}
      style=${{ color: theme.icon, ...ICON_SIZE }}
    />`,
    theme: theme,
  };
}

/**
 * Loads projects dynamically from GitHub repository
 */
async function loadDynamicProjects(html, icons) {
  try {
    console.log(`🚀 Starting dynamic project loading...`);
    const contents = await fetchGitHubContents(GITHUB_CONFIG.appsPath);

    if (!contents || contents.length === 0) {
      console.warn(`⚠️ No contents found in ${GITHUB_CONFIG.appsPath}`);
      return [];
    }

    const projects = [];
    const directories = contents.filter((item) => item.type === 'dir');

    console.log(
      `📁 Found ${directories.length} directories:`,
      directories.map((d) => d.name),
    );

    for (let i = 0; i < directories.length; i++) {
      const dir = directories[i];
      const projectPath = `${GITHUB_CONFIG.appsPath}/${dir.name}`;

      console.log(
        `🔄 Processing project ${i + 1}/${directories.length}: ${dir.name}`,
      );

      if (i > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, GITHUB_CONFIG.requestDelay || 100),
        );
      }

      const metadata = await fetchProjectMetadata(projectPath);
      const { icon, theme } = getProjectIconAndTheme(metadata, icons, html);

      const project = {
        id: i + 1,
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        category: metadata.category,
        datePublished: new Date().toISOString().split('T')[0],
        image: DEFAULT_OG_IMAGE,
        appPath: `/projekte/apps/${dir.name}/`,
        githubPath: `${GITHUB_CONFIG.repoBase}/${projectPath}`,
        bgStyle: createGradient(theme.gradient),
        glowColor: theme.icon,
        icon: icon,
        previewContent: html`
          <div className="preview-container">${icon}</div>
        `,
      };

      projects.push(project);
      console.log(`✅ Added project: ${project.title}`);
    }

    if (projects.length > 0) {
      console.log(
        `🎉 Successfully loaded ${projects.length} projects from GitHub`,
      );
    } else {
      console.warn(`⚠️ No projects were loaded from GitHub`);
    }

    return projects;
  } catch (error) {
    console.error(`❌ Failed to load dynamic projects:`, error);
    return [];
  }
}

/**
 * Static fallback projects
 */
function getStaticFallbackProjects(html, icons) {
  const { Gamepad2, Binary, Palette, ListTodo } = icons;

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
      githubPath: `${GITHUB_CONFIG.repoBase}/${GITHUB_CONFIG.appsPath}/schere-stein-papier`,
      bgStyle: createGradient(THEME_COLORS.purple.gradient),
      glowColor: '#5586f7ff',
      icon: html`<${Gamepad2}
        style=${{ color: THEME_COLORS.purple.icon, ...ICON_SIZE }}
      />`,
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
      githubPath: `${GITHUB_CONFIG.repoBase}/${GITHUB_CONFIG.appsPath}/zahlen-raten`,
      bgStyle: createGradient(THEME_COLORS.green.gradient),
      glowColor: '#10b981',
      icon: html`<${Binary}
        style=${{ color: THEME_COLORS.green.icon, ...ICON_SIZE }}
      />`,
      previewContent: html`
        <div className="preview-container">
          <span
            style=${{
              fontSize: '4rem',
              color: THEME_COLORS.green.icon,
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
      githubPath: `${GITHUB_CONFIG.repoBase}/${GITHUB_CONFIG.appsPath}/color-changer`,
      bgStyle: createGradient(THEME_COLORS.pink.gradient),
      glowColor: '#ec4899',
      icon: html`<${Palette}
        style=${{ color: THEME_COLORS.pink.icon, ...ICON_SIZE }}
      />`,
      previewContent: html`
        <div className="preview-container">
          <${Palette}
            style=${{
              color: THEME_COLORS.pink.icon,
              width: '4rem',
              height: '4rem',
            }}
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
      githubPath: `${GITHUB_CONFIG.repoBase}/${GITHUB_CONFIG.appsPath}/todo-liste`,
      bgStyle: createGradient(THEME_COLORS.cyan.gradient),
      glowColor: '#06b6d4',
      icon: html`<${ListTodo}
        style=${{ color: THEME_COLORS.cyan.icon, ...ICON_SIZE }}
      />`,
      previewContent: html`
        <div className="preview-container">
          <${ListTodo}
            style=${{
              color: THEME_COLORS.cyan.icon,
              width: '4rem',
              height: '4rem',
            }}
          />
        </div>
      `,
    },
  ];
}

/**
 * Creates the projects array with dynamic loading and static fallback
 */
export async function createProjectsData(html, icons) {
  console.log(`🎯 Starting createProjectsData...`);

  const dynamicProjects = await loadDynamicProjects(html, icons);

  if (dynamicProjects.length > 0) {
    console.log(
      `🎉 Using ${dynamicProjects.length} dynamic projects from GitHub`,
    );
    return dynamicProjects;
  }

  console.log(`⚠️ No dynamic projects found, falling back to static projects`);
  return getStaticFallbackProjects(html, icons);
}
