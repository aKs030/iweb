/**
 * Projects Data Service
 * @version 8.0.0 - Cleaned up
 */

import React from 'react';
import { createLogger } from '/content/core/logger.js';
import { AppLoadManager } from '/content/core/load-manager.js';
import { i18n } from '/content/core/i18n.js';
import { sleep } from '/content/core/utils.js';
import { GITHUB_CONFIG, PROJECT_CATEGORIES } from '../config/github.config.js';
import { DEFAULT_OG_IMAGE, THEME_COLORS } from '../config/constants.js';
import {
  fetchGitHubContents,
  fetchProjectMetadata,
} from './github-api.service.js';

const log = createLogger('ProjectsDataService');
const CRAWLER_UA_PATTERN =
  /googlebot|google-inspectiontool|bingbot|slurp|duckduckbot|baiduspider|yandex|facebookexternalhit|twitterbot|linkedinbot|applebot|semrushbot|ahrefsbot/i;

// Load local apps config
let localAppsConfig = {};

const loadLocalConfig = async () => {
  try {
    const response = await fetch('/pages/projekte/apps-config.json');
    localAppsConfig = await response.json();
  } catch (error) {
    log.warn('Failed to load apps-config.json:', error);
    localAppsConfig = { apps: [] };
  }
};

// Initialize config loading
loadLocalConfig();

const getErrorStatusCode = (error) => {
  const status = Number(error?.status);
  if (Number.isFinite(status)) return status;

  const match = String(error?.message || '').match(/\b(\d{3})\b/);
  if (!match) return 0;

  return Number(match[1]) || 0;
};

const shouldUseGitHubSource = () => {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get('github') === '1') return true;
  if (params.get('github') === '0') return false;

  const userAgent =
    typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
  if (CRAWLER_UA_PATTERN.test(userAgent)) return false;

  const host = window.location.hostname || '';
  const isLocalHost =
    host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');

  return isLocalHost;
};

const loadLocalProjectsList = async () => {
  if (!Array.isArray(localAppsConfig.apps)) {
    await loadLocalConfig();
  }

  const localApps = localAppsConfig.apps || [];
  return localApps.map((app) => ({
    ...app,
    dirName: app.name,
  }));
};

/**
 * Helper function to create gradient backgrounds
 * @param {string[]} colors
 * @returns {object}
 */
const createGradient = (colors) => ({
  background: `linear-gradient(to bottom right, ${colors[0]}, ${colors[1]})`,
});

/**
 * Maps project to appropriate icon and theme
 * @param {object} project
 * @param {object} icons
 * @returns {{ icon: any, theme: object }}
 */
const getProjectIconAndTheme = (project, icons) => {
  const title = (project.title || '').toLowerCase();
  const tags = (project.tags || []).map((tag) => tag.toLowerCase());
  const category = (project.category || '').toLowerCase();
  const description = (project.description || '').toLowerCase();

  const allText = `${title} ${tags.join(' ')} ${category} ${description}`;

  /** @type {{ icon: string, theme: string, keywords: string[] }} */
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
    icon: React.createElement(IconComponent, {
      style: { color: theme.icon, width: '32px', height: '32px' },
    }),
    theme: theme,
  };
};

/**
 * Loads projects dynamically from GitHub repository
 * @param {object} icons
 * @returns {Promise<Array<object>>}
 */
