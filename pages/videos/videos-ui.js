/**
 * @typedef {Window & {
 *   gtag?: (command: string, eventName: string, params: any) => void;
 *   dataLayer?: any[];
 * }} ExtendedWindow
 */

import { BASE_URL } from "#config/constants.js";
import { FAVICON_512_URL } from "#config/media-urls.js";
import { i18n } from "#core/i18n.js";
import { getElementById } from "#core/dom-utils.js";

const VIDEO_PAGE_BASE_URL = `${BASE_URL}/videos/`;
const SVG_NS = "http://www.w3.org/2000/svg";

function createVideoPageUrl(videoId) {
  return `/videos/${videoId}/`;
}

function cleanTitle(value) {
  if (!value) return value;

  return String(value)
    .replace(/\s*([-–—|])\s*(Abdulkerim[\s\S]*)$/i, "")
    .trim();
}

function prependPageMessage(className, message) {
  const container = document.querySelector(".videos-main .container") || document.body;
  const el = document.createElement("aside");
  el.className = className;
  el.textContent = message;
  container.insertBefore(el, container.firstChild);
  setVideoStatus(message);
}

function formatVideoDate(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatCompactNumber(value) {
  const count = Number.parseInt(String(value || 0), 10);
  if (!Number.isFinite(count) || count <= 0) return "";
  try {
    return new Intl.NumberFormat("de-DE", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(count);
  } catch {
    return String(count);
  }
}

function parseIsoDurationToLabel(rawDuration) {
  const value = String(rawDuration || "").trim();
  if (!value.startsWith("P")) return "";

  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return value;

  const days = Number.parseInt(match[1] || "0", 10);
  const hours = Number.parseInt(match[2] || "0", 10);
  const minutes = Number.parseInt(match[3] || "0", 10);
  const seconds = Number.parseInt(match[4] || "0", 10);
  const totalHours = days * 24 + hours;
  const parts = [];

  if (totalHours > 0) parts.push(String(totalHours));
  parts.push(String(minutes).padStart(totalHours > 0 ? 2 : 1, "0"));
  parts.push(String(seconds).padStart(2, "0"));
  return parts.join(":");
}

export function extractVideoViewModel(item, detailsMap = {}) {
  const vid = item?.snippet?.resourceId?.videoId;
  if (!vid) return null;

  const rawTitle = item.snippet.title;
  const title = cleanTitle(rawTitle);
  const description = item.snippet?.description?.trim()
    ? item.snippet.description
    : `${title} — Video von Abdulkerim Sesli`;
  const thumb =
    item.snippet?.thumbnails?.maxres?.url ||
    item.snippet?.thumbnails?.high?.url ||
    item.snippet?.thumbnails?.default?.url ||
    "";
  const publishedAt = item.snippet.publishedAt || new Date().toISOString();
  const videoDetail = detailsMap[vid];
  const duration = videoDetail?.contentDetails?.duration || "";
  const viewCount = videoDetail?.statistics?.viewCount
    ? Number(videoDetail.statistics.viewCount)
    : undefined;

  return {
    id: vid,
    rawTitle,
    title,
    description,
    thumb,
    publishedAt,
    publishedLabel: formatVideoDate(publishedAt),
    duration,
    durationLabel: parseIsoDurationToLabel(duration),
    viewCount,
    viewCountLabel: formatCompactNumber(viewCount),
    watchUrl: `https://www.youtube.com/watch?v=${vid}`,
    shortUrl: `https://youtu.be/${vid}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${vid}`,
    landingPageUrl: createVideoPageUrl(vid),
  };
}

function createMetaPill(label, value) {
  if (!value) return null;
  const pill = document.createElement("span");
  pill.className = "video-featured__pill";

  const labelEl = document.createElement("span");
  labelEl.textContent = label;

  const valueEl = document.createElement("strong");
  valueEl.textContent = value;

  pill.append(labelEl, valueEl);
  return pill;
}

function createPlayButtonIcon() {
  const playButton = document.createElement("span");
  playButton.className = "play-button";
  playButton.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 200 200");

  const polygon = document.createElementNS(SVG_NS, "polygon");
  polygon.setAttribute("points", "70,55 70,145 145,100");

  svg.appendChild(polygon);
  playButton.appendChild(svg);
  return playButton;
}

export function renderFeaturedVideo(target, videoModel, relatedVideos = []) {
  if (!(target instanceof HTMLElement)) return;

  if (!videoModel) {
    target.hidden = true;
    target.textContent = "";
    return;
  }

  target.hidden = false;
  target.textContent = "";

  const article = document.createElement("article");
  article.className = "video-featured__panel";

  const media = document.createElement("div");
  media.className = "video-featured__media";
  const iframe = document.createElement("iframe");
  iframe.src = `${videoModel.embedUrl}?rel=0`;
  iframe.title = videoModel.title;
  iframe.loading = "eager";
  iframe.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  media.appendChild(iframe);

  const content = document.createElement("div");
  content.className = "video-featured__content";

  const eyebrow = document.createElement("span");
  eyebrow.className = "video-featured__eyebrow";
  eyebrow.textContent = "Video Landing";

  const title = document.createElement("h2");
  title.className = "video-featured__title";
  title.textContent = videoModel.title;

  const description = document.createElement("p");
  description.className = "video-featured__description";
  description.textContent = videoModel.description;

  const meta = document.createElement("div");
  meta.className = "video-featured__meta";
  const pills = [
    createMetaPill("Veröffentlicht", videoModel.publishedLabel),
    createMetaPill("Dauer", videoModel.durationLabel),
    createMetaPill("Views", videoModel.viewCountLabel),
  ];
  pills.forEach(pill => {
    if (pill) meta.appendChild(pill);
  });

  const actions = document.createElement("div");
  actions.className = "video-featured__actions";
  const youtubeLink = document.createElement("a");
  youtubeLink.href = videoModel.watchUrl;
  youtubeLink.target = "_blank";
  youtubeLink.rel = "noopener";
  youtubeLink.className = "btn-subscribe video-featured__action";
  youtubeLink.textContent = "Auf YouTube ansehen";

  const pageLink = document.createElement("a");
  pageLink.href = videoModel.landingPageUrl;
  pageLink.className = "btn-share video-featured__action";
  pageLink.textContent = "Direkter Seitenlink";

  actions.append(youtubeLink, pageLink);

  content.append(eyebrow, title, description, meta, actions);

  if (relatedVideos.length) {
    const related = document.createElement("div");
    related.className = "video-featured__related";

    const relatedHeading = document.createElement("span");
    relatedHeading.className = "video-featured__eyebrow";
    relatedHeading.textContent = "Mehr aus dem Kanal";

    const relatedList = document.createElement("div");
    relatedList.className = "video-featured__related-list";

    relatedVideos.forEach(video => {
      const itemLink = document.createElement("a");
      itemLink.className = "video-featured__related-link";
      itemLink.href = video.landingPageUrl;

      const itemTitle = document.createElement("span");
      itemTitle.className = "video-featured__related-title";
      itemTitle.textContent = video.title;

      const itemMeta = document.createElement("span");
      itemMeta.className = "video-featured__related-meta";
      itemMeta.textContent = video.publishedLabel || "Video";

      itemLink.append(itemTitle, itemMeta);
      relatedList.appendChild(itemLink);
    });

    related.append(relatedHeading, relatedList);
    content.appendChild(related);
  }

  article.append(media, content);
  target.appendChild(article);
}

function activateThumb(btn) {
  if (!btn || btn.dataset.loaded) return;
  const vid = btn.dataset.videoId;
  const title = btn.getAttribute("aria-label") || "";
  const wrapper = document.createElement("div");
  wrapper.className = "embed";
  const iframe = document.createElement("iframe");
  iframe.width = "560";
  iframe.height = "315";
  iframe.src = `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0`;
  iframe.title = title;
  iframe.setAttribute("frameBorder", "0");
  iframe.setAttribute(
    "allow",
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  );
  iframe.setAttribute("allowfullscreen", "");
  wrapper.appendChild(iframe);
  btn.dataset.loaded = "1";
  btn.replaceWith(wrapper);
  try {
    iframe.focus();
  } catch {
    /* ignore */
  }
}

export function bindThumb(btn) {
  if (btn.dataset.bound) return;
  if (btn.getAttribute("aria-label") && !btn.querySelector(".visually-hidden")) {
    const span = document.createElement("span");
    span.className = "visually-hidden";
    span.textContent = btn.getAttribute("aria-label");
    btn.appendChild(span);
  }
  const onThumbClick = () => activateThumb(btn);
  const onThumbKeydown = event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateThumb(btn);
    }
  };
  btn.addEventListener("click", onThumbClick);
  btn.addEventListener("keydown", onThumbKeydown);
  btn.__thumbHandlers = { click: onThumbClick, keydown: onThumbKeydown };
  btn.dataset.bound = "1";
}

