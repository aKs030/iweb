/**
 * @typedef {Window & {
 *   gtag?: (command: string, eventName: string, params: any) => void;
 *   dataLayer?: any[];
 * }} ExtendedWindow
 */

import { BASE_URL, FAVICON_512 } from '#config/constants.js';
import { i18n } from '#core/i18n.js';
import { escapeHTML, getElementById } from '#core/utils.js';

const VIDEO_PAGE_BASE_URL = `${BASE_URL}/videos/`;

function cleanTitle(value) {
  if (!value) return value;

  return String(value)
    .replace(/\s*([-–—|])\s*(Abdulkerim[\s\S]*)$/i, '')
    .trim();
}

function prependPageMessage(className, message) {
  const container =
    document.querySelector('.videos-main .container') || document.body;
  const el = document.createElement('aside');
  el.className = className;
  el.textContent = message;
  container.insertBefore(el, container.firstChild);
  setVideoStatus(message);
}

export function activateThumb(btn) {
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
  btn.dataset.loaded = '1';
  btn.replaceWith(wrapper);
  try {
    iframe.focus();
  } catch {
    /* ignore */
  }
}

export function bindThumb(btn) {
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
  const onThumbClick = () => activateThumb(btn);
  const onThumbKeydown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateThumb(btn);
    }
  };
  btn.addEventListener('click', onThumbClick);
  btn.addEventListener('keydown', onThumbKeydown);
  btn.__thumbHandlers = { click: onThumbClick, keydown: onThumbKeydown };
  btn.dataset.bound = '1';
}

