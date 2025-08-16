// Dynamisches Laden der Hero Section
(async function(){
  const host = document.querySelector('section#hero[data-hero-src]');
  if(!host) return;
  const src = host.getAttribute('data-hero-src');
  try {
    const resp = await fetch(src, { cache: 'no-cache' });
    if(!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
    const html = await resp.text();
    host.innerHTML = html; // Inhalt einfügen statt ersetzen (behält id="hero")
    document.dispatchEvent(new CustomEvent('hero:loaded'));
  } catch(err){ console.error('[hero] Laden fehlgeschlagen:', err); }
})();

// Re-Init hero-bezogene Features nach Laden
document.addEventListener('hero:loaded', () => {
  // postHeroEnhancements entfernt (hero-runtime.js gelöscht)
  try { window.__initTyping?.(); } catch(e){}
  if(typeof initParticles === 'function') {
    const canvas = document.getElementById('particleCanvas');
    if(canvas && !canvas.__initialized){ initParticles(); canvas.__initialized = true; }
  }
});