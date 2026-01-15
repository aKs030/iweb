/* exported _shareChannel, _renderDemoVideos */
import { createLogger } from '/content/utils/shared-utilities.js';
import { FAVICON_512 } from '../../content/config/site-config.js';

const log = createLogger('videos');

// Share function for YouTube channel
function _shareChannel() {
  const channelId = globalThis.YOUTUBE_CHANNEL_ID;
  const handle = (globalThis.YOUTUBE_CHANNEL_HANDLE || 'aks.030').replace(
    /^@/,
    '',
  );
  const url = channelId
    ? `https://www.youtube.com/channel/${channelId}`
    : `https://www.youtube.com/@${handle}`;
  const title = channelId
    ? 'Abdulkerim Berlin - YouTube Kanal'
    : 'Abdulkerim Sesli - YouTube Kanal';
  if (navigator.share) {
    navigator.share({ title, url });
    return;
  }
  // Fallback: copy to clipboard, then fallback to opening share dialog
  navigator.clipboard
    ?.writeText(url)
    .then(() => {
      alert('Link kopiert: ' + url);
    })
    .catch(() => {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          url,
        )}`,
        '_blank',
      );
    });
}

// Helper: replace a thumbnail button with an autoplaying iframe
function activateThumb(btn) {
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
  iframe.setAttribute('frameborder', '0');
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
}

// Bind event handlers and accessible label for a thumb button
// Bind event handlers and accessible label for a thumb button
function bindThumb(btn) {
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
}

// Helper to fetch JSON and surface HTTP errors
async function fetchJson(url) {
  const safeUrl = url.replaceAll(/([?&]key=)[^&]+/g, '$1[REDACTED]');
  log.warn(`Fetching ${safeUrl}`);
  const res = await fetch(url, { credentials: 'omit', mode: 'cors' });
  if (!res.ok) {
    let text = '';
    try {
      text = await res.text();
    } catch {
      /* noop */
    }
    const err = new Error(
      `Fetch failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`,
    );
    err.status = res.status;
    err.statusText = res.statusText;
    err.body = text;
    throw err;
  }
  return await res.json();
}

async function fetchChannelId(apiKey, handle) {
  // Prefer explicit channel id when set
  if (globalThis.YOUTUBE_CHANNEL_ID)
    return String(globalThis.YOUTUBE_CHANNEL_ID).trim();

  // If handle looks like a channel id already (starts with UC), return it
  if (/^UC[0-9A-Za-z_-]{22,}$/.test(String(handle || '')))
    return String(handle).trim();

  // Try searching for the handle (allow up to 5 results to disambiguate)
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(
    handle,
  )}&maxResults=5&key=${apiKey}`;
  const json = await fetchJson(url);
  const items = json?.items || [];
  if (!items.length) return null;

  // Collect candidate channelIds
  const ids = items
    .map((i) => i?.id?.channelId || i?.snippet?.channelId)
    .filter(Boolean);
  if (!ids.length) return null;
  if (ids.length === 1) return ids[0];

  // If multiple candidates, fetch their statistics and prefer one with videoCount > 0
  try {
    const chUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${ids.join(
      ',',
    )}&key=${apiKey}`;
    const chJson = await fetchJson(chUrl);
    const chItems = chJson?.items || [];
    const preferred = chItems.find(
      (c) => Number(c?.statistics?.videoCount) > 0,
    );
    if (preferred && preferred.id) return preferred.id;
  } catch (e) {
    log.warn(
      'Could not disambiguate channel via statistics: ' + (e?.message || e),
    );
    // fall back to first id
  }

  return ids[0];
}

async function fetchUploadsPlaylist(apiKey, channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
  const json = await fetchJson(url);
  return json?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
}

async function fetchPlaylistItems(apiKey, uploads, maxResults = 50) {
  const allItems = [];
  let pageToken = '';
  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploads}&maxResults=${maxResults}&key=${apiKey}${
      pageToken ? `&pageToken=${pageToken}` : ''
    }`;
    try {
      const json = await fetchJson(url);
      allItems.push(...(json.items || []));
      pageToken = json.nextPageToken;
    } catch (e) {
      // If the uploads playlist cannot be found (e.g., private or empty), treat as no videos
      if (
        e?.status === 404 &&
        /playlistNotFound|playlistId/.test(e?.body || '')
      ) {
        log.warn(`Uploads playlist not found or inaccessible: ${uploads}`);
        return [];
      }
      throw e;
    }
  } while (pageToken);
  return allItems;
}

