/**
 * Videos Page with Progress Tracking
 * @version 3.0.0
 * @last-modified 2026-01-31
 */

/**
 * @typedef {Object} GtagEvent
 * @property {string} video_id
 * @property {string} video_title
 * @property {string} page_location
 */

/**
 * @typedef {Window & {
 *   gtag?: (command: string, eventName: string, params: any) => void;
 *   dataLayer?: any[];
 * }} ExtendedWindow
 */

import { createLogger } from '/content/core/logger.js';
import { escapeHTML } from '/content/core/html-sanitizer.js';
import { getElementById } from '/content/core/utils.js';
import { updateLoader, hideLoader } from '/content/core/global-loader.js';
import { i18n } from '/content/core/i18n.js';
import { FAVICON_512 } from '../../content/config/site-config.js';
import {
  fetchChannelId,
  fetchUploadsPlaylist,
  fetchPlaylistItems,
  searchChannelVideos,
  fetchVideoDetailsMap,
} from './services/youtube-api.service.js';

const log = createLogger('videos');

// Helper: replace a thumbnail button with an autoplaying iframe
const activateThumb = (btn) => {
  if (!btn || btn.dataset.loaded) return;
  const vid = btn.dataset.videoId;
  const title = btn.getAttribute('aria-label') || '';
  const wrapper = document.createElement('div');
  wrapper.className = 'embed';
  const iframe = document.createElement('iframe');
  iframe.width = '560';
  iframe.height = '315';
  iframe.src = `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0`;
  iframe.title = title;
  iframe.setAttribute('frameBorder', '0');
  iframe.setAttribute(
    'allow',
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
  );
  iframe.setAttribute('allowfullscreen', '');
  wrapper.appendChild(iframe);
  btn.replaceWith(wrapper);
  try {
    iframe.focus();
  } catch {
    /* ignore */
  }
  btn.dataset.loaded = '1';
};

const bindThumb = (btn) => {
  if (btn.dataset.bound) return;
  if (btn.dataset.thumb)
    btn.style.backgroundImage = `url('${btn.dataset.thumb}')`;
  if (
    btn.getAttribute('aria-label') &&
    !btn.querySelector('.visually-hidden')
  ) {
    const span = document.createElement('span');
    span.className = 'visually-hidden';
    span.textContent = btn.getAttribute('aria-label');
    btn.appendChild(span);
  }
  const _onThumbClick = () => activateThumb(btn);
  const _onThumbKeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateThumb(btn);
    }
  };
  btn.addEventListener('click', _onThumbClick);
  btn.addEventListener('keydown', _onThumbKeydown);
  // store handlers for potential cleanup
  btn.__thumbHandlers = { click: _onThumbClick, keydown: _onThumbKeydown };
  btn.dataset.bound = '1';
};

