/**
 * Project Mockup Component - htm Version
 * @version 3.0.0
 */

import React from 'react';
import htm from 'https://esm.sh/htm@3.1.1';
import { createLogger } from '/content/core/logger.js';
import { toRawGithackUrl, testUrl } from '../utils/url.utils.js';
import {
  URL_TEST_TIMEOUT,
  IFRAME_BASE_WIDTH,
  IFRAME_BASE_HEIGHT,
} from '../config/constants.js';

const html = htm.bind(React.createElement);
const log = createLogger('ProjectMockup');

/**
 * Project Mockup Component with Smart Preview Loading
 * @param {object} props
 * @param {object} props.project
 */
function ProjectMockup({ project }) {
  const wrapperRef = React.useRef(null);
  const iframeRef = React.useRef(null);
  const [previewUrl, setPreviewUrl] = React.useState(null);

  // Try to find a working preview URL
  React.useEffect(() => {
    let canceled = false;

    const findPreviewUrl = async () => {
      try {
        const candidates = [];

        // Priority 1: rawcdn.githack.com (embed-friendly)
        const gh = project.githubPath || '';
        if (gh) {
          const raw = toRawGithackUrl(gh);
          if (raw) candidates.push(raw);
        }

        // Priority 2: Direct app path
        if (project.appPath) {
          const appUrl = project.appPath.endsWith('/')
            ? `${project.appPath}index.html`
            : project.appPath;
          candidates.push(appUrl);
        }

        // Test each candidate URL
        for (const url of candidates) {
          if (!url || canceled) continue;
          if (await testUrl(url, URL_TEST_TIMEOUT)) {
            if (!canceled) setPreviewUrl(url);
            return;
          }
        }
      } catch (err) {
        log.debug('Preview URL resolution failed:', err);
      }
    };

    findPreviewUrl();

    return () => {
      canceled = true;
    };
  }, [project]);

  // Auto-scale iframe to fit container
  React.useEffect(() => {
    if (!previewUrl) return;

    const wrapper = wrapperRef.current;
    const iframe = iframeRef.current;
    if (!wrapper || !iframe) return;

    const scaleIframe = () => {
      const { clientWidth: w, clientHeight: h } = wrapper;
      const scale = Math.min(1, w / IFRAME_BASE_WIDTH, h / IFRAME_BASE_HEIGHT);
      /** @type {HTMLIFrameElement} */ (iframe).style.transform =
        `scale(${scale})`;
    };

    scaleIframe();
    const resizeObserver = new ResizeObserver(scaleIframe);
    resizeObserver.observe(wrapper);

    return () => resizeObserver.disconnect();
  }, [previewUrl]);

  return html`
    <div className="mockup-iframe-wrapper u-center" ref=${wrapperRef}>
      ${previewUrl
        ? html`
            <iframe
              className="mockup-iframe"
              ref=${iframeRef}
              src=${previewUrl}
              scrolling="no"
              sandbox="allow-scripts allow-same-origin allow-forms"
              frameborder="0"
              title=${`Preview: ${project.title}`}
              loading="lazy"
            />
          `
        : project.previewContent}
    </div>
  `;
}

export { ProjectMockup };
