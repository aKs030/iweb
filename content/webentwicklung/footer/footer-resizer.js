/**
 * Footer Resizer - Adaptive Footer-Höhen-Verwaltung
 * 
 * Ziel: Footer nie höher als 60% (Desktop) / 70% (Mobile) des Bildschirms
 * Technik: Dynamische Viewport-Messung (inkl. iOS Safe-Area), CSS-Variablen, ResizeObserver/Events.
 * 
 * Features:
 * - Event-basierte Koordination mit load-footer.js
 * - Performance-optimiert (keine unnötigen getComputedStyle Calls)
 * - iOS Safari Adressleisten-Animationen-Support
 * - Mobile-optimierte Skalierung (70% max-height, min-scale 0.75)
 * - ResizeObserver Loop Prevention via requestAnimationFrame
 * 
 * @author Abdulkerim Sesli
 * @version 1.3.0
 */

import { createLogger, throttle } from "../shared-utilities.js";

const log = createLogger("footerResizer");
const STATE = { inited: false, observers: [], t1: null, t2: null, rafId: null };

function setCSSVar(name, value) {
  document.documentElement.style.setProperty(name, value);
}

// Batched apply() für Observer-Callbacks - verhindert ResizeObserver Loop Warning
function scheduleApply() {
  if (STATE.rafId) return; // Bereits geplant
  STATE.rafId = requestAnimationFrame(() => {
    STATE.rafId = null;
    apply();
  });
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
  const siteFooter = document.getElementById("site-footer");
  if (!siteFooter) {
    log.debug("Footer noch nicht geladen, überspringe apply()");
    return;
  }
  
  const { usable } = measureViewport();
  // Dynamische 1vh-Variable: 1vh = 1% des aktuellen Viewports (Workaround für Mobile)
  setCSSVar("--vh", `${usable * 0.01}px`);
  
  // Mobile-optimierte Footer-Höhe: Auf kleinen Screens mehr Platz (bis 70%)
  const isMobile = window.innerWidth <= 768;
  const maxFooterRatio = isMobile ? 0.7 : 0.6; // 70% auf Mobile, 60% auf Desktop
  const maxFooter = Math.round(usable * maxFooterRatio);
  setCSSVar("--footer-max-height", `${maxFooter}px`);
  
  // Proportionale Inhalts-Skalierung basierend auf tatsächlicher Inhaltshöhe
  const content = document.querySelector(
    "#site-footer .footer-enhanced-content"
  );
  if (content) {
    // Temporär auf Scale 1 messen
    setCSSVar("--footer-scale", "1");
    // Force reflow, dann messen
    void content.offsetHeight;
    const naturalHeight = content.scrollHeight; // unskaliert
    // Benötigte Skalierung berechnen, um in maxFooter zu passen
    const base = Math.max(1, naturalHeight || 0);
    let scale = base > 0 ? Math.min(1, maxFooter / base) : computeScale();
    
    // Mobile: Weniger aggressive Skalierung (minimum 0.75 statt 0.5)
    const minScale = isMobile ? 0.75 : 0.5;
    scale = Math.max(minScale, Number(scale.toFixed(3)));
    
    setCSSVar("--footer-scale", String(scale));
    // Exakte tatsächliche Footer-Höhe nach Skalierung setzen
    const actual = Math.round(base * scale);
    setCSSVar("--footer-actual-height", `${actual}px`);
    
    log.debug(`Footer Scale: ${scale}, Mobile: ${isMobile}, MaxHeight: ${maxFooter}px, Actual: ${actual}px`);
  } else {
    // Fallback: leichte Breiten-basierte Skalierung
    setCSSVar("--footer-scale", String(computeScale()));
    // Keine Content-Referenz: nutze maxFooter als Annäherung
    setCSSVar("--footer-actual-height", `${maxFooter}px`);
  }
}

const onResize = throttle(() => {
  requestAnimationFrame(apply);
}, 150);

export function cleanup() {
  if (!STATE.inited) return;
  
  log.debug("Footer Resizer Cleanup");
  window.removeEventListener("resize", onResize);
  window.removeEventListener("orientationchange", onResize);
  
  if (window.visualViewport) {
    const vv = window.visualViewport;
    vv.removeEventListener("resize", onResize);
    vv.removeEventListener("scroll", onResize);
  }
  
  STATE.observers.forEach(obs => obs.disconnect());
  STATE.observers = [];
  
  if (STATE.t1) clearTimeout(STATE.t1);
  if (STATE.t2) clearTimeout(STATE.t2);
  if (STATE.rafId) cancelAnimationFrame(STATE.rafId);
  
  STATE.inited = false;
}

export function initFooterResizer() {
  if (STATE.inited) {
    log.debug("Footer Resizer bereits initialisiert");
    return;
  }

  log.debug("Initialisiere Footer Resizer");
  STATE.inited = true;
  
  // Initiale Berechnung
  apply();
  
  // Viewport-Events registrieren
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", onResize, { passive: true });
  // visualViewport-Events (iOS Safari: Adressleisten-Animationen)
  if (window.visualViewport) {
    const vv = window.visualViewport;
    vv.addEventListener("resize", onResize, { passive: true });
    vv.addEventListener("scroll", onResize, { passive: true });
  }
  // DOM-Änderungen im Footer beobachten (Lazy-Load/Interaktionen)
  const content = document.querySelector(
    "#site-footer .footer-enhanced-content"
  );
  if (content && "ResizeObserver" in window) {
    try {
      const ro = new ResizeObserver(() => scheduleApply());
      ro.observe(content);
      STATE.observers.push(ro);
    } catch (err) {
      log.debug("ResizeObserver konnte nicht initialisiert werden:", err);
    }
  }
  
  const footer = document.getElementById("site-footer");
  if (footer && "MutationObserver" in window) {
    try {
      const mo = new MutationObserver(() => scheduleApply());
      mo.observe(footer, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: false,
      });
      STATE.observers.push(mo);
    } catch (err) {
      log.debug("MutationObserver konnte nicht initialisiert werden:", err);
    }
  }
  // Sicherheits-Refresh nach UI-Änderungen auf iOS (Adressleiste ein/aus)
  STATE.t1 = setTimeout(apply, 250);
  STATE.t2 = setTimeout(apply, 1200);
  // pageshow (bfcache) und fonts (Layout kann sich nachträglich ändern)
  window.addEventListener("pageshow", () => setTimeout(apply, 60), {
    once: true,
  });
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => setTimeout(apply, 30)).catch(() => {});
  }
  
  log.info("Footer Resizer erfolgreich initialisiert");
}

// Warte auf Footer-loaded Event statt Auto-Init
document.addEventListener("footer:loaded", () => {
  log.debug("Footer:loaded Event empfangen, starte Resizer");
  initFooterResizer();
}, { once: true });

// Fallback: Falls Event bereits gefeuert wurde, prüfe DOM
if (document.readyState !== "loading") {
  // Prüfe ob Footer bereits existiert
  setTimeout(() => {
    if (document.getElementById("site-footer") && !STATE.inited) {
      log.debug("Footer bereits geladen, starte Resizer (Fallback)");
      initFooterResizer();
    }
  }, 100);
}

export default initFooterResizer;