const renderVideoCard = async (grid, it, detailsMap, index = 0) => {
  const vid = it.snippet.resourceId.videoId;
  const rawTitle = it.snippet.title;
  const title = cleanTitle(rawTitle);
  const desc = it.snippet?.description?.trim()
    ? it.snippet.description
    : `${title} — Video von Abdulkerim Sesli`;
  const thumb =
    it.snippet?.thumbnails?.maxres?.url ||
    it.snippet?.thumbnails?.high?.url ||
    it.snippet?.thumbnails?.default?.url;
  const pub = it.snippet.publishedAt || new Date().toISOString(); // ✅ Fallback only when needed

  const videoDetail = detailsMap[vid];
  const duration = videoDetail?.contentDetails?.duration;
  const viewCount = videoDetail?.statistics?.viewCount
    ? Number(videoDetail.statistics.viewCount)
    : undefined;

  const article = document.createElement('article');
  article.className = 'video-card';
  article.innerHTML = `
    <h2>${escapeHTML(title)}</h2>
    <p class="video-desc">${escapeHTML(desc)}</p>
  `;

  const thumbBtn = document.createElement('button');
  thumbBtn.className = 'video-thumb';
  thumbBtn.setAttribute('aria-label', `Play ${title}`);
  thumbBtn.dataset.videoId = vid;
  thumbBtn.dataset.thumb = thumb;

  // Optimiere Thumbnail-URL für bessere Performance
  const optimizedThumb = thumb.includes('ytimg.com')
    ? thumb.replace(/\/maxresdefault\.jpg$/, '/hqdefault.jpg')
    : thumb;
  thumbBtn.dataset.thumb = optimizedThumb;

  // Lazy loading für Thumbnails
  const thumbImg = document.createElement('img');
  thumbImg.src = optimizedThumb;
  thumbImg.alt = `Thumbnail: ${title}`;
  thumbImg.loading = index < 4 ? 'eager' : 'lazy';
  thumbImg.decoding = 'async';
  thumbImg.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';

  thumbBtn.innerHTML =
    '<span class="play-button" aria-hidden="true"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><polygon points="70,55 70,145 145,100"/></svg></span>';
  thumbBtn.appendChild(thumbImg);

  const meta = document.createElement('div');
  meta.className = 'video-meta';
  meta.innerHTML = `<div class="video-info"><small class="pub-date">${pub}</small></div><div class="video-actions u-row"><a href="https://youtu.be/${vid}" target="_blank" rel="noopener">${i18n.t(
    'videos.open_youtube',
  )}</a> <a href="/videos/${vid}/" class="page-link" title="${i18n.t(
    'videos.open_landing',
  )}" data-video-id="${vid}" data-video-title="${escapeHTML(
    title,
  )}">${i18n.t('videos.open_page')}</a></div>`;

  const publisherName =
    globalThis.YOUTUBE_CHANNEL_ID === 'UCTGRherjM4iuIn86xxubuPg'
      ? 'Abdulkerim Berlin'
      : 'Abdulkerim Sesli';
  const ldObj = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: rawTitle + ` — ${publisherName}`,
    description: desc,
    thumbnailUrl: thumb,
    uploadDate: pub,
    contentUrl: `https://youtu.be/${vid}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${vid}`,
    isFamilyFriendly: true,
    publisher: {
      '@type': 'Organization',
      '@id': 'https://www.abdulkerimsesli.de/#organization',
      logo: {
        '@type': 'ImageObject',
        url: FAVICON_512,
        contentUrl: FAVICON_512,
        creator: { '@type': 'Person', name: 'Abdulkerim Sesli' },
        license: 'https://www.abdulkerimsesli.de/#image-license',
        creditText: 'Logo: Abdulkerim Sesli',
        copyrightNotice: '© 2025 Abdulkerim Sesli',
        acquireLicensePage: 'https://www.abdulkerimsesli.de/#image-license',
      },
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Sterkrader Str. 59',
        postalCode: '13507',
        addressLocality: 'Berlin',
        addressCountry: 'DE',
      },
    },
  };

  if (duration) ldObj.duration = duration;
  if (viewCount !== undefined) {
    ldObj.interactionStatistic = {
      '@type': 'InteractionCounter',
      interactionType: 'http://schema.org/WatchAction',
      userInteractionCount: viewCount,
    };
  }

  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify(ldObj);

  grid.appendChild(article);
  article.appendChild(thumbBtn);
  article.appendChild(meta);

  // Attach analytics tracking to the per-video landing page link (GA4-friendly)
  try {
    const pageLinkEl = meta.querySelector('.page-link');
    if (pageLinkEl) {
      pageLinkEl.addEventListener('click', () => {
        try {
          const ga4Payload = {
            video_id: vid,
            video_title: title,
            page_location: location.href,
          };
          const uaPayload = {
            event_category: 'video',
            event_label: title,
            video_id: vid,
          };
          const win = /** @type {ExtendedWindow} */ (window);
          if (typeof win.gtag === 'function') {
            // GA4 event
            win.gtag('event', 'open_video_page', ga4Payload);
            // optional UA-style event for compatibility (if using legacy setups)
            try {
              win.gtag('event', 'open_video_page_ua', uaPayload);
            } catch {
              // Ignore errors for legacy UA events
            }
          } else if (Array.isArray(win.dataLayer)) {
            win.dataLayer.push({
              event: 'open_video_page',
              ...ga4Payload,
            });
          }
        } catch {
          /* ignore analytics errors */
        }
      });
    }
  } catch {
    /* ignore */
  }

  article.appendChild(ld);

  bindThumb(thumbBtn);
};

// Videos page loader
const setVideoStatus = (msg) => {
  const el = getElementById('videos-status');
  if (el) el.textContent = msg || '';
};

const loadLatestVideos = async () => {
  const handle = (globalThis.YOUTUBE_CHANNEL_HANDLE || 'aks.030').replace(
    /^@/,
    '',
  );

  // Bind any existing static thumbnails (works without API)
  try {
    document.querySelectorAll('.video-thumb').forEach(bindThumb);
  } catch {
    /* ignore */
  }

  setVideoStatus('');

  try {
    if (globalThis.location?.protocol === 'file:') {
      log.warn(
        'Running from file:// — network requests may be blocked. Serve site via http://localhost for proper API requests.',
      );
      updateLoader(1, i18n.t('videos.local_mode'));
      hideLoader(500);
      return;
    }

    updateLoader(0.1, i18n.t('videos.loading'));
    setVideoStatus(i18n.t('videos.loading'));

    const grid = document.querySelector('.video-grid');
    if (!grid) {
      updateLoader(1, i18n.t('videos.error'));
      hideLoader(500);
      return;
    }

    updateLoader(0.3, i18n.t('videos.connecting'));
    const { items, detailsMap } = await loadFromApi(handle);

    if (!items.length) {
      log.warn('Keine Videos gefunden');
      showInfoMessage(
        'Keine öffentlichen Uploads auf YouTube gefunden — es werden die statisch eingebetteten Videos angezeigt.',
      );
      setVideoStatus('');
      updateLoader(1, i18n.t('videos.not_found'));
      hideLoader(500);
      return;
    }

    updateLoader(0.6, i18n.t('videos.processing', { count: items.length }));
    grid.innerHTML = '';

    // Render videos with progress updates
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      batch.forEach((it, idx) =>
        renderVideoCard(grid, it, detailsMap, i + idx),
      );

      const progress = 0.6 + ((i + batchSize) / items.length) * 0.3;
      updateLoader(
        progress,
        i18n.t('videos.processing', {
          count: Math.min(i + batchSize, items.length),
        }),
      );

      // Allow UI to update
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    updateLoader(0.95, `${items.length} Videos geladen`);
    setVideoStatus('');

    setTimeout(() => {
      updateLoader(1, i18n.t('videos.ready'));
      hideLoader(100);
    }, 100);

    log.info(`Successfully loaded ${items.length} videos`);
  } catch (err) {
    log.error('Fehler beim Laden der Videos', err);
    showErrorMessage(err);
    updateLoader(1, i18n.t('videos.error'));
    hideLoader(500);
  }
};

