// ===== Mess-Utility: Höhe VOR dem Tippen bestimmen =====
export function makeLineMeasurer(subtitleEl) {
  const measurer = document.createElement('div');
  measurer.style.cssText = [
    'position:absolute','left:-9999px','top:0','visibility:hidden',
    'white-space:normal','pointer-events:none'
  ].join(';');
  document.body.appendChild(measurer);

  const cs = getComputedStyle(subtitleEl);
  ['font-size','line-height','font-family','font-weight','letter-spacing','word-spacing']
    .forEach(p => measurer.style.setProperty(p, cs.getPropertyValue(p)));

  function getLineHeightPx(){
    const lhRaw = cs.lineHeight.trim();
    if (lhRaw.endsWith('px')) {
      const v = parseFloat(lhRaw); if (!isNaN(v)) return v;
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

  function measure(text, smartBreaks){
    measurer.innerHTML = '';
    const span = document.createElement('span');
    if (smartBreaks){
      const parts = String(text).split(/(, )/);
      for (const part of parts){
        if (part === ', '){
          span.appendChild(document.createTextNode(','));
          span.appendChild(document.createElement('br'));
        } else {
          span.appendChild(document.createTextNode(part));
        }
      }
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
    const h  = span.getBoundingClientRect().height;
    if (!lh || !h) return 1;
    return Math.max(1, Math.min(3, Math.round(h / lh))); // clamp 1..3
  }

  return {
    reserveFor(text, smartBreaks = true){
      const lh = getLineHeightPx();
      subtitleEl.style.setProperty('--lh-px', lh ? `${lh}px` : '0px');
      subtitleEl.style.setProperty('--gap-px', lh ? `${(lh * 0.25)}px` : '0px');
      const lines = measure(text, smartBreaks);
      subtitleEl.style.setProperty('--lines', String(lines));
      subtitleEl.setAttribute('data-lines', String(lines));
      return lines;
    }
  };
}