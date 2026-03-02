/**
 * GitHub API Service
 * @version 1.0.0
 */

import { createLogger } from '/content/core/logger.js';
import { GITHUB_CONFIG } from '../config/github.config.js';
import { getCache, setCache } from '../utils/cache.utils.js';

const log = createLogger('GitHubAPI');
const REQUEST_TIMEOUT_MS = 5000;

const createGitHubApiError = (status) => {
  const apiError = new Error(`GitHub API error: ${status}`);
  apiError.name = 'GitHubApiError';
  apiError.status = status;
  apiError.rateLimited = status === 403 || status === 429;
  return apiError;
};

const fetchWithTimeout = async (
  url,
  options = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

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

  const response = await fetchWithTimeout(url, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
  });

  if (!response.ok) {
    throw createGitHubApiError(response.status);
  }

  const data = await response.json();
  setCache(cacheKey, data);
  return data;
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

  try {
    const contentResponse = await fetchWithTimeout(metadataUrl);

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
