// card-fit.js — modern embed engine
(function () {
  const params = new URLSearchParams(location.search);
  const force = params.get('card') === '1';

  const embedded = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  if (!force && !embedded) return;

  let wrapper;

  function wrap() {
    if (wrapper) return wrapper;

    wrapper = document.createElement('div');
    wrapper.id = 'card-root';
    wrapper.style.transformOrigin = 'top left';
    wrapper.style.willChange = 'transform';

    while (document.body.firstChild)
      wrapper.appendChild(document.body.firstChild);

    document.body.appendChild(wrapper);

    Object.assign(document.body.style, {
      margin: 0,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
    });

    return wrapper;
  }

  let raf;
  function fit() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const w = wrap();

      w.style.transform = 'none';

      const r = w.getBoundingClientRect();

      const scale = Math.min(innerWidth / r.width, innerHeight / r.height, 1);

      w.style.transform = scale === 1 ? 'none' : `scale(${scale})`;
    });
  }

  window.addEventListener('resize', fit, { passive: true });
  window.addEventListener('orientationchange', fit, { passive: true });
  window.addEventListener('load', fit);
  document.addEventListener('DOMContentLoaded', fit);

  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(fit);
    document.addEventListener('DOMContentLoaded', () => ro.observe(wrap()));
  }

  window.cardFit = { fit };
})();
