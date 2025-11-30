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
      : document.title || 'Abdul aus Berlin';

    // 2. Shared Head laden (mit Caching für Performance)
    const resp = await fetch('/pages/shared/head.html', { cache: 'force-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    let html = await resp.text();

    // 3. Platzhalter {{PAGE_TITLE}} ersetzen
    html = html.replace(/\{\{PAGE_TITLE}}/g, pageTitle);

    // 4. HTML in DOM-Knoten umwandeln
    const range = document.createRange();
    range.selectNode(document.head);
    const fragment = range.createContextualFragment(html);

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
      const loaderScript =
        document.currentScript || document.querySelector('script[src*="head-complete.js"]');

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
  } catch (err) {
    console.error('[Head-Loader] Fehler beim Laden des Shared Heads:', err);
  }
})();