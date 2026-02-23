/**
 * Blog React Components
 * @version 2.0.0 - Optimized & Minimal
 */

import React from 'react';
import htm from 'htm';
import { ArrowUp } from '/content/components/icons/icons.js';

const html = htm.bind(React.createElement);

export const ProgressiveImage = React.memo(function ProgressiveImage({
  src,
  alt,
  className,
  loading = 'lazy',
  fetchpriority,
}) {
  const [loaded, setLoaded] = React.useState(false);
  const imgRef = React.useRef(null);

  React.useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalHeight > 0) {
      setLoaded(true);
    }
  }, []);

  return html`
    <div className="progressive-image-wrapper ${loaded ? 'loaded' : ''}">
      <img
        ref=${imgRef}
        src=${src}
        alt=${alt}
        className=${className}
        loading=${loading}
        fetchpriority=${fetchpriority}
        decoding="async"
        onLoad=${() => setLoaded(true)}
      />
    </div>
  `;
});

export const ScrollToTop = () => {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const toggle = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', toggle, { passive: true });
    return () => window.removeEventListener('scroll', toggle);
  }, []);

  return html`
    <button
      className="scroll-to-top-btn ${visible ? 'visible' : ''}"
      onClick=${() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Nach oben scrollen"
    >
      <${ArrowUp} />
    </button>
  `;
};

export const ReadingProgress = () => {
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const onScroll = () => {
      const h = document.body.scrollHeight - window.innerHeight;
      setWidth(h > 0 ? (window.scrollY / h) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return html`
    <div className="reading-progress-container">
      <div className="reading-progress-bar" style=${{ width: `${width}%` }} />
    </div>
  `;
};
