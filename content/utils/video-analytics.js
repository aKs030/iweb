/**
 * Video Analytics
 * Handles analytics tracking for video interactions
 */

/**
 * Attaches analytics tracking to video page links
 * @param {HTMLElement} element - Element containing the page link
 * @param {string} vid - Video ID
 * @param {string} title - Video title
 */
export function attachVideoAnalytics(element, vid, title) {
  try {
    const pageLinkEl = element.querySelector('.page-link');
    if (!pageLinkEl) return;

    pageLinkEl.addEventListener('click', () => {
      trackVideoPageOpen(vid, title);
    });
  } catch (err) {
    // ignore analytics setup errors
  }
}

/**
 * Tracks video page open events
 * @param {string} vid - Video ID
 * @param {string} title - Video title
 */
function trackVideoPageOpen(vid, title) {
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

    if (typeof gtag === 'function') {
      // GA4 event
      gtag('event', 'open_video_page', ga4Payload);
      // Optional UA-style event for compatibility
      try {
        gtag('event', 'open_video_page_ua', uaPayload);
      } catch {
        // ignore UA tracking errors
      }
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(
        Object.assign({ event: 'open_video_page' }, ga4Payload),
      );
    }
  } catch (err) {
    // ignore analytics errors
  }
}
