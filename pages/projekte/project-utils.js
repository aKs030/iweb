/**
 * Shared Project Utilities
 * Contains common logic for fetching GitHub data and handling URLs.
 * Shared between frontend (projects-data.js, projekte-app.js) and maintenance scripts.
 */

import { GITHUB_CONFIG } from './github-config.js';

/**
 * Helper: Create an AbortController with timeout
 */
export function makeAbortController(timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  return {
    controller,
    clearTimeout: () => clearTimeout(timeoutId),
  };
}

/**
 * Fetches repository contents from GitHub API
 * @param {string} path - Path to fetch contents from
 * @param {object} options - Fetch options (e.g., custom headers)
 */
export async function fetchGitHubContents(path = '', options = {}) {
  const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;
  const defaultHeaders = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Projekte-Loader/1.0',
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...defaultHeaders, ...options.headers },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // We re-throw so the caller can handle logging or fallbacks
    throw error;
  }
}

/**
 * Fetches and normalizes project metadata from package.json
 * @param {string} projectPath - Path to the project folder in the repo
 */
export async function fetchProjectMetadata(projectPath) {
  const metadataUrl = `${GITHUB_CONFIG.rawBase}/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${projectPath}/package.json`;

  try {
    // Check if file exists first using HEAD
    const packageResponse = await fetch(metadataUrl, { method: 'HEAD' });

    if (packageResponse.ok) {
      const contentResponse = await fetch(metadataUrl);
      if (contentResponse.ok) {
        const packageData = await contentResponse.json();
        return {
          title: packageData.name || projectPath.split('/').pop(),
          description:
            packageData.description || 'Ein interaktives Web-Projekt',
          tags: packageData.keywords || ['JavaScript'],
          category: packageData.category || 'app',
          version: packageData.version || '1.0.0',
          raw: packageData, // Return raw data in case caller needs more
        };
      }
    }
  } catch (error) {
    console.warn(`Could not fetch metadata for ${projectPath}:`, error);
  }

  // Default metadata if fetch fails
  return {
    title: projectPath
      .split('/')
      .pop()
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase()),
    description: 'Ein interaktives Web-Projekt',
    tags: ['JavaScript'],
    category: 'app',
    version: '1.0.0',
  };
}

/**
 * URL Helper: Get RawGit URL
 */
export const toRawGithackUrl = (ghUrl) => {
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
};

/**
 * URL Helper: Get jsDelivr URL
 */
export const toJsDelivrUrl = (ghUrl) => {
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
};

/**
 * URL Helper: Get Direct URL (GitHub Raw or App Path)
 */
export const getDirectUrl = (project) => {
  if (project.githubPath) {
    try {
      const url = new URL(project.githubPath);
      if (url.host === 'github.com') {
        const pathname = url.pathname;
        const m = /^\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/.exec(pathname);
        if (m) {
          const [, owner, repo, branch, path] = m;
          return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}/index.html`;
        }
      }
    } catch {
      // Invalid URL, fall through
    }
  }
  // fallback
  if (project.appPath)
    return project.appPath.endsWith('/')
      ? project.appPath + 'index.html'
      : project.appPath;
  return project.githubPath || '';
};

/**
 * Helper: Test if a URL is reachable
 */
export const testUrl = async (url, timeout = 2500) => {
  if (!url) return false;
  try {
    const { controller, clearTimeout: clearCtrlTimeout } =
      makeAbortController(timeout);
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    });
    clearCtrlTimeout();
    return res?.ok;
  } catch {
    return false;
  }
};
