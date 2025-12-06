import { splitTextIntoLines } from '../../utils/shared-utilities.js';

// ===== Mess-Utility: Höhe VOR dem Tippen bestimmen =====
export function makeLineMeasurer(subtitleEl) {
  const measurer = document.createElement('div');
  measurer.style.cssText = [
    'position:absolute',
    'left:-9999px',
    'top:0',
    'visibility:hidden',
    'white-space:normal',
    'pointer-events:none'
  ].join(';');
  document.body.appendChild(measurer);

  const cs = getComputedStyle(subtitleEl);
  [
    'font-size',
    'line-height',
    'font-family',
    'font-weight',
    'letter-spacing',
    'word-spacing',
    'font-kerning',
    'font-variant-ligatures',
    'text-transform',
    'text-rendering',
    'word-break',
    'overflow-wrap',
    'hyphens'
  ].forEach((p) => measurer.style.setProperty(p, cs.getPropertyValue(p)));

  function getLineHeightPx() {
    const cs = getComputedStyle(subtitleEl);
    const lhRaw = cs.lineHeight.trim();
    if (lhRaw.endsWith('px')) {
      const v = parseFloat(lhRaw);
      if (!isNaN(v)) return v;
    }
    const num = parseFloat(lhRaw);
    if (!isNaN(num)) {
      const fsRaw = cs.fontSize.trim();
      const fs = parseFloat(fsRaw);
      if (!isNaN(fs)) return num * fs;
    }
    measurer.innerHTML = '';
    const one = document.createElement('span');
    one.textContent = 'A';
    one.style.display = 'inline-block';
    measurer.appendChild(one);
    const h = one.getBoundingClientRect().height;
    return h || 0;
  }

  function measure(text, smartBreaks) {
    const cs = getComputedStyle(subtitleEl);
    measurer.innerHTML = '';
    const span = document.createElement('span');
    if (smartBreaks) {
      const frag = splitTextIntoLines(text);
      span.appendChild(frag);
    } else {
      span.textContent = String(text);
    }
    measurer.appendChild(span);

    // echte verfügbare Breite ab linker Kante + Cap wie im CSS
    const rect = subtitleEl.getBoundingClientRect();
    const left = rect.left || 0;
    const safeMargin = 12;
    const available = Math.max(0, window.innerWidth - left - safeMargin);
    const cap = Math.min(window.innerWidth * 0.92, 820);
    const width = Math.max(1, Math.min(available || cap, cap));
    measurer.style.width = width + 'px';

    const lh = getLineHeightPx();
    const h = span.getBoundingClientRect().height;
    if (!lh || !h) return 1;
    const clampMax = parseInt(cs.getPropertyValue('--reserve-lines')) || 6; // Erhöht auf 6 Zeilen
    return Math.max(1, Math.min(clampMax, Math.round(h / lh))); // clamp 1..clampMax
  }

  return {
    reserveFor(text, smartBreaks = true) {
      const lh = getLineHeightPx();
      subtitleEl.style.setProperty('--lh-px', lh ? `${lh}px` : '0px');
      subtitleEl.style.setProperty('--gap-px', lh ? `${lh * 0.25}px` : '0px');
      const lines = measure(text, smartBreaks);
      subtitleEl.style.setProperty('--lines', String(lines));
      subtitleEl.setAttribute('data-lines', String(lines));

      // Dynamische Bottom-Position für mehrzeilige Texte (>3 Zeilen)
      // Wenn mehrere Zeilen vor dem Tippen angezeigt werden, verschiebe
      // den Subtitle zusätzlich nach oben, sodass er über dem Footer bleibt.
      if (lh > 0) {
        const isFixed = subtitleEl.classList.contains('typewriter-title--fixed');
        const isExpanded = document.body.classList.contains('footer-expanded');

        // Basis-Abstand je nach Modus bestimmen
        let baseOffset;
        if (isExpanded) {
          baseOffset = 'clamp(8px, 1.5vw, 16px)';
        } else if (isFixed) {
          baseOffset = 'clamp(16px, 2.5vw, 32px)';
        } else {
          baseOffset = 'clamp(12px, 2vw, 24px)';
        }

        // Minimale zusätzliche Höhe für Mehrzeiler berechnen
        const gap = parseFloat(cs.getPropertyValue('--gap-px')) || lh * 0.25 || 0;
        // Geneuere Berechnung: Jede zusätzliche Zeile benötigt die Zeilenhöhe + optionalen gap
        const lineExtra = lines > 3 ? Math.round((lines - 3) * (lh + gap)) : 0;

        // Footer-Höhe ermitteln (sichtbare Höhe des Footer Elements, falls vorhanden)
        const footerEl = document.querySelector('#site-footer');
        const footerHeight = footerEl ? Math.round(footerEl.getBoundingClientRect().height) : 0;

        // Sicherheitsabstand (px) zwischen TypeWriter und Footer
        const safeBottomMargin = 8;
        const totalExtraPx = lineExtra + footerHeight + safeBottomMargin;

        // Neue Bottom-Position setzen oder zurücksetzen
        if (totalExtraPx > 0) {
          // baseOffset ist ein CSS-clamp/var-Ausdruck, daher in calc verwenden
          subtitleEl.style.setProperty('bottom', `calc(${baseOffset} + ${totalExtraPx}px)`);
        } else {
          subtitleEl.style.removeProperty('bottom');
        }
      }

      return lines;
    }
  };
}
