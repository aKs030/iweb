/**
 * Projects Data Configuration - Modernized & Compact
 * @version 3.1.0
 */

import { createLogger } from '/content/core/logger.js';
import { sleep } from '/content/core/utils.js';
import localAppsConfig from './apps-config.json';
import { GITHUB_CONFIG, PROJECT_CATEGORIES } from './github-config.js';
import {
  fetchGitHubContents as fetchGitHubContentsApi,
  fetchProjectMetadata as fetchProjectMetadataApi,
} from './project-utils.js';

const log = createLogger('ProjectsData');

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

// Cache Configuration
const CACHE_PREFIX = 'github_contents_';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Cache Helpers
 */
const getCache = (key) => {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;

    const { data, timestamp } = JSON.parse(item);
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const setCache = (key, data) => {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, timestamp: Date.now() }),
    );
  } catch (e) {
    log.warn('Cache write failed:', e);
  }
};

/**
 * Helper function to create gradient backgrounds
 */
const createGradient = (colors) => ({
  background: `linear-gradient(to bottom right, ${colors[0]}, ${colors[1]})`,
});

/**
 * Fetches repository contents from GitHub API (with Caching)
 */
const fetchGitHubContents = async (path = '') => {
  const cacheKey = `contents_${path}`;
  const cached = getCache(cacheKey);
  if (cached) {
    log.debug(`Using cached GitHub contents for: ${path}`);
    return cached;
  }

  try {
    log.debug(`Fetching GitHub contents from: ${path}`);
    const data = await fetchGitHubContentsApi(path);
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    log.error(`Failed to fetch GitHub contents:`, error);
    throw error;
  }
};

/**
 * Fetches project metadata from package.json or README (with Caching)
 */
const fetchProjectMetadata = async (projectPath) => {
  const cacheKey = `metadata_${projectPath}`;
  const cached = getCache(cacheKey);
  if (cached) {
    log.debug(`Using cached metadata for: ${projectPath}`);
    return cached;
  }

  const metadata = await fetchProjectMetadataApi(projectPath);

  // Only cache if we got real data (indicated by presence of 'raw' field from our utility)
  if (metadata.raw) {
    // eslint-disable-next-line no-unused-vars
    const { raw, ...cleanMetadata } = metadata;
    setCache(cacheKey, cleanMetadata);
    return cleanMetadata;
  }

  return metadata;
};

/**
 * Maps project to appropriate icon and theme
 */
const getProjectIconAndTheme = (project, icons, html) => {
  const title = (project.title || '').toLowerCase();
  const tags = (project.tags || []).map((tag) => tag.toLowerCase());
  const category = (project.category || '').toLowerCase();
  const description = (project.description || '').toLowerCase();

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
};

/**
 * Loads projects from local config (bundled)
 */
const loadLocalConfig = () => {
  log.info(`Loading local apps config (bundled)...`);
  return localAppsConfig.apps || [];
};

/**
 * Loads projects dynamically from GitHub repository
 */
const loadDynamicProjects = async (html, icons) => {
  let projectsList = [];
  let source = 'github';

  try {
    log.info(`Starting dynamic project loading...`);
    const contents = await fetchGitHubContents(GITHUB_CONFIG.appsPath);

    if (!contents || contents.length === 0) {
      throw new Error('No contents found in GitHub');
    }

    const directories = contents.filter((item) => item.type === 'dir');

    log.info(
      `Found ${directories.length} directories on GitHub:`,
      directories.map((d) => d.name),
    );

    for (const [i, dir] of directories.entries()) {
      const projectPath = `${GITHUB_CONFIG.appsPath}/${dir.name}`;

      if (i > 0 && source === 'github') {
        // Only delay if we are actually fetching from GitHub (not needed if fully cached, but delay is safe)
        // Note: fetchProjectMetadataApi inside fetchProjectMetadata handles the network request,
        // but since we check cache first, we might not need delay.
        // However, to be safe and consistent with previous logic:
        await sleep(GITHUB_CONFIG.requestDelay || 50);
      }

      const metadata = await fetchProjectMetadata(projectPath);
      projectsList.push({ ...metadata, dirName: dir.name });
    }
  } catch (error) {
    log.error(`Failed to load dynamic projects from GitHub:`, error);
    log.info(`Falling back to local bundled config`);
    source = 'local';

    const localApps = loadLocalConfig();
    projectsList = localApps.map((app) => ({
      ...app,
      dirName: app.name, // local config has 'name' which corresponds to directory
    }));
  }

  // Process the projects list (from GitHub or Local) to create UI objects
  const currentDate = new Date().toISOString().split('T')[0]; // ✅ Create once, reuse
  const finalProjects = projectsList.map((data, i) => {
    const { icon, theme } = getProjectIconAndTheme(data, icons, html);
    const dirName = data.dirName || data.name;

    return {
      id: i + 1,
      title: data.title,
      description: data.description,
      tags: data.tags,
      category: data.category,
      datePublished: currentDate,
      image: DEFAULT_OG_IMAGE,
      appPath: `/projekte/apps/${dirName}/`,
      githubPath: `${GITHUB_CONFIG.repoBase}/${GITHUB_CONFIG.appsPath}/${dirName}`,
      bgStyle: createGradient(theme.gradient),
      glowColor: theme.icon,
      icon: icon,
      previewContent: html` <div className="preview-container">${icon}</div> `,
    };
  });

  log.info(`Loaded ${finalProjects.length} projects (Source: ${source})`);
  return finalProjects;
};

/**
 * Creates the projects array with dynamic loading and static fallback
 */
export async function createProjectsData(html, icons) {
  log.info(`Starting createProjectsData...`);
  return await loadDynamicProjects(html, icons);
}
