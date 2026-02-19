/**
 * GitHub API Service
 * @version 1.0.0
 */

import { createLogger } from '/content/core/logger.js';
import { GITHUB_CONFIG } from '../config/github.config.js';
import { getCache, setCache } from '../utils/cache.utils.js';

const log = createLogger('GitHubAPI');

/**
 * Fetches repository contents from GitHub API (with Caching)
 * @param {string} path - Path to fetch contents from
 * @param {object} options - Fetch options
 * @returns {Promise<any>}
 */
export async function fetchGitHubContents(path = '', options = {}) {
  const cacheKey = `gh_contents_${path}`;
  const cached = getCache(cacheKey);

  if (cached) {
    log.debug(`Using cached GitHub contents for: ${path}`);
    return cached;
  }

  const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;
  const defaultHeaders = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Projekte-Loader/1.0',
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...defaultHeaders, ...options.headers },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const apiError = new Error(`GitHub API error: ${response.status}`);
      apiError.name = 'GitHubApiError';
      apiError.status = response.status;
      apiError.rateLimited = response.status === 403 || response.status === 429;
      throw apiError;
    }

    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fetches and normalizes project metadata from package.json
 * @param {string} projectPath - Path to the project folder in the repo
 * @returns {Promise<object>}
 */
export async function fetchProjectMetadata(projectPath) {
  const cacheKey = `gh_metadata_${projectPath}`;
  const cached = getCache(cacheKey);

  if (cached) {
    log.debug(`Using cached metadata for: ${projectPath}`);
    return cached;
  }

  const metadataUrl = `${GITHUB_CONFIG.rawBase}/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${projectPath}/package.json`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced timeout

  try {
    const contentResponse = await fetch(metadataUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (contentResponse.ok) {
      const packageData = await contentResponse.json();
      const metadata = {
        title: packageData.name || projectPath.split('/').pop(),
        description: packageData.description || 'Ein interaktives Web-Projekt',
        tags: packageData.keywords || ['JavaScript'],
        category: packageData.category || 'app',
        version: packageData.version || '1.0.0',
      };

      setCache(cacheKey, metadata); // Uses default TTL from cache.utils
      return metadata;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    log.warn(`Could not fetch metadata for ${projectPath}:`, error);
  }

  // Default metadata if fetch fails
  const defaultMetadata = {
    title: (projectPath.split('/').pop() || 'Projekt')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase()),
    description: 'Ein interaktives Web-Projekt',
    tags: ['JavaScript'],
    category: 'app',
    version: '1.0.0',
  };

  setCache(cacheKey, defaultMetadata); // Uses default TTL from cache.utils
  return defaultMetadata;
}