// Helper: clean titles for display (remove trailing channel suffixes like "- Abdulkerim Sesli" or "— Abdulkerim Berlin")
const cleanTitle = (s) => {
  if (!s) return s;
  // Remove trailing separator and channel name starting with Abdulkerim
  return String(s)
    .replace(/\s*([-–—|])\s*(Abdulkerim[\s\S]*)$/i, '')
    .trim();
};

// Helper: show friendly error message in page
const showErrorMessage = (err) => {
  try {
    const container =
      document.querySelector('.videos-main .container') || document.body;
    const el = document.createElement('aside');
    el.className = 'video-error';
    let message = i18n.t('videos.error');
    if (err?.status === 400) {
      message +=
        ' API-Key ungültig (400). Prüfe in der Google Cloud Console, ob der Key aktiv ist und die YouTube Data API v3 freigeschaltet ist.';
      if (
        /API_KEY_INVALID|API key not valid/.test(
          (err?.body || '') + ' ' + (err?.message || ''),
        )
      ) {
        message += ' Hinweis: Der API-Key scheint ungültig zu sein.';
      }
    } else if (err?.status === 403) {
      message +=
        ' API-Zugriff verweigert (403). Prüfe deine API-Key Referrer-Einschränkungen oder teste über http://localhost:8000.';
      if (
        /API_KEY_HTTP_REFERRER_BLOCKED|Requests from referer/.test(
          err?.body || '',
        )
      ) {
        message += ' Hinweis: Requests mit leerem Referer werden geblockt.';
      }
    } else if (err?.message) {
      message += ' ' + String(err.message).slice(0, 200);
    }
    el.textContent = message;
    container.insertBefore(el, container.firstChild);
    setVideoStatus(el.textContent);
  } catch {
    // ignore UI errors
  }
};

// Helper: show non-error informational message in page
const showInfoMessage = (msg) => {
  try {
    const container =
      document.querySelector('.videos-main .container') || document.body;
    const el = document.createElement('aside');
    el.className = 'video-note';
    el.textContent = msg;
    container.insertBefore(el, container.firstChild);
    setVideoStatus(msg);
  } catch {
    // ignore UI errors
  }
};

// Extracted API loader (top-level to reduce nested complexity)
const loadFromApi = async (handle) => {
  const channelId = await fetchChannelId(handle);
  if (!channelId) return { items: [], detailsMap: {} };

  const uploads = await fetchUploadsPlaylist(channelId);
  let items = [];

  if (uploads) {
    items = await fetchPlaylistItems(uploads);
    if (items.length === 0) {
      log.warn('Uploads playlist returned no items — falling back to search');
      // Inform the user in the UI when running in a browser
      try {
        if (typeof window !== 'undefined' && document)
          showInfoMessage(
            'Uploads playlist leer — lade Videos per Suche als Fallback.',
          );
      } catch {
        /* ignore */
      }
      // Attempt search fallback when playlist is empty
      items = await searchChannelVideos(channelId);
    }
  } else {
    log.warn('No uploads playlist available — falling back to search');
    try {
      if (typeof window !== 'undefined' && document)
        showInfoMessage(
          'Uploads playlist nicht vorhanden — lade Videos per Suche als Fallback.',
        );
    } catch {
      /* ignore */
    }
    items = await searchChannelVideos(channelId);
  }

  if (!items.length) return { items: [], detailsMap: {} };

  const vidIds = items
    .map((it) => it.snippet.resourceId.videoId)
    .filter(Boolean);
  const detailsMap = await fetchVideoDetailsMap(vidIds);
  return { items, detailsMap };
};

// Run (without await at top level)
loadLatestVideos().catch((error) => {
  log.error('Failed to load videos:', error);
});
