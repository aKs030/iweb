/**
 * Dynamic Head Loader - Optimierte Version
 * Lädt globale Meta-Tags, Styles und Skripte zentral nach.
 * Verwaltet Titel-Ersetzung und verhindert Redundanz.
 */

(async function loadSharedHead() {
  // Verhindere mehrfache Ausführung
  if (window.SHARED_HEAD_LOADED) return;

  try {
    // 1. Titel der aktuellen Seite sichern
    const existingTitleEl = document.querySelector('title');
    const pageTitle = existingTitleEl
      ? existingTitleEl.textContent
      : document.title || 'Abdulkerim — Digital Creator Portfolio';

    // 2. Shared Head laden (mit Caching für Performance)
    const resp = await fetch('/content/components/head/head.html', {cache: 'force-cache'});
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    let html = await resp.text();

    // 3. Platzhalter {{PAGE_TITLE}} ersetzen
    html = html.replace(/\{\{PAGE_TITLE}}/g, pageTitle);

    // 4. HTML in DOM-Knoten umwandeln
    const range = document.createRange();
    range.selectNode(document.head);
    const fragment = range.createContextualFragment(html);

    // 4a. Markiere Skripte im Fragment zur späteren erneuten Ausführung
    const fragmentScripts = Array.from(fragment.querySelectorAll('script'));
    fragmentScripts.forEach((s, idx) => {
      // Nicht ausführen, wenn bereits speziell blockiert (z.B. consent-blocked via type="text/plain")
      // Kennzeichne ansonsten zur gezielten Re-Initialisierung nach dem Einfügen
      if (s.type && s.type.toLowerCase() === 'text/plain') return;
      s.setAttribute('data-exec-on-insert', '1');
      s.setAttribute('data-exec-id', String(idx));
    });

    // 5. Duplikate bereinigen:
    // Wenn das Fragment einen <title> enthält und die Seite auch,
    // entfernen wir den alten Titel der Seite, damit der neue (im Shared Head) gewinnt.
    if (fragment.querySelector('title') && existingTitleEl) {
      existingTitleEl.remove();
    }

    // 6. Einfügepunkt finden (<!-- SHARED_HEAD -->)
    let inserted = false;
    const childNodes = Array.from(document.head.childNodes);

    for (const node of childNodes) {
      if (node.nodeType === Node.COMMENT_NODE && node.nodeValue.includes('SHARED_HEAD')) {
        node.parentNode.replaceChild(fragment, node);
        inserted = true;
        break;
      }
    }

    // Fallback: Wenn kein Kommentar gefunden wurde, intelligent einfügen
    if (!inserted) {
      // Das Loader-Skript selbst finden, um davor einzufügen (verhindert FOUC besser)
      const loaderScript = document.currentScript || document.querySelector('script[src*="head-complete.js"]');

      if (loaderScript && loaderScript.parentNode === document.head) {
        loaderScript.parentNode.insertBefore(fragment, loaderScript);
      } else {
        // Fallback 2: Vor dem ersten Style oder Script
        const firstAsset = document.head.querySelector('link[rel="stylesheet"], style, script');
        if (firstAsset) {
          document.head.insertBefore(fragment, firstAsset);
        } else {
          document.head.appendChild(fragment);
        }
      }
    }

    // 7. Status setzen und Event feuern
    window.SHARED_HEAD_LOADED = true;
    document.dispatchEvent(new CustomEvent('shared-head:loaded'));

    // 7a. Skripte aus dem Shared Head sicher ausführen (insb. Module wie /content/main.js)
    try {
      const toExec = document.head.querySelectorAll('script[data-exec-on-insert="1"]');
      toExec.forEach(oldScript => {
        const newScript = document.createElement('script');
        // Attribute kopieren
        for (const {name, value} of Array.from(oldScript.attributes)) {
          if (name === 'data-exec-on-insert') continue;
          newScript.setAttribute(name, value);
        }
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else if (oldScript.textContent && oldScript.textContent.trim()) {
          newScript.textContent = oldScript.textContent;
        }
        // Ersetzen, damit der Browser das Skript tatsächlich lädt/ausführt
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
    } catch (e) {
      // Script execution reinforcement failed - non-critical
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Head-Loader] Script execution reinforcement failed:', e);
      }
    }
    // 8. Ensure a single global loader exists across pages (for consistent UX)
    try {
      // Only inject if not already present in the DOM
      if (!document.getElementById('loadingScreen')) {
        const loaderWrapper = document.createElement('div');
        loaderWrapper.id = 'loadingScreen';
        loaderWrapper.className = 'loading-screen';
        loaderWrapper.setAttribute('aria-hidden', 'true');
        loaderWrapper.setAttribute('aria-label', 'Seite wird geladen');
        loaderWrapper.setAttribute('role', 'status');
        loaderWrapper.setAttribute('aria-live', 'polite');

        const spinner = document.createElement('div');
        spinner.className = 'loader';
        spinner.setAttribute('aria-hidden', 'true');

        loaderWrapper.appendChild(spinner);
        // Prepend so loader sits above page content
        if (document.body) document.body.prepend(loaderWrapper);
        else document.addEventListener('DOMContentLoaded', () => document.body.prepend(loaderWrapper), {once: true});
      }
    } catch (e) {
      // Non-critical: injection failure shouldn't break the page
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Head-Loader] Could not ensure global loader element:', e);
      }
    }

    // 9. Fallback: Loader automatisch ausblenden, falls keine App-Logik (main.js) übernimmt
    //    Verhindert Hängenbleiben auf simplen statischen Seiten (Legal/Privacy).
    try {
      const MIN_DISPLAY_TIME = 400;
      let start = performance.now();

      const hideLoader = () => {
        const el = document.getElementById('loadingScreen');
        if (!el) return;
        const elapsed = performance.now() - start;
        const wait = Math.max(0, MIN_DISPLAY_TIME - elapsed);
        setTimeout(() => {
          el.classList.add('hide');
          el.setAttribute('aria-hidden', 'true');
          Object.assign(el.style, {
            opacity: '0',
            pointerEvents: 'none',
            visibility: 'hidden'
          });
          const cleanup = () => {
            el.style.display = 'none';
            el.removeEventListener('transitionend', cleanup);
          };
          el.addEventListener('transitionend', cleanup);
          setTimeout(cleanup, 700);
        }, wait);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => (start = performance.now()), {
          once: true
        });
      } else {
        start = performance.now();
      }

      // Normalfall: sobald alles geladen ist, ausblenden
      window.addEventListener('load', hideLoader, {once: true});
      // Früheres Sicherheitsnetz: kurz nach DOMContentLoaded ausblenden (falls main.js nicht greift)
      const scheduleEarlyHide = () => setTimeout(hideLoader, 1200);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleEarlyHide, {once: true});
      } else {
        scheduleEarlyHide();
      }
      // Spätestes Sicherheitsnetz: nach 5s ausblenden
      setTimeout(hideLoader, 5000);
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Head-Loader] Fallback loader hide failed:', e);
      }
    }
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[Head-Loader] Fehler beim Laden des Shared Heads:', err);
    }
  }
})();
