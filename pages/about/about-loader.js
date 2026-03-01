/**
 * About Page Loader with Progress Tracking
 * @version 2.0.0
 * @last-modified 2026-01-31
 */

import { createLogger } from '/content/core/logger.js';
import { AppLoadManager } from '/content/core/load-manager.js';
import { i18n } from '/content/core/i18n.js';

const log = createLogger('AboutLoader');

/**
 * Initialize About page with progress tracking
 */
async function initAboutPage() {
  try {
    AppLoadManager.updateLoader(0.1, i18n.t('loader.loading_page'));

    // Step 1: Wait for DOM
    if (document.readyState === 'loading') {
      await new Promise((resolve) => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }

    AppLoadManager.updateLoader(0.3, i18n.t('loader.init_components'));

    // Step 2: Initialize Lucide Icons
    await initializeLucideIcons();
    AppLoadManager.updateLoader(0.5, i18n.t('loader.loading_icons'));

    // Step 3: Setup interactions
    setupInteractions();
    AppLoadManager.updateLoader(0.7, i18n.t('loader.activating'));

    // Step 4: Animate cards
    await animateCards();
    AppLoadManager.updateLoader(0.95, i18n.t('loader.page_ready'));

    // Complete loader immediately
    setTimeout(() => {
      AppLoadManager.hideLoader(100);
    }, 100);

    log.info('About page initialized successfully');
  } catch (error) {
    log.error('Failed to initialize about page:', error);
    AppLoadManager.updateLoader(0.95, i18n.t('loader.failed'));
    setTimeout(() => {
      AppLoadManager.hideLoader(100);
    }, 500);
  }
}

/**
 * Initialize Lucide Icons
 * Uses a MutationObserver-based approach instead of polling.
 */
async function initializeLucideIcons() {
  // Already available
  if (typeof window !== 'undefined' && window.lucide) {
    try {
      window.lucide.createIcons();
      log.debug('Lucide icons initialized (immediate)');
    } catch (error) {
      log.warn('Failed to initialize Lucide icons:', error);
    }
    return;
  }

  // Wait for lucide to appear on window (max 3s)
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      log.warn('Lucide icons not available after timeout');
      resolve();
    }, 3000);

    // Check periodically via rAF (lighter than setInterval)
    const check = () => {
      if (window.lucide) {
        clearTimeout(timeout);
        try {
          window.lucide.createIcons();
          log.debug('Lucide icons initialized');
        } catch (error) {
          log.warn('Failed to initialize Lucide icons:', error);
        }
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

/**
 * Animate cards with staggered delays
 */
async function animateCards() {
  const cards = document.querySelectorAll('.fade-in');

  if (cards.length === 0) return;

  // Add visible class with delays
  cards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add('visible');
    }, index * 100);
  });

  // Wait for animations to complete
  await new Promise((resolve) => setTimeout(resolve, cards.length * 100 + 300));
}

/**
 * Setup page interactions
 */
function setupInteractions() {
  // Smooth scroll for internal links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href && href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // Add hover effects to cards
  const cards = document.querySelectorAll('.card');
  cards.forEach((card) => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
    });
  });

  log.debug('Interactions setup complete');
}

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAboutPage, { once: true });
} else {
  initAboutPage();
}