export function renderVideoCard(container, item, detailsMap, index = 0) {
  const videoModel = extractVideoViewModel(item, detailsMap);
  if (!videoModel) return null;

  const {
    id: vid,
    rawTitle,
    title,
    description,
    thumb,
    publishedAt,
    publishedLabel,
    duration,
    viewCount,
    shortUrl,
    landingPageUrl,
    embedUrl,
  } = videoModel;

  const article = document.createElement("article");
  article.className = "video-card";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const descriptionEl = document.createElement("p");
  descriptionEl.className = "video-desc";
  descriptionEl.textContent = description;

  article.append(heading, descriptionEl);

  const thumbBtn = document.createElement("button");
  thumbBtn.className = "video-thumb";
  thumbBtn.setAttribute("aria-label", `Play ${title}`);
  thumbBtn.dataset.videoId = vid;
  thumbBtn.dataset.thumb = thumb;

  const optimizedThumb = thumb.includes("ytimg.com")
    ? thumb.replace(/\/maxresdefault\.jpg$/, "/hqdefault.jpg")
    : thumb;
  thumbBtn.dataset.thumb = optimizedThumb;

  const thumbImg = document.createElement("img");
  thumbImg.alt = `Thumbnail: ${title}`;
  thumbImg.loading = index < 4 ? "eager" : "lazy";
  thumbImg.decoding = "async";
  thumbImg.className = "video-thumb__img";
  thumbImg.dataset.loaded = "handling";

  const fallbackUrls = [
    optimizedThumb,
    thumb,
    `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
    `https://i.ytimg.com/vi/${vid}/default.jpg`,
  ];

  let currentFallbackIndex = 0;
  thumbImg.onerror = event => {
    /** @type {any} */ (event).stopPropagation();
    currentFallbackIndex += 1;

    if (currentFallbackIndex < fallbackUrls.length) {
      thumbImg.src = fallbackUrls[currentFallbackIndex];
      return;
    }

    thumbImg.alt = `Video: ${title}`;
    thumbImg.dataset.loaded = "error";
  };

  thumbImg.onload = () => {
    thumbImg.dataset.loaded = "true";
  };
  thumbImg.src = optimizedThumb;

  thumbBtn.append(createPlayButtonIcon(), thumbImg);

  const meta = document.createElement("div");
  meta.className = "video-meta";

  const videoInfo = document.createElement("div");
  videoInfo.className = "video-info";
  const pubDate = document.createElement("small");
  pubDate.className = "pub-date";
  pubDate.textContent = publishedLabel || publishedAt;
  videoInfo.appendChild(pubDate);

  const videoActions = document.createElement("div");
  videoActions.className = "video-actions u-row";

  const youtubeAnchor = document.createElement("a");
  youtubeAnchor.href = shortUrl;
  youtubeAnchor.target = "_blank";
  youtubeAnchor.rel = "noopener";
  youtubeAnchor.textContent = i18n.t("videos.open_youtube");

  const landingAnchor = document.createElement("a");
  landingAnchor.href = landingPageUrl;
  landingAnchor.className = "page-link";
  landingAnchor.title = i18n.t("videos.open_landing");
  landingAnchor.dataset.videoId = vid;
  landingAnchor.dataset.videoTitle = title;
  landingAnchor.textContent = i18n.t("videos.open_page");

  videoActions.append(youtubeAnchor, landingAnchor);
  meta.append(videoInfo, videoActions);

  const publisherName = "Abdulkerim Sesli";
  const canonicalWatchUrl = `https://www.youtube.com/watch?v=${vid}`;
  const landingPageUrlAbsolute = `${VIDEO_PAGE_BASE_URL}${vid}/`;
  const schemaNode = {
    "@type": "VideoObject",
    "@id": `${VIDEO_PAGE_BASE_URL}#video-${vid}`,
    name: `${rawTitle} — ${publisherName}`,
    description,
    thumbnailUrl: thumb,
    uploadDate: publishedAt,
    url: canonicalWatchUrl,
    contentUrl: canonicalWatchUrl,
    embedUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": landingPageUrlAbsolute },
    isFamilyFriendly: true,
    publisher: {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: publisherName,
      url: `${BASE_URL}/`,
      logo: {
        "@type": "ImageObject",
        url: FAVICON_512_URL,
        contentUrl: FAVICON_512_URL,
        creator: { "@type": "Person", name: "Abdulkerim Sesli" },
        license: `${BASE_URL}/#image-license`,
        creditText: "Logo: Abdulkerim Sesli",
        copyrightNotice: `© ${new Date().getFullYear()} Abdulkerim Sesli`,
        acquireLicensePage: `${BASE_URL}/#image-license`,
      },
    },
  };

  if (duration) schemaNode.duration = duration;
  if (viewCount !== undefined) {
    schemaNode.interactionStatistic = {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/WatchAction",
      userInteractionCount: viewCount,
    };
  }

  container.appendChild(article);
  article.appendChild(thumbBtn);
  article.appendChild(meta);

  try {
    const pageLinkEl = meta.querySelector(".page-link");
    if (pageLinkEl) {
      pageLinkEl.addEventListener("click", () => {
        try {
          const ga4Payload = {
            video_id: vid,
            video_title: title,
            page_location: location.href,
          };
          const uaPayload = {
            event_category: "video",
            event_label: title,
            video_id: vid,
          };
          const win = /** @type {ExtendedWindow} */ (window);
          if (typeof win.gtag === "function") {
            win.gtag("event", "open_video_page", ga4Payload);
            try {
              win.gtag("event", "open_video_page_ua", uaPayload);
            } catch {
              /* ignore secondary analytics errors */
            }
          } else if (Array.isArray(win.dataLayer)) {
            win.dataLayer.push({
              event: "open_video_page",
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
  const el = getElementById("videos-status");
  if (el) el.textContent = message || "";
}

export function showErrorMessage(error) {
  try {
    let message = i18n.t("videos.error");
    if (error?.status === 400) {
      message +=
        " API-Key ungültig (400). Prüfe in der Google Cloud Console, ob der Key aktiv ist und die YouTube Data API v3 freigeschaltet ist.";
      if (
        /API_KEY_INVALID|API key not valid/.test((error?.body || "") + " " + (error?.message || ""))
      ) {
        message += " Hinweis: Der API-Key scheint ungültig zu sein.";
      }
    } else if (error?.status === 403) {
      message +=
        " API-Zugriff verweigert (403). Prüfe deine API-Key Referrer-Einschränkungen oder teste über http://localhost:8000.";
      if (/API_KEY_HTTP_REFERRER_BLOCKED|Requests from referer/.test(error?.body || "")) {
        message += " Hinweis: Requests mit leerem Referer werden geblockt.";
      }
    } else if (error?.message) {
      message += ` ${String(error.message).slice(0, 200)}`;
    }

    prependPageMessage("video-error", message);
  } catch {
    /* ignore UI errors */
  }
}

export function showInfoMessage(message) {
  try {
    prependPageMessage("video-note", message);
  } catch {
    /* ignore UI errors */
  }
}
