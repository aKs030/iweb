/**
 * Video Card Renderer
 * Handles DOM creation and rendering for video cards
 */

import { FAVICON_512 } from '../config/site-config.js';

/**
 * Escapes HTML characters in a string
 * @param {string} s - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Cleans video titles by removing channel suffixes
 * @param {string} s - Title to clean
 * @returns {string} Cleaned title
 */
export function cleanTitle(s) {
  if (!s) return s;
  // Remove trailing separator and channel name starting with Abdulkerim
  return String(s)
    .replace(/\s*([-–—|])\s*(Abdulkerim[\s\S]*)$/i, '')
    .trim();
}

/**
 * Creates video card HTML structure
 * @param {Object} videoData - Processed video data
 * @returns {HTMLElement} Article element containing the video card
 */
export function createVideoCardElement(videoData) {
  const { vid, title, desc, thumb, pub } = videoData;

  const article = document.createElement('article');
  article.className = 'video-card';
  article.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <p class="video-desc">${escapeHtml(desc)}</p>
  `;

  const thumbBtn = createThumbnailButton(vid, title, thumb);
  const meta = createVideoMeta(vid, title, pub);

  article.appendChild(thumbBtn);
  article.appendChild(meta);

  return article;
}

/**
 * Creates thumbnail button element
 * @param {string} vid - Video ID
 * @param {string} title - Video title
 * @param {string} thumb - Thumbnail URL
 * @returns {HTMLElement} Button element
 */
function createThumbnailButton(vid, title, thumb) {
  const thumbBtn = document.createElement('button');
  thumbBtn.className = 'video-thumb';
  thumbBtn.setAttribute('aria-label', `Play ${title}`);
  thumbBtn.dataset.videoId = vid;
  thumbBtn.dataset.thumb = thumb;
  thumbBtn.innerHTML =
    '<span class="play-button" aria-hidden="true"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><polygon points="70,55 70,145 145,100"/></svg></span>';

  return thumbBtn;
}

/**
 * Creates video metadata section
 * @param {string} vid - Video ID
 * @param {string} title - Video title
 * @param {string} pub - Publication date
 * @returns {HTMLElement} Div element containing metadata
 */
function createVideoMeta(vid, title, pub) {
  const meta = document.createElement('div');
  meta.className = 'video-meta';
  meta.innerHTML = `
    <div class="video-info">
      <small class="pub-date">${pub}</small>
    </div>
    <div class="video-actions u-row">
      <a href="https://youtu.be/${vid}" target="_blank" rel="noopener">Auf YouTube öffnen</a> 
      <a href="/videos/${vid}/" class="page-link" title="Öffne Landing‑Page für dieses Video" data-video-id="${vid}" data-video-title="${escapeHtml(
    title,
  )}">Seite öffnen</a>
    </div>
  `;

  return meta;
}

/**
 * Creates JSON-LD structured data for video
 * @param {Object} videoData - Video data including metadata
 * @returns {HTMLElement} Script element containing JSON-LD
 */
export function createVideoStructuredData(videoData) {
  const { rawTitle, desc, thumb, pub, vid, duration, viewCount } = videoData;

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

  return ld;
}
