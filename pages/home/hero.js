// Dynamisches Laden der Hero Section (ES Modul)
import { createLogger, safeCall } from "../../content/webentwicklung/utils/logger.js";
const log = createLogger('hero');

(async function(){
  const host = document.querySelector('section#hero[data-hero-src]');
  if(!host) return;
  const src = host.getAttribute('data-hero-src');
  const skeleton = host.querySelector('.hero-skeleton');
  let done = false;

  // Accessibility: Busy Status setzen
  host.setAttribute('aria-busy','true');

  // Fallback Timeout: blendet Skeleton nach 5s aus (Fehler-Schutz)
  const fallbackTimer = setTimeout(() => {
    if (done) return;
    if (skeleton) {
      skeleton.classList.add('fade-out');
      skeleton.addEventListener('transitionend', () => skeleton.remove(), { once:true });
    }
  }, 5000);

  try {
    const resp = await fetch(src, { cache: 'no-cache' });
    if(!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
    const html = await resp.text();
    host.innerHTML = html; // Inhalt einfügen statt ersetzen (behält id="hero")
    done = true;
    clearTimeout(fallbackTimer);
    // Skeleton Fade-Out (nach innerHTML neu suchen – falls bestehen geblieben)
    const sk = host.querySelector('.hero-skeleton');
    if (sk) {
      requestAnimationFrame(() => {
        sk.classList.add('fade-out');
        sk.addEventListener('transitionend', () => sk.remove(), { once:true });
      });
    }
  host.removeAttribute('aria-busy');
  document.dispatchEvent(new CustomEvent('hero:loaded'));
  } catch(err){
    log.error('Laden fehlgeschlagen:', err);
    done = true;
    clearTimeout(fallbackTimer);
  if (skeleton) {
      skeleton.classList.add('fade-out');
      skeleton.addEventListener('transitionend', () => skeleton.remove(), { once:true });
    }
  host.removeAttribute('aria-busy');
  }
})();

// Re-Init hero-bezogene Features nach Laden
document.addEventListener('hero:loaded', () => {
  safeCall(() => window.__initTyping?.(), { logger: log, label: '__initTyping' });
  if(typeof initParticles === 'function') {
    const canvas = document.getElementById('particleCanvas');
    if(canvas && !canvas.__initialized){ safeCall(() => initParticles(), { logger: log, label: 'initParticles' }); canvas.__initialized = true; }
  }
});