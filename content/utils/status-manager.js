/**
 * Status Manager Utility
 * Centralized status message handling for UI components
 */

/**
 * Sets status message in a designated status element
 * @param {string} msg - The status message to display
 * @param {string} elementId - The ID of the status element (default: 'videos-status')
 */
export function setStatus(msg, elementId = 'videos-status') {
  try {
    const el = document.getElementById(elementId);
    if (el) el.textContent = msg || '';
  } catch {
    // ignore DOM errors
  }
}

/**
 * Shows an error message in the page
 * @param {Error} err - The error object
 * @param {string} containerSelector - CSS selector for the container element
 */
export function showErrorMessage(
  err,
  containerSelector = '.videos-main .container',
) {
  try {
    const container =
      document.querySelector(containerSelector) || document.body;
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
    setStatus(el.textContent);
  } catch {
    // ignore UI errors
  }
}

/**
 * Shows an informational message in the page
 * @param {string} msg - The message to display
 * @param {string} containerSelector - CSS selector for the container element
 */
export function showInfoMessage(
  msg,
  containerSelector = '.videos-main .container',
) {
  try {
    const container =
      document.querySelector(containerSelector) || document.body;
    const el = document.createElement('aside');
    el.className = 'video-note';
    el.textContent = msg;
    container.insertBefore(el, container.firstChild);
    setStatus(msg);
  } catch {
    // ignore UI errors
  }
}
