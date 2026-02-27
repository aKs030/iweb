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
      className: 'gallery-scene',
    },

    // 3D Canvas Container
    h('div', { ref: containerRef, className: 'gallery-canvas' }),

    // Loader
    isLoading &&
      h(
        'div',
        {
          className: 'gallery-loader',
        },
        h('div', {
          className: 'gallery-loader__spinner',
        }),
      ),

    // Lightbox Overlay
    selectedItem &&
      h(
        'div',
        {
          className: 'gallery-lightbox',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': `${selectedItem.title} — Bild ${selectedIndex + 1} von ${items.length}`,
          onTouchStart,
          onTouchEnd,
          onClick: closeLightbox,
        },

        // Prev button
        h(
          'button',
          {
            onClick: (e) => {
              e.stopPropagation();
              goPrev();
            },
            className: 'gallery-lightbox__nav gallery-lightbox__nav--prev',
            'aria-label': 'Vorheriges Bild',
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
            className: 'gallery-lightbox__nav gallery-lightbox__nav--next',
            'aria-label': 'Nächstes Bild',
          },
          '›',
        ),

        h(
          'div',
          {
            className: 'gallery-lightbox__panel',
            onClick: (e) => e.stopPropagation(), // Prevent clicks inside content from closing lightbox
          },

          // Counter badge
          h(
            'div',
            {
              className: 'gallery-lightbox__counter',
            },
            `${selectedIndex + 1} / ${items.length}`,
          ),

          // Close button
          h(
            'button',
            {
              onClick: closeLightbox,
              className: 'gallery-lightbox__close',
              'aria-label': 'Schließen (Esc)',
            },
            h(X_Icon, { size: 24, className: 'text-white' }),
          ),

          h(
            'div',
            { className: 'gallery-lightbox__content' },
            // Image / Video Viewer
            h(
              'div',
              {
                className: 'gallery-lightbox__media',
              },
              selectedItem.type === 'video'
                ? h('video', {
                    src: selectedItem.url,
                    controls: true,
                    autoPlay: true,
                    className: 'gallery-lightbox__media-item',
                  })
                : h('img', {
                    src: selectedItem.url,
                    alt: selectedItem.title,
                    className: 'gallery-lightbox__media-item is-image',
                  }),
            ),

            // Details
            h(
              'div',
              { className: 'gallery-lightbox__details' },
              h(
                'h2',
                {
                  className: 'gallery-lightbox__title',
                },
                selectedItem.title,
              ),
              h(
                'p',
                { className: 'gallery-lightbox__description' },
                selectedItem.description,
              ),
              h(
                'div',
                { className: 'gallery-lightbox__actions' },
                h(
                  'a',
                  {
                    href: selectedItem.url,
                    download: true,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className: 'gallery-lightbox__download',
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
