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
    const resp = await fetch('/content/head/head.html', { cache: 'force-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    let html = await resp.text();

    // 3. Page meta overrides (Title already replaced above) — Description & OG Image
    // Try find per-page description (meta[name="description"]), og:description, or data attribute
    const defaultDescription = 'Abdul aus Berlin - Portfolio von Abdulkerim Sesli - Webentwicklung, Fotografie und kreative digitale Projekte.';
    const defaultOgImage = 'https://abdulkerimsesli.de/content/img/og/og-home.svg';

    const findFirstMetaContent = (selectorList) => {
      for (const sel of selectorList) {
        const el = document.querySelector(sel);
        if (el && el.getAttribute('content')) return el.getAttribute('content').trim();
      }
      return null;
    };

    let pageDescription = findFirstMetaContent([
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]'
    ]) || document.documentElement?.dataset?.pageDescription || document.body?.dataset?.pageDescription || null;

    let pageOgImage = findFirstMetaContent([
      'meta[property="og:image"]',
      'meta[name="twitter:image"]'
    ]) || document.documentElement?.dataset?.ogImage || document.body?.dataset?.ogImage || null;

    // If meta/data attributes didn't provide a description or OG image, inspect JSON-LD for first usable fields
    if (!pageDescription || !pageOgImage) {
      try {
        const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const pickFromLD = (obj) => {
          if (!obj || typeof obj !== 'object') return {};
          if (typeof obj.description === 'string') return { description: obj.description };
          if (typeof obj.image === 'string') return { image: obj.image };
          // image can be object { '@type':'ImageObject', 'url': '...' }
          if (obj.image && typeof obj.image === 'object' && typeof obj.image.url === 'string') return { image: obj.image.url };
          // '@graph' arrays
          if (Array.isArray(obj['@graph'])) {
            for (const g of obj['@graph']) {
              const r = pickFromLD(g);
              if (r.description || r.image) return r;
            }
          }
          // fallback: check nested properties
          for (const k in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, k) && typeof obj[k] === 'object') {
              const r = pickFromLD(obj[k]);
              if (r.description || r.image) return r;
            }
          }
          return {};
        };
        for (const s of ldScripts) {
          try {
            const parsed = JSON.parse(s.textContent);
            const res1 = pickFromLD(parsed);
            if (!pageDescription && res1.description) pageDescription = res1.description;
            if (!pageOgImage && res1.image) pageOgImage = res1.image;
            if (pageDescription && pageOgImage) break;
          } catch (e) {
            // ignore parse errors
          }
        }
      } catch (e) {}
    }

    // Replace placeholders if present in the head HTML
    html = html.replace(/\{\{PAGE_TITLE}}/g, pageTitle);
    html = html.replace(/\{\{PAGE_DESCRIPTION}}/g, (pageDescription || defaultDescription));
    html = html.replace(/\{\{PAGE_OG_IMAGE}}/g, (pageOgImage || defaultOgImage));

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

    // Entferne existierende Meta/Link-Elemente, die vom Shared Head ersetzt werden (z. B. description, og:image etc.)
    try {
      const fragmentAssets = Array.from(fragment.querySelectorAll('meta[name], meta[property], link[rel], link[rel="icon"], link[rel="apple-touch-icon"]'));
      fragmentAssets.forEach((node) => {
        const n = node.getAttribute('name');
        const p = node.getAttribute('property');
        const r = node.getAttribute('rel');
        try {
          if (n) {
            const existing = document.head.querySelector(`meta[name="${CSS.escape(n)}"]`);
            if (existing) existing.remove();
          }
          if (p) {
            const existing = document.head.querySelector(`meta[property="${CSS.escape(p)}"]`);
            if (existing) existing.remove();
          }
          if (r) {
            const existing = document.head.querySelector(`link[rel="${CSS.escape(r)}"]`);
            if (existing) existing.remove();
          }
        } catch (er) {
          // CSS.escape may not exist in older browser; fallback to string match
          if (n) {
            const existing = document.head.querySelector(`meta[name="${n}"]`);
            if (existing) existing.remove();
          }
          if (p) {
            const existing = document.head.querySelector(`meta[property="${p}"]`);
            if (existing) existing.remove();
          }
          if (r) {
            const existing = document.head.querySelector(`link[rel="${r}"]`);
            if (existing) existing.remove();
          }
        }
      });
    } catch (e) {
      console.warn('[Head-Loader] Duplicate removal failed:', e);
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
    
    // 7a. Skripte aus dem Shared Head sicher ausführen (insb. Module wie /content/main.js)
    try {
      const toExec = document.head.querySelectorAll('script[data-exec-on-insert="1"]');
      toExec.forEach((oldScript) => {
        const newScript = document.createElement('script');
        // Attribute kopieren
        for (const { name, value } of Array.from(oldScript.attributes)) {
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
      console.warn('[Head-Loader] Script execution reinforcement failed:', e);
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
        else
          document.addEventListener(
            'DOMContentLoaded',
            () => document.body.prepend(loaderWrapper),
            { once: true }
          );
      }
    } catch (e) {
      // Non-critical: injection failure shouldn't break the page
      console.warn('[Head-Loader] Could not ensure global loader element:', e);
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
      window.addEventListener('load', hideLoader, { once: true });
      // Früheres Sicherheitsnetz: kurz nach DOMContentLoaded ausblenden (falls main.js nicht greift)
      const scheduleEarlyHide = () => setTimeout(hideLoader, 1200);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleEarlyHide, { once: true });
      } else {
        scheduleEarlyHide();
      }
      // Spätestes Sicherheitsnetz: nach 5s ausblenden
      setTimeout(hideLoader, 5000);
    } catch (e) {
      console.warn('[Head-Loader] Fallback loader hide failed:', e);
    }
  } catch (err) {
    console.error('[Head-Loader] Fehler beim Laden des Shared Heads:', err);
  }
})();
