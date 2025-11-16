(async function () {
  const { createLogger } = await import('../../content/webentwicklung/shared-utilities.js');
  const logger = createLogger('AboutModule');
  const host = document.querySelector('section#about[data-about-src]');
  if (!host) return;
  const src = host.getAttribute('data-about-src');
  try {
    const resp = await fetch(src, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    const html = await resp.text();
    host.innerHTML = html;
    document.dispatchEvent(new CustomEvent('about:loaded'));
  } catch (err) {
    logger.warn('Failed to load about.html content', err);
  }
})();
