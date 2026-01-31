/**
 * URL Utilities
 * @version 1.0.0
 */

/**
 * Helper: Create an AbortController with timeout
 * @param {number} timeout - Timeout in milliseconds
 * @returns {{ controller: AbortController, clearTimeout: () => void }}
 */
function makeAbortController(timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  return {
    controller,
    clearTimeout: () => clearTimeout(timeoutId),
  };
}

/**
 * Convert GitHub URL to RawCDN Githack URL
 * @param {string} ghUrl - GitHub tree URL
 * @returns {string} RawCDN Githack URL or empty string
 */
export const toRawGithackUrl = (ghUrl) => {
  try {
    const m = /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/.exec(ghUrl);
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
 * Test if a URL is reachable
 * @param {string} url - URL to test
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
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
