import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Gallery3DSystem } from './Gallery3DSystem.js';
import { X_Icon } from '/content/components/icons/icons.js';

const h = React.createElement;

export const ThreeGalleryScene = ({ items }) => {
  const containerRef = useRef(null);
  const systemRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const touchStartRef = useRef(null);

  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : null;

  // Navigate lightbox
  const goNext = useCallback(() => {
    setSelectedIndex((i) => (i + 1) % items.length);
  }, [items.length]);

  const goPrev = useCallback(() => {
    setSelectedIndex((i) => (i - 1 + items.length) % items.length);
  }, [items.length]);

  const closeLightbox = useCallback(() => {
    setSelectedIndex(-1);
  }, []);

  // Init 3D scene
  useEffect(() => {
    if (!containerRef.current) return;

    systemRef.current = new Gallery3DSystem(
      containerRef.current,
      items,
      (item) => {
        const idx = items.findIndex((i) => i === item);
        setSelectedIndex(idx >= 0 ? idx : 0);
      },
    );

    setIsLoading(false);

    return () => {
      if (systemRef.current) {
        systemRef.current.dispose();
      }
    };
  }, [items]);

  // Handle background scrolling when lightbox is open
  useEffect(() => {
    if (selectedIndex >= 0) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [selectedIndex]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (selectedIndex < 0) return;

    const handleKey = (e) => {
      switch (e.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          goPrev();
          break;
      }
    };

    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [selectedIndex, closeLightbox, goNext, goPrev]);

  // Touch/swipe handlers for lightbox
  const onTouchStart = useCallback((e) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const onTouchEnd = useCallback(
    (e) => {
      if (!touchStartRef.current) return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Minimum swipe distance: 50px, must be more horizontal than vertical
      if (absDx > 50 && absDx > absDy) {
        if (dx < 0) goNext();
        else goPrev();
      }
      touchStartRef.current = null;
    },
    [goNext, goPrev],
  );

  return h(
    'div',
    {
      style: {
        width: '100vw',
        height: '100dvh', // Modern viewport height for mobile
        position: 'relative',
        background: '#000',
      },
    },

    // 3D Canvas Container
    h('div', { ref: containerRef, style: { width: '100%', height: '100%' } }),

    // Loader
    isLoading &&
      h(
        'div',
        {
          className:
            'absolute inset-0 flex items-center justify-center bg-black z-50',
        },
        h('div', {
          className:
            'w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin',
        }),
      ),

    // Lightbox Overlay
    selectedItem &&
      h(
        'div',
        {
          className:
            'absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': `${selectedItem.title} — Bild ${selectedIndex + 1} von ${items.length}`,
          onTouchStart,
          onTouchEnd,
          onClick: closeLightbox,
          style: { touchAction: 'none' }, // Prevent browser touch actions like swipe-to-go-back while in gallery
        },

        // Prev button
        h(
          'button',
          {
            onClick: (e) => {
              e.stopPropagation();
              goPrev();
            },
            className:
              'absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50',
            'aria-label': 'Vorheriges Bild',
            style: { fontSize: '24px', lineHeight: 1, color: '#fff' },
          },
          '‹',
        ),

        // Next button
        h(
          'button',
          {
            onClick: (e) => {
              e.stopPropagation();
              goNext();
            },
            className:
              'absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50',
            'aria-label': 'Nächstes Bild',
            style: { fontSize: '24px', lineHeight: 1, color: '#fff' },
          },
          '›',
        ),

        h(
          'div',
          {
            className:
              'relative max-w-4xl w-full bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl',
            onClick: (e) => e.stopPropagation(), // Prevent clicks inside content from closing lightbox
          },

          // Counter badge
          h(
            'div',
            {
              className:
                'absolute top-4 left-4 px-3 py-1 bg-white/10 rounded-full text-white/70 text-sm z-50',
            },
            `${selectedIndex + 1} / ${items.length}`,
          ),

          // Close button
          h(
            'button',
            {
              onClick: closeLightbox,
              className:
                'absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50',
              'aria-label': 'Schließen (Esc)',
            },
            h(X_Icon, { size: 24, className: 'text-white' }),
          ),

          h(
            'div',
            { className: 'grid md:grid-cols-2 gap-0' },
            // Image / Video Viewer
            h(
              'div',
              {
                className:
                  'aspect-square md:aspect-auto bg-black flex items-center justify-center p-4',
              },
              selectedItem.type === 'video'
                ? h('video', {
                    src: selectedItem.url,
                    controls: true,
                    autoPlay: true,
                    className:
                      'max-w-full max-h-[60vh] object-contain rounded-lg',
                  })
                : h('img', {
                    src: selectedItem.url,
                    alt: selectedItem.title,
                    className:
                      'max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg',
                  }),
            ),

            // Details
            h(
              'div',
              { className: 'p-8 flex flex-col justify-center' },
              h(
                'h2',
                {
                  className:
                    'text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-4',
                },
                selectedItem.title,
              ),
              h(
                'p',
                { className: 'text-slate-300 leading-relaxed text-lg' },
                selectedItem.description,
              ),
              h(
                'div',
                { className: 'mt-8 flex gap-4' },
                h(
                  'a',
                  {
                    href: selectedItem.url,
                    download: true,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className:
                      'px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-all',
                  },
                  'Download',
                ),
              ),
            ),
          ),
        ),
      ),
  );
};