const loadDynamicProjects = async (icons) => {
  let projectsList = [];
  let source = 'github';

  if (!shouldUseGitHubSource()) {
    source = 'local';
    AppLoadManager.updateLoader(0.5, i18n.t('loader.fallback_local'));
    projectsList = await loadLocalProjectsList();
    AppLoadManager.updateLoader(0.85, i18n.t('loader.processing'));
  } else {
    try {
      log.info('Starting dynamic project loading...');
      AppLoadManager.updateLoader(0.1, i18n.t('loader.connect_github'));

      const contents = await fetchGitHubContents(GITHUB_CONFIG.appsPath);

      if (!contents || contents.length === 0) {
        throw new Error(i18n.t('error.no_content'));
      }

      const directories = contents.filter((item) => item.type === 'dir');
      log.info(`Found ${directories.length} directories on GitHub`);

      AppLoadManager.updateLoader(
        0.2,
        i18n.t('loader.found_projects', { count: directories.length }),
      );

      for (const [i, dir] of directories.entries()) {
        const projectPath = `${GITHUB_CONFIG.appsPath}/${dir.name}`;

        // Update progress for each project
        const progress = 0.2 + (i / directories.length) * 0.6;
        AppLoadManager.updateLoader(
          progress,
          i18n.t('loader.loading_project', {
            current: i + 1,
            total: directories.length,
          }),
        );

        if (i > 0 && source === 'github') {
          await sleep(GITHUB_CONFIG.requestDelay || 50);
        }

        try {
          const metadata = await fetchProjectMetadata(projectPath);
          projectsList.push({ ...metadata, dirName: dir.name });
        } catch (metadataError) {
          log.warn(`Failed to load metadata for ${dir.name}:`, metadataError);
          // Add project with default metadata
          projectsList.push({
            title: dir.name
              .replace(/-/g, ' ')
              .replace(/\b\w/g, (l) => l.toUpperCase()),
            description: 'Ein interaktives Web-Projekt',
            tags: ['JavaScript'],
            category: 'app',
            version: '1.0.0',
            dirName: dir.name,
          });
        }
      }

      AppLoadManager.updateLoader(0.85, i18n.t('loader.processing'));
    } catch (error) {
      const statusCode = getErrorStatusCode(error);
      const isRateLimited = statusCode === 403 || statusCode === 429;
      const isTimeout = error?.name === 'AbortError';

      if (isRateLimited || isTimeout) {
        log.warn('GitHub source unavailable, using local bundled config.', {
          statusCode,
        });
      } else {
        log.error('Failed to load dynamic projects from GitHub:', error);
      }

      log.info('Falling back to local bundled config');
      source = 'local';
      AppLoadManager.updateLoader(0.5, i18n.t('loader.fallback_local'));

      projectsList = await loadLocalProjectsList();
      AppLoadManager.updateLoader(0.85, i18n.t('loader.processing'));
    }
  }

  // Process the projects list to create UI objects
  const currentDate = new Date().toISOString().split('T')[0];
  const finalProjects = projectsList.map((data, i) => {
    const { icon, theme } = getProjectIconAndTheme(data, icons);
    const dirName = data.dirName || data.name;

    return {
      id: i + 1,
      name: dirName,
      title: data.title,
      description: data.description,
      tags: Array.isArray(data.tags) ? data.tags : [],
      category: data.category,
      datePublished: currentDate,
      image: DEFAULT_OG_IMAGE,
      appPath: `https://raw.githack.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.appsPath}/${dirName}/index.html`,
      githubPath: `${GITHUB_CONFIG.repoBase}/${GITHUB_CONFIG.appsPath}/${dirName}`,
      bgStyle: createGradient(theme.gradient),
      glowColor: theme.icon,
      icon: icon,
      previewContent: React.createElement('div', null, icon),
    };
  });

  log.info(`Loaded ${finalProjects.length} projects (Source: ${source})`);
  AppLoadManager.updateLoader(
    1,
    i18n.t('loader.projects_ready', { count: finalProjects.length }),
  );

  return finalProjects;
};

/**
 * Creates the projects array with dynamic loading and static fallback
 * @param {object} icons
 * @returns {Promise<Array<object>>}
 */
export async function createProjectsData(icons) {
  log.info('Starting createProjectsData...');

  try {
    const result = await loadDynamicProjects(icons);
    return result;
  } catch (error) {
    log.error('createProjectsData failed:', error);
    throw error;
  }
}
