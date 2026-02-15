import React, { useEffect, useRef, useState } from 'react';
import { Gallery3DSystem } from './Gallery3DSystem.js';
import { X_Icon } from '/content/components/icons/icons.js';

const h = React.createElement;

export const ThreeGalleryScene = ({ items }) => {
  const containerRef = useRef(null);
  const systemRef = useRef(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    systemRef.current = new Gallery3DSystem(
      containerRef.current,
      items,
      (item) => {
        setSelectedItem(item);
      },
    );

    setIsLoading(false);

    return () => {
      if (systemRef.current) {
        systemRef.current.dispose();
      }
    };
  }, [items]);

  return h(
    'div',
    {
      style: {
        width: '100vw',
        height: '100vh',
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
        },
        h(
          'div',
          {
            className:
              'relative max-w-4xl w-full bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl',
          },

          h(
            'button',
            {
              onClick: () => setSelectedItem(null),
              className:
                'absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50',
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
                  'button',
                  {
                    className:
                      'px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-all',
                  },
                  'Details',
                ),
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
