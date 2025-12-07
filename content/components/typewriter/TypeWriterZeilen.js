// ===== TypeWriter Line Measurer (Final Optimiert) =====
import { splitTextIntoLines } from '../../utils/shared-utilities.js';

// Helper: CSS Variables setzen
const setCSSVars = (el, vars) =>
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));

export function makeLineMeasurer(subtitleEl) {
  const measurer = document.createElement('div');
  measurer.style.cssText =
    'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:normal;pointer-events:none';
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

  const getLineHeight = () => {
    const lh = cs.lineHeight.trim();
    if (lh.endsWith('px')) {
      const v = parseFloat(lh);
      if (!isNaN(v)) return v;
    }
    const num = parseFloat(lh);
    if (!isNaN(num)) {
      const fs = parseFloat(cs.fontSize);
      if (!isNaN(fs)) return num * fs;
    }
    measurer.innerHTML = '<span style="display:inline-block">A</span>';
    return measurer.firstChild.getBoundingClientRect().height || 0;
  };

  const measure = (text, smartBreaks) => {
    measurer.innerHTML = '';
    const span = document.createElement('span');

    if (smartBreaks) {
      span.appendChild(splitTextIntoLines(text));
    } else {
      span.textContent = text;
    }

    measurer.appendChild(span);

    const rect = subtitleEl.getBoundingClientRect();
    const available = Math.max(0, window.innerWidth - (rect.left || 0) - 12);
    const cap = Math.min(window.innerWidth * 0.92, 820);
    measurer.style.width = Math.max(1, Math.min(available || cap, cap)) + 'px';

    const lh = getLineHeight();
    const h = span.getBoundingClientRect().height;
    if (!lh || !h) return 1;

    const max = parseInt(cs.getPropertyValue('--reserve-lines')) || 6;
    return Math.max(1, Math.min(max, Math.round(h / lh)));
  };

  return {
    reserveFor(text, smartBreaks = true) {
      const lh = getLineHeight();
      const lines = measure(text, smartBreaks);

      setCSSVars(subtitleEl, {
        '--lh-px': lh ? `${lh}px` : '0px',
        '--gap-px': lh ? `${lh * 0.25}px` : '0px',
        '--lines': String(lines)
      });

      subtitleEl.setAttribute('data-lines', String(lines));
      return lines;
    }
  };
}
