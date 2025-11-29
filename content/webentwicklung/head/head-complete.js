// Dynamic Head Loader - Inserts shared head HTML content into the <head>
// Usage: Add a small script tag in the page head that imports this module early
// and this script will fetch /pages/shared/head.html and inject its markup.

(async function loadSharedHead() {
  try {
    const loaderScript = document.currentScript || document.getElementById('head-loader-script');
    // Keep current document.title as default page title
    const pageTitle = document.title || document.querySelector('title')?.textContent || 'Abdul aus Berlin';

    const resp = await fetch('/pages/shared/head.html', { cache: 'force-cache' });
    if (!resp.ok) {
      console.warn('head-complete: failed to fetch shared head', resp.status);
      return;
    }

    let html = await resp.text();
    html = html.replace(/\{\{PAGE_TITLE}}/g, pageTitle);

      // If the page contains an HTML comment placeholder <!-- SHARED_HEAD -->, replace it with the shared head
      // to preserve page-specific head elements (title, per-page CSS links, etc.). Otherwise we insert
      // the shared head near the front of head.
      let inserted = false;
      for (const node of Array.from(document.head.childNodes)) {
        if (node.nodeType === Node.COMMENT_NODE && /SHARED_HEAD/.test(node.nodeValue)) {
          const range = document.createRange();
          range.setStartBefore(node);
          const frag = range.createContextualFragment(html);
          node.parentNode.replaceChild(frag, node);
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        const insertBefore = loaderScript?.nextSibling || document.head.firstChild;
        const range = document.createRange();
        range.selectNode(document.head);
        const frag = range.createContextualFragment(html);
        document.head.insertBefore(frag, insertBefore);
      }

    // mark as loaded for page-level fallbacks
    try { window.SHARED_HEAD_LOADED = true; } catch (_) {
      // Ignore errors when setting global flag
    }
  } catch (err) {
    console.error('head-complete: failed to load shared head', err);
  }
})();
