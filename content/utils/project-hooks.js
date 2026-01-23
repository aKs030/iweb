/**
 * Project-specific React Hooks
 * Custom hooks for project-related functionality
 */

// React hooks are available globally via React object
const { useState, useEffect, useRef } = React;

/**
 * URL resolution utilities
 */
function toRawGithackUrl(githubPath) {
  if (!githubPath) return null;
  try {
    const match = githubPath.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)/);
    if (match) {
      const [, user, repo, path] = match;
      return `https://raw.githack.com/${user}/${repo}/${path}`;
    }
  } catch {
    // ignore
  }
  return null;
}

function toJsDelivrUrl(githubPath) {
  if (!githubPath) return null;
  try {
    const match = githubPath.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)/);
    if (match) {
      const [, user, repo, path] = match;
      return `https://cdn.jsdelivr.net/gh/${user}/${repo}@main/${path}`;
    }
  } catch {
    // ignore
  }
  return null;
}

async function testUrl(url, timeout = 2500) {
  if (!url) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors',
    });

    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Hook for resolving project preview URLs
 * @param {Object} project - Project object with githubPath and appPath
 * @returns {string|null} Resolved preview URL
 */
export function useProjectUrl(project) {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const gh = project.githubPath || '';
        const candidates = [];

        if (gh) {
          const raw = toRawGithackUrl(gh);
          const js = toJsDelivrUrl(gh);
          if (raw) candidates.push(raw);
          if (js) candidates.push(js);
        }

        if (project.appPath) {
          candidates.push(
            project.appPath.endsWith('/')
              ? project.appPath + 'index.html'
              : project.appPath,
          );
        }

        for (const url of candidates) {
          if (!url) continue;
          if (await testUrl(url, 2500)) {
            if (!canceled) setPreviewUrl(url);
            return;
          }
        }
      } catch {
        // ignore URL resolution errors
      }
    })();

    return () => {
      canceled = true;
    };
  }, [project]);

  return previewUrl;
}

/**
 * Hook for iframe scaling to fit container while maintaining aspect ratio
 * @param {string} previewUrl - URL to load in iframe
 * @returns {Object} Refs for wrapper and iframe elements
 */
export function useIframeScaling(previewUrl) {
  const wrapperRef = useRef(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!previewUrl) return;

    const wrapper = wrapperRef.current;
    const iframe = iframeRef.current;
    if (!wrapper || !iframe) return;

    const scaleIframe = () => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const targetWidth = 1200;
      const targetHeight = 800;
      const scale = Math.min(
        wrapperRect.width / targetWidth,
        wrapperRect.height / targetHeight,
      );

      iframe.style.transform = `scale(${scale})`;
      iframe.style.transformOrigin = 'top left';
      iframe.style.width = `${targetWidth}px`;
      iframe.style.height = `${targetHeight}px`;
    };

    // Initial scale
    scaleIframe();

    // Set up ResizeObserver for responsive scaling
    const resizeObserver = new ResizeObserver(scaleIframe);
    resizeObserver.observe(wrapper);

    return () => {
      resizeObserver.disconnect();
    };
  }, [previewUrl]);

  return { wrapperRef, iframeRef };
}
