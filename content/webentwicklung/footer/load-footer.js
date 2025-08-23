(function(){
  if (window.FooterLoader) return;
  window.FooterLoader = true;

  async function loadFooter(){
    const container = document.getElementById('footer-container');
    if (!container) return;
    if (container.dataset.loaded === '1') return;
    const url = container.dataset.footerSrc || container.getAttribute('data-footer-src') || '/content/webentwicklung/footer/footer.html';
    container.setAttribute('aria-busy','true');
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText + ' @ ' + url);
      const html = await res.text();
      container.insertAdjacentHTML('beforeend', html);
      // Nach dem Einfügen die echte Footer-Höhe messen und CSS-Variable setzen
      const footerEl = container.querySelector('.site-footer') || container.firstElementChild;
      if (footerEl) {
        const setFooterHeight = () => {
          const h = Math.ceil(footerEl.getBoundingClientRect().height);
          document.documentElement.style.setProperty('--footer-height', h + 'px');
        };
        // Initial setzen
        setFooterHeight();
        // ResizeObserver für dynamische Änderung
        if (window.ResizeObserver) {
          const ro = new ResizeObserver(entries => {
            for (const e of entries) setFooterHeight();
          });
          ro.observe(footerEl);
        }
        // MutationObserver für DOM-Änderungen innerhalb des Footers
        const mo = new MutationObserver(() => setFooterHeight());
        mo.observe(footerEl, { childList: true, subtree: true, characterData: true });
      }
      container.dataset.loaded = '1';
    } catch (err) {
      console.error('FooterLoader:', err);
      container.dataset.loaded = 'error';
    } finally {
      container.removeAttribute('aria-busy');
    }
  }

  if (document.readyState !== 'loading') loadFooter();
  else document.addEventListener('DOMContentLoaded', loadFooter);
})();
