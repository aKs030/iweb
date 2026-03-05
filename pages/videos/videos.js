/**
 * Videos Page with Progress Tracking
 * @version 3.0.0
 * @last-modified 2026-01-31
 */

import { createLogger } from '#core/logger.js';
import { isLocalDevRuntime } from '#core/runtime-env.js';
import { AppLoadManager } from '#core/load-manager.js';
import { i18n } from '#core/i18n.js';
import { ensureDeepLinkedVideo, loadFromApi } from './videos-data.js';
import {
  activateThumb,
  bindThumb,
  renderVideoCard,
  setVideoStatus,
  showErrorMessage,
  showInfoMessage,
} from './videos-ui.js';
import { dedupeVideoSchemas, upsertVideosSchema } from './videos-schema.js';

const log = createLogger('videos');

const loadLatestVideos = async () => {
  // Bind any existing static thumbnails (works without API)
  try {
    document.querySelectorAll('.video-thumb').forEach(bindThumb);
  } catch {
    /* ignore */
  }

  setVideoStatus('');
  upsertVideosSchema([]);

  try {
    if (globalThis.location?.protocol === 'file:') {
      log.warn(
        'Running from file:// — network requests may be blocked. Serve site via http://localhost for proper API requests.',
      );
      upsertVideosSchema([]);
      AppLoadManager.updateLoader(1, i18n.t('videos.local_mode'));
      AppLoadManager.hideLoader(500);
      return;
    }

    AppLoadManager.updateLoader(0.1, i18n.t('videos.loading'));
    setVideoStatus(i18n.t('videos.loading'));

    const grid = document.querySelector('.video-grid');
    if (!grid) {
      upsertVideosSchema([]);
      AppLoadManager.updateLoader(1, i18n.t('videos.error'));
      AppLoadManager.hideLoader(500);
      return;
    }

    AppLoadManager.updateLoader(0.3, i18n.t('videos.connecting'));
    let { items, detailsMap } = await loadFromApi({
      notifyInfo: showInfoMessage,
    });

    // Check for deep link /videos/VIDEO_ID
    const path = window.location.pathname;
    let targetVideoId = null;
    if (path.startsWith('/videos/') && path.length > 8) {
      const possibleId = path.replace(/^\/videos\//, '').replace(/\/$/, '');
      if (possibleId && possibleId !== 'index.html') {
        targetVideoId = possibleId;
      }
    }

    // Ensure deep-linked video is in the list
    ({ items, detailsMap } = await ensureDeepLinkedVideo({
      videoId: targetVideoId,
      items,
      detailsMap,
    }));

    if (!items.length) {
      if (isLocalDevRuntime()) {
        log.info('Keine Videos gefunden (lokaler Dev-Modus)');
      } else {
        log.warn('Keine Videos gefunden');
      }
      showInfoMessage(
        'Keine öffentlichen Uploads auf YouTube gefunden — es werden die statisch eingebetteten Videos angezeigt.',
      );
      upsertVideosSchema([]);
      setVideoStatus('');
      AppLoadManager.updateLoader(1, i18n.t('videos.not_found'));
      AppLoadManager.hideLoader(500);
      return;
    }

    AppLoadManager.updateLoader(
      0.6,
      i18n.t('videos.processing', { count: items.length }),
    );
    grid.innerHTML = '';
    const videoSchemaNodes = [];

    // Render videos with progress updates
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const fragment = document.createDocumentFragment();
      batch.forEach((it, idx) => {
        const schemaNode = renderVideoCard(fragment, it, detailsMap, i + idx);
        if (schemaNode) {
          videoSchemaNodes.push(schemaNode);
        }

        // Auto-play deep-linked video
        if (
          targetVideoId &&
          it.snippet?.resourceId?.videoId === targetVideoId
        ) {
          setTimeout(() => {
            const btn = grid.querySelector(
              `button[data-video-id="${targetVideoId}"]`,
            );
            if (btn) {
              activateThumb(btn);
              btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
              document.title = `${it.snippet.title} — Videos`;
            }
          }, 800);
        }
      });
      grid.appendChild(fragment);

      const progress = 0.6 + ((i + batchSize) / items.length) * 0.3;
      AppLoadManager.updateLoader(
        progress,
        i18n.t('videos.processing', {
          count: Math.min(i + batchSize, items.length),
        }),
      );

      // Allow UI to update
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    upsertVideosSchema(dedupeVideoSchemas(videoSchemaNodes));

    AppLoadManager.updateLoader(
      0.95,
      i18n.t('loader.videos_loaded', { count: items.length }),
    );
    setVideoStatus('');

    setTimeout(() => {
      AppLoadManager.updateLoader(1, i18n.t('videos.ready'));
      AppLoadManager.hideLoader(100);
    }, 100);

    log.info(`Successfully loaded ${items.length} videos`);
  } catch (err) {
    log.error('Fehler beim Laden der Videos', err);
    upsertVideosSchema([]);
    showErrorMessage(err);
    AppLoadManager.updateLoader(1, i18n.t('videos.error'));
    AppLoadManager.hideLoader(500);
  }
};

// Run (without await at top level)
loadLatestVideos().catch((error) => {
  log.error('Failed to load videos:', error);
});
