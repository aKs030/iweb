/**
 * Modern 3D Gallery App
 * @version 3.0.0
 * @last-modified 2026-02-14
 */

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

import { createLogger } from '/content/core/logger.js';
import { AppLoadManager } from '/content/core/load-manager.js';
import { createUseTranslation } from '/content/core/react-utils.js';
import { createErrorBoundary } from '/content/components/ErrorBoundary.js';

import { ThreeGalleryScene } from './components/ThreeGalleryScene.js';
import { GALLERY_ITEMS } from './config.js';

const log = createLogger('gallery-app');
const useTranslation = createUseTranslation(React);
const h = React.createElement;

const GalleryApp = () => {
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initGallery = async () => {
      try {
        log.info('Initializing 3D Gallery...');

        AppLoadManager.updateLoader(
          0.2,
          t('gallery.loading.init') || 'Initializing...',
        );
        await new Promise((r) => setTimeout(r, 300));

        AppLoadManager.updateLoader(
          0.5,
          t('gallery.loading.prepare') || 'Preparing Scene...',
        );
        await new Promise((r) => setTimeout(r, 300));

        AppLoadManager.updateLoader(
          0.8,
          t('gallery.loading.assets') || 'Loading Assets...',
        );
        await new Promise((r) => setTimeout(r, 200));

        AppLoadManager.updateLoader(1, t('gallery.loading.ready') || 'Ready');
        AppLoadManager.hideLoader(100);

        setIsReady(true);
      } catch (err) {
        log.error('Gallery init failed', err);
        AppLoadManager.updateLoader(1, 'Error loading gallery');
        AppLoadManager.hideLoader(500);
      }
    };

    initGallery();
  }, [t]);

  if (!isReady) return null;

  return h(
    'div',
    {
      // 'fixed inset-0' fixiert das Element genau im sichtbaren Bildschirmbereich
      className: 'fixed inset-0 w-screen h-screen bg-black overflow-hidden',
      style: { touchAction: 'none' }, // Verhindert Mobile-Swipes auf App-Ebene
    },
    h(ThreeGalleryScene, { items: GALLERY_ITEMS }),

    // Title Overlay - Safe Area zwischen Menu (top: 76px) und Footer (bottom: 76px)
    h(
      'div',
      {
        className:
          'absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center w-full px-4',
        style: { top: '100px' }, // 76px Menu + 24px Abstand
      },
      h(
        'h1',
        {
          className:
            'text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 drop-shadow-lg',
        },
        t('gallery.title') || 'Gallery',
      ),

      h(
        'p',
        {
          className: 'text-indigo-200 mt-2 text-lg drop-shadow-md',
        },
        t('gallery.subtitle') || 'Explore visual moments',
      ),
    ),

    // Instructions - Safe Area über Footer (min-height: 52px + bottom: 12px + safe-bottom)
    h(
      'div',
      {
        className:
          'absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none animate-pulse w-full text-center',
        style: { bottom: '120px' }, // 52px Footer + 56px Abstand + 12px bottom offset
      },
      h(
        'p',
        { className: 'text-white/40 text-sm' },
        'Scroll to explore • Click to view',
      ),
    ),
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
const ErrorBoundary = createErrorBoundary(React);

root.render(h(ErrorBoundary, null, h(GalleryApp)));
