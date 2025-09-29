/**
 * Footer Resizer
 * Ziel: Footer nie höher als 60% des Bildschirms; Inhalte passen sich ohne Media Queries proportional an.
 * Technik: Dynamische Viewport-Messung (inkl. iOS Safe-Area), CSS-Variablen, ResizeObserver/Events.
 */

import { throttle } from '../utils/common-utils.js';

const STATE = { inited: false, observers: [], t1: null, t2: null };

function setCSSVar(name, value) {
  document.documentElement.style.setProperty(name, value);
}
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name);
}
function ensureCSSVar(name, value) {
  if (getCSSVar(name) !== value) setCSSVar(name, value);
}

function measureViewport() {
  // visualViewport.height bildet iOS Safari Adressleisten-Animationen zuverlässig ab
  const vv = window.visualViewport;
  const h = Math.max(
    1,
    vv?.height ??
      window.innerHeight ??
      document.documentElement.clientHeight ??
      0
  );
  return { h, usable: h };
}

function computeScale() {
  // Leichte proportionale Skalierung auf sehr kleinen Displays
  const w = Math.max(320, window.innerWidth);
  const scale = Math.max(0.8, Math.min(1, 0.88 + w / 2000)); // 0.88..1 zwischen 320px..2000px
  return Number(scale.toFixed(3));
}

function apply() {
  const siteFooter = document.getElementById('site-footer');
  if (!siteFooter) return; // Footer noch nicht geladen
  const { usable } = measureViewport();
  // Dynamische 1vh-Variable: 1vh = 1% des aktuellen Viewports (Workaround für Mobile)
  ensureCSSVar('--vh', `${usable * 0.01}px`);
  // Maximal erlaubte Footer-Höhe = 60% des nutzbaren Viewports
  const maxFooter = Math.round(usable * 0.6);
  ensureCSSVar('--footer-max-height', `${maxFooter}px`);
  // Proportionale Inhalts-Skalierung basierend auf tatsächlicher Inhaltshöhe
  const content = document.querySelector(
    '#site-footer .footer-enhanced-content'
  );
  if (content) {
    // Temporär auf Scale 1 messen
    const prev = getCSSVar('--footer-scale');
    setCSSVar('--footer-scale', '1');
    // Force reflow, dann messen
    void content.offsetHeight;
    const naturalHeight = content.scrollHeight; // unskaliert
    // Benötigte Skalierung berechnen, um in 60% zu passen
    const base = Math.max(1, naturalHeight || 0);
    let scale = base > 0 ? Math.min(1, maxFooter / base) : computeScale();
    // Sicherheitsminimum, um extreme Fälle zu vermeiden
    scale = Math.max(0.5, Number(scale.toFixed(3)));
    ensureCSSVar('--footer-scale', String(scale));
    // Exakte tatsächliche Footer-Höhe nach Skalierung setzen
    const actual = Math.round(base * scale);
    ensureCSSVar('--footer-actual-height', `${actual}px`);
    // Falls kein prev gesetzt war, ist ok; andernfalls ignorieren
    void prev; // linter appease
  } else {
    // Fallback: leichte Breiten-basierte Skalierung
    ensureCSSVar('--footer-scale', String(computeScale()));
    // Keine Content-Referenz: nutze maxFooter als Annäherung
    ensureCSSVar('--footer-actual-height', `${maxFooter}px`);
  }
}

const onResize = throttle(() => {
  requestAnimationFrame(apply);
}, 150);

export function initFooterResizer() {
  if (STATE.inited) return;
  STATE.inited = true;
  apply();
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', onResize, { passive: true });
  // visualViewport-Events (iOS Safari: Adressleisten-Animationen)
  if (window.visualViewport) {
    const vv = window.visualViewport;
    vv.addEventListener('resize', onResize, { passive: true });
    vv.addEventListener('scroll', onResize, { passive: true });
  }
  // DOM-Änderungen im Footer beobachten (Lazy-Load/Interaktionen)
  try {
    const content = document.querySelector(
      '#site-footer .footer-enhanced-content'
    );
    if (content && 'ResizeObserver' in window) {
      const ro = new ResizeObserver(() => apply());
      ro.observe(content);
      STATE.observers.push(ro);
    }
    const footer = document.getElementById('site-footer');
    if (footer && 'MutationObserver' in window) {
      const mo = new MutationObserver(() => apply());
      mo.observe(footer, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: false
      });
      STATE.observers.push(mo);
    }
  } catch {
    /* no-op */
  }
  // Sicherheits-Refresh nach UI-Änderungen auf iOS (Adressleiste ein/aus)
  STATE.t1 = setTimeout(apply, 250);
  STATE.t2 = setTimeout(apply, 1200);
  // pageshow (bfcache) und fonts (Layout kann sich nachträglich ändern)
  window.addEventListener('pageshow', () => setTimeout(apply, 60), {
    once: true,
  });
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => setTimeout(apply, 30)).catch(() => {});
  }
}

// Auto-Init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFooterResizer, {
    once: true,
  });
} else {
  initFooterResizer();
}

export default initFooterResizer;