export function renderVideoCard(container, item, detailsMap, index = 0) {
  const vid = item.snippet.resourceId.videoId;
  const rawTitle = item.snippet.title;
  const title = cleanTitle(rawTitle);
  const description = item.snippet?.description?.trim()
    ? item.snippet.description
    : `${title} — Video von Abdulkerim Sesli`;
  const thumb =
    item.snippet?.thumbnails?.maxres?.url ||
    item.snippet?.thumbnails?.high?.url ||
    item.snippet?.thumbnails?.default?.url;
  const publishedAt = item.snippet.publishedAt || new Date().toISOString();

  const videoDetail = detailsMap[vid];
  const duration = videoDetail?.contentDetails?.duration;
  const viewCount = videoDetail?.statistics?.viewCount
    ? Number(videoDetail.statistics.viewCount)
    : undefined;

  const article = document.createElement('article');
  article.className = 'video-card';
  article.innerHTML = `
    <h2>${escapeHTML(title)}</h2>
    <p class="video-desc">${escapeHTML(description)}</p>
  `;

  const thumbBtn = document.createElement('button');
  thumbBtn.className = 'video-thumb';
  thumbBtn.setAttribute('aria-label', `Play ${title}`);
  thumbBtn.dataset.videoId = vid;
  thumbBtn.dataset.thumb = thumb;

  const optimizedThumb = thumb.includes('ytimg.com')
    ? thumb.replace(/\/maxresdefault\.jpg$/, '/hqdefault.jpg')
    : thumb;
  thumbBtn.dataset.thumb = optimizedThumb;

  const thumbImg = document.createElement('img');
  thumbImg.alt = `Thumbnail: ${title}`;
  thumbImg.loading = index < 4 ? 'eager' : 'lazy';
  thumbImg.decoding = 'async';
  thumbImg.dataset.loaded = 'handling';
  thumbImg.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';

  const fallbackUrls = [
    optimizedThumb,
    thumb,
    `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
    `https://i.ytimg.com/vi/${vid}/default.jpg`,
  ];

  let currentFallbackIndex = 0;
  thumbImg.onerror = (event) => {
    event.stopPropagation();
    currentFallbackIndex += 1;

    if (currentFallbackIndex < fallbackUrls.length) {
      thumbImg.src = fallbackUrls[currentFallbackIndex];
      return;
    }

    thumbImg.style.backgroundColor = '#1a1a1a';
    thumbImg.style.opacity = '0';
    thumbImg.alt = `Video: ${title}`;
    thumbImg.dataset.loaded = 'error';
  };

  thumbImg.onload = () => {
    thumbImg.dataset.loaded = 'true';
  };
  thumbImg.src = optimizedThumb;

  thumbBtn.innerHTML =
    '<span class="play-button" aria-hidden="true"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><polygon points="70,55 70,145 145,100"/></svg></span>';
  thumbBtn.appendChild(thumbImg);

  const meta = document.createElement('div');
  meta.className = 'video-meta';
  meta.innerHTML = `<div class="video-info"><small class="pub-date">${publishedAt}</small></div><div class="video-actions u-row"><a href="https://youtu.be/${vid}" target="_blank" rel="noopener">${i18n.t(
    'videos.open_youtube',
  )}</a> <a href="/videos/${vid}/" class="page-link" title="${i18n.t(
    'videos.open_landing',
  )}" data-video-id="${vid}" data-video-title="${escapeHTML(
    title,
  )}">${i18n.t('videos.open_page')}</a></div>`;

  const publisherName = 'Abdulkerim Sesli';
  const canonicalWatchUrl = `https://www.youtube.com/watch?v=${vid}`;
  const landingPageUrl = `${VIDEO_PAGE_BASE_URL}${vid}/`;
  const schemaNode = {
    '@type': 'VideoObject',
    '@id': `${VIDEO_PAGE_BASE_URL}#video-${vid}`,
    name: `${rawTitle} — ${publisherName}`,
    description,
    thumbnailUrl: thumb,
    uploadDate: publishedAt,
    url: canonicalWatchUrl,
    contentUrl: canonicalWatchUrl,
    embedUrl: `https://www.youtube-nocookie.com/embed/${vid}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': landingPageUrl },
    isFamilyFriendly: true,
    publisher: {
      '@type': 'Organization',
      '@id': `${BASE_URL}/#organization`,
      name: publisherName,
      url: `${BASE_URL}/`,
      logo: {
        '@type': 'ImageObject',
        url: FAVICON_512,
        contentUrl: FAVICON_512,
        creator: { '@type': 'Person', name: 'Abdulkerim Sesli' },
        license: `${BASE_URL}/#image-license`,
        creditText: 'Logo: Abdulkerim Sesli',
        copyrightNotice: `© ${new Date().getFullYear()} Abdulkerim Sesli`,
        acquireLicensePage: `${BASE_URL}/#image-license`,
      },
    },
  };

  if (duration) schemaNode.duration = duration;
  if (viewCount !== undefined) {
    schemaNode.interactionStatistic = {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/WatchAction',
      userInteractionCount: viewCount,
    };
  }

  container.appendChild(article);
  article.appendChild(thumbBtn);
  article.appendChild(meta);

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
            win.gtag('event', 'open_video_page', ga4Payload);
            try {
              win.gtag('event', 'open_video_page_ua', uaPayload);
            } catch {
              /* ignore legacy analytics errors */
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

  bindThumb(thumbBtn);
  return schemaNode;
}

export function setVideoStatus(message) {
  const el = getElementById('videos-status');
  if (el) el.textContent = message || '';
}

export function showErrorMessage(error) {
  try {
    let message = i18n.t('videos.error');
    if (error?.status === 400) {
      message +=
        ' API-Key ungültig (400). Prüfe in der Google Cloud Console, ob der Key aktiv ist und die YouTube Data API v3 freigeschaltet ist.';
      if (
        /API_KEY_INVALID|API key not valid/.test(
          (error?.body || '') + ' ' + (error?.message || ''),
        )
      ) {
        message += ' Hinweis: Der API-Key scheint ungültig zu sein.';
      }
    } else if (error?.status === 403) {
      message +=
        ' API-Zugriff verweigert (403). Prüfe deine API-Key Referrer-Einschränkungen oder teste über http://localhost:8000.';
      if (
        /API_KEY_HTTP_REFERRER_BLOCKED|Requests from referer/.test(
          error?.body || '',
        )
      ) {
        message += ' Hinweis: Requests mit leerem Referer werden geblockt.';
      }
    } else if (error?.message) {
      message += ` ${String(error.message).slice(0, 200)}`;
    }

    prependPageMessage('video-error', message);
  } catch {
    /* ignore UI errors */
  }
}

export function showInfoMessage(message) {
  try {
    prependPageMessage('video-note', message);
  } catch {
    /* ignore UI errors */
  }
}