// Fallback: search for recent videos from a channel when playlist is missing/empty
async function searchChannelVideos(apiKey, channelId, maxResults = 50) {
  const items = [];
  let pageToken = '';
  do {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=${maxResults}${
      pageToken ? `&pageToken=${pageToken}` : ''
    }&key=${apiKey}`;
    try {
      const json = await fetchJson(url);
      (json.items || []).forEach((it) => {
        // Normalize to playlistItem-like shape used elsewhere
        if (it && it.id && it.id.videoId)
          items.push({
            snippet: {
              resourceId: { videoId: it.id.videoId },
              title: it.snippet.title,
              description: it.snippet.description,
              thumbnails: it.snippet.thumbnails,
              publishedAt: it.snippet.publishedAt,
            },
          });
      });
      pageToken = json.nextPageToken;
    } catch (e) {
      log.warn('searchChannelVideos failed: ' + (e?.message || e));
      return items;
    }
  } while (pageToken);
  return items;
}

async function fetchVideoDetailsMap(apiKey, vidIds) {
  const map = {};
  if (!vidIds.length) return map;
  const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${vidIds.join(
    ',',
  )}&key=${apiKey}`;
  try {
    const json = await fetchJson(url);
    (json.items || []).forEach((v) => {
      map[v.id] = v;
    });
  } catch (e) {
    log.warn('Could not fetch video details: ' + e.message);
  }
  return map;
}

function renderVideoCard(grid, it, detailsMap) {
  const vid = it.snippet.resourceId.videoId;
  const rawTitle = it.snippet.title;
  const title = cleanTitle(rawTitle);
  const desc = it.snippet?.description?.trim()
    ? it.snippet.description
    : `${title} — Video von Abdulkerim Sesli`;
  const thumb =
    it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url;
  const pub = it.snippet.publishedAt || new Date().toISOString();

  const videoDetail = detailsMap[vid];
  const duration = videoDetail?.contentDetails?.duration;
  const viewCount = videoDetail?.statistics?.viewCount
    ? Number(videoDetail.statistics.viewCount)
    : undefined;

  const article = document.createElement('article');
  article.className = 'video-card';
  article.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <p class="video-desc">${escapeHtml(desc)}</p>
  `;

  const thumbBtn = document.createElement('button');
  thumbBtn.className = 'video-thumb';
  thumbBtn.setAttribute('aria-label', `Play ${title}`);
  thumbBtn.dataset.videoId = vid;
  thumbBtn.dataset.thumb = thumb;
  thumbBtn.innerHTML =
    '<span class="play-button" aria-hidden="true"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><polygon points="70,55 70,145 145,100"/></svg></span>';

  const meta = document.createElement('div');
  meta.className = 'video-meta';
  meta.innerHTML = `<div class="video-info"><small class="pub-date">${pub}</small></div><div class="video-actions u-row"><a href="https://youtu.be/${vid}" target="_blank" rel="noopener">Auf YouTube öffnen</a></div>`;

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
      '@id': 'https://abdulkerimsesli.de/#organization',
      logo: {
        '@type': 'ImageObject',
        url: FAVICON_512,
        contentUrl: FAVICON_512,
        creator: { '@type': 'Person', name: 'Abdulkerim Sesli' },
        license: 'https://abdulkerimsesli.de/#image-license',
        creditText: 'Logo: Abdulkerim Sesli',
        copyrightNotice: '© 2025 Abdulkerim Sesli',
        acquireLicensePage: 'https://abdulkerimsesli.de/#image-license',
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
  article.appendChild(ld);

  bindThumb(thumbBtn);
}

async function _renderDemoVideos(grid, demo) {
  grid.innerHTML = '';
  demo.forEach((it) => renderVideoCard(grid, it, {}));
}

// Expose debug helpers to window for manual testing (safe when window is defined)
if (typeof window !== 'undefined') {
  window._shareChannel = _shareChannel;
  window._renderDemoVideos = _renderDemoVideos;
}

// Videos page loader (moved from inline to avoid HTML parsing issues)
async function loadLatestVideos() {
  const apiKey = globalThis.YOUTUBE_API_KEY;
  const handle = (globalThis.YOUTUBE_CHANNEL_HANDLE || 'aks.030').replace(
    /^@/,
    '',
  );

  // Bind any existing static thumbnails (works without API key)
  try {
    document.querySelectorAll('.video-thumb').forEach(bindThumb);
  } catch {
    /* ignore */
  }
  if (!apiKey) return;

  const setStatus = (msg) => {
    try {
      const el = document.getElementById('videos-status');
      if (el) el.textContent = msg || '';
    } catch {
      // ignore
    }
  };

  setStatus('');

  try {
    if (globalThis.location?.protocol === 'file:') {
      log.warn(
        'Running from file:// — network requests may be blocked. Serve site via http://localhost for proper API requests.',
      );
      return;
    }

    setStatus('Videos werden geladen…');

    const grid = document.querySelector('.video-grid');
    if (!grid) return;

    const { items, detailsMap } = await loadFromApi(apiKey, handle);
    if (!items.length) {
      log.warn('Keine Videos gefunden');
      // Show a friendly informational message and keep any static entries on the page
      showInfoMessage(
        'Keine öffentlichen Uploads auf YouTube gefunden — es werden die statisch eingebetteten Videos angezeigt.',
      );
      setStatus('');
      return;
    }

    grid.innerHTML = '';
    items.forEach((it) => renderVideoCard(grid, it, detailsMap));

    setStatus('');
  } catch (err) {
    log.error('Fehler beim Laden der Videos', err);
    showErrorMessage(err);
  }
}

// Top-level escapeHtml helper (shared)
function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Helper: clean titles for display (remove trailing channel suffixes like "- Abdulkerim Sesli" or "— Abdulkerim Berlin")
function cleanTitle(s) {
  if (!s) return s;
  // Remove trailing separator and channel name starting with Abdulkerim
  return String(s)
    .replace(/\s*([-–—|])\s*(Abdulkerim[\s\S]*)$/i, '')
    .trim();
}

// Helper: show friendly error message in page
function showErrorMessage(err) {
  try {
    const container =
      document.querySelector('.videos-main .container') || document.body;
    const el = document.createElement('aside');
    el.className = 'video-error';
    let message = 'Fehler beim Laden der Videos.';
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
    try {
      const setStatus = (msg) => {
        try {
          const el2 = document.getElementById('videos-status');
          if (el2) el2.textContent = msg || '';
        } catch {
          // ignore
        }
      };
      setStatus(el.textContent);
    } catch {
      /* ignore */
    }
  } catch {
    // ignore UI errors
  }
}

// Helper: show non-error informational message in page
function showInfoMessage(msg) {
  try {
    const container =
      document.querySelector('.videos-main .container') || document.body;
    const el = document.createElement('aside');
    el.className = 'video-note';
    el.textContent = msg;
    container.insertBefore(el, container.firstChild);
    try {
      const setStatus = (m) => {
        try {
          const el2 = document.getElementById('videos-status');
          if (el2) el2.textContent = m || '';
        } catch {
          // ignore
        }
      };
      setStatus(msg);
    } catch {
      /* ignore */
    }
  } catch {
    // ignore UI errors
  }
}

// Extracted API loader (top-level to reduce nested complexity)
async function loadFromApi(apiKey, handle) {
  const channelId = await fetchChannelId(apiKey, handle);
  if (!channelId) return { items: [], detailsMap: {} };

  const uploads = await fetchUploadsPlaylist(apiKey, channelId);
  let items = [];

  if (uploads) {
    items = await fetchPlaylistItems(apiKey, uploads);
    if (items.length === 0) {
      log.warn('Uploads playlist returned no items — falling back to search');
      // Inform the user in the UI when running in a browser
      try {
        if (typeof window !== 'undefined' && document)
          showInfoMessage(
            'Uploads playlist leer — lade Videos per Suche als Fallback.',
          );
      } catch (e) {
        /* ignore */
      }
      // Attempt search fallback when playlist is empty
      items = await searchChannelVideos(apiKey, channelId);
    }
  } else {
    log.warn('No uploads playlist available — falling back to search');
    try {
      if (typeof window !== 'undefined' && document)
        showInfoMessage(
          'Uploads playlist nicht vorhanden — lade Videos per Suche als Fallback.',
        );
    } catch (e) {
      /* ignore */
    }
    items = await searchChannelVideos(apiKey, channelId);
  }

  if (!items.length) return { items: [], detailsMap: {} };

  const vidIds = items
    .map((it) => it.snippet.resourceId.videoId)
    .filter(Boolean);
  const detailsMap = await fetchVideoDetailsMap(apiKey, vidIds);
  return { items, detailsMap };
}

// Run
await loadLatestVideos();
