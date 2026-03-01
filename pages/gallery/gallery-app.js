/**
 * Modern 3D Gallery App
 * @version 3.1.1
 * @last-modified 2026-02-14
 */

import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';

import { createLogger } from '/content/core/logger.js';
import { AppLoadManager } from '/content/core/load-manager.js';
import { createUseTranslation } from '/content/core/utils.js';
import { createErrorBoundary } from '/content/components/ErrorBoundary.js';
import { i18n } from '/content/core/i18n.js';

import { ThreeGalleryScene } from './components/ThreeGalleryScene.js';
// Removed static GALLERY_ITEMS import to use dynamic loading
import { GALLERY_ITEMS as STATIC_GALLERY_ITEMS } from './config.js';

const log = createLogger('gallery-app');
const useTranslation = createUseTranslation();
const h = React.createElement;

const GalleryApp = () => {
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);
  const [items, setItems] = useState([]);
  const initRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization
    if (initRef.current) return;
    initRef.current = true;

    const initGallery = async () => {
      try {
        log.info('Initializing 3D Gallery...');

        AppLoadManager.updateLoader(
          0.2,
          i18n.t('gallery.loading.init') || 'Initializing...',
        );

        // Fetch dynamic items from R2 API
        let dynamicItems = [];
        try {
          const res = await fetch('/api/gallery-items');
          if (res.ok) {
            const data = await res.json();
            if (data.items && Array.isArray(data.items)) {
              // Ensure there are enough items for 3D gallery stability, or mix with static if too few?
              // For now, trust the API.
              dynamicItems = data.items;
              log.info(`Loaded ${dynamicItems.length} items from R2`);
            }
          }
        } catch (apiErr) {
          log.warn(
            'Failed to load dynamic gallery items, falling back to static config',
            apiErr,
          );
        }

        // Use dynamic items if available, otherwise fallback to static config
        const finalItems =
          dynamicItems.length > 0 ? dynamicItems : STATIC_GALLERY_ITEMS;
        setItems(finalItems);

        AppLoadManager.updateLoader(
          0.5,
          i18n.t('gallery.loading.prepare') || 'Preparing Scene...',
        );
        await new Promise((r) => setTimeout(r, 300));

        AppLoadManager.updateLoader(
          0.8,
          i18n.t('gallery.loading.assets') || 'Loading Assets...',
        );
        // Preload first few textures if needed, or let Three.js handle it
        await new Promise((r) => setTimeout(r, 200));

        AppLoadManager.updateLoader(
          1,
          i18n.t('gallery.loading.ready') || 'Ready',
        );
        AppLoadManager.hideLoader(100);

        setIsReady(true);
      } catch (err) {
        log.error('Gallery init failed', err);
        // Fallback to static items even on critical failure if possible
        setItems(STATIC_GALLERY_ITEMS);
        setIsReady(true); // Still try to render something
        AppLoadManager.updateLoader(1, 'Gallery loaded (fallback)');
        AppLoadManager.hideLoader(500);
      }
    };

    initGallery();
  }, []); // Run once on mount

  // Separate effect for Schema updates when items change
  useEffect(() => {
    if (items.length > 0) {
      updateGallerySchema(items);
    }
  }, [items]);

  // Helper to inject Schema.org JSON-LD
  const updateGallerySchema = (galleryItems) => {
    const scriptId = 'gallery-schema-json-ld';
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'ImageGallery',
      name: 'Fotografie Portfolio | Abdulkerim Sesli',
      description:
        'Kuratierte Galerie mit Fokus auf Street Photography, Architektur und Portraits.',
      url: window.location.href,
      author: {
        '@type': 'Person',
        name: 'Abdulkerim Sesli',
      },
      image: galleryItems.map((item) => ({
        '@type': 'ImageObject',
        contentUrl: item.url,
        url: item.url,
        name: item.title,
        description: item.description || item.title,
        author: {
          '@type': 'Person',
          name: 'Abdulkerim Sesli',
        },
        creator: {
          '@type': 'Person',
          name: 'Abdulkerim Sesli',
        },
        creditText: 'Photo: Abdulkerim Sesli',
        license: 'https://abdulkerimsesli.de/#image-license',
        acquireLicensePage: 'https://abdulkerimsesli.de/#image-license',
        copyrightNotice: `© ${new Date().getFullYear()} Abdulkerim Sesli`,
      })),
    };

    script.textContent = JSON.stringify(schema);
  };

  if (!isReady) return null;

  return h(
    'div',
    {
      className: 'gallery-shell',
    },
    // Pass dynamic items to the scene
    h(ThreeGalleryScene, { items: items }),

    // Title Overlay - Safe Area zwischen Menu (top: 76px) und Footer (bottom: 76px)
    h(
      'div',
      {
        className: 'gallery-title-overlay',
      },
      h(
        'h1',
        {
          className: 'gallery-title',
        },
        t('gallery.title') || 'Gallery',
      ),

      h(
        'p',
        {
          className: 'gallery-subtitle',
        },
        t('gallery.subtitle') || 'Explore visual moments',
      ),
    ),

    // Instructions - Safe Area über Footer (min-height: 52px + bottom: 12px + safe-bottom)
    h(
      'div',
      {
        className: 'gallery-instructions',
      },
      h(
        'p',
        { className: 'gallery-instructions__text' },
        t('gallery.instructions') || 'Scroll to explore \u2022 Click to view',
      ),
    ),
  );
};

const root = createRoot(document.getElementById('root'));
const ErrorBoundary = createErrorBoundary(React);

root.render(h(ErrorBoundary, null, h(GalleryApp)));
