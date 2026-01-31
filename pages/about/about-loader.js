/**
 * About Page Loader with Progress Tracking
 * @version 2.0.0
 * @last-modified 2026-01-31
 */

import { createLogger } from '/content/core/logger.js';
import { updateLoader, hideLoader } from '/content/core/global-loader.js';

const log = createLogger('AboutLoader');

/**
 * Initialize About page with progress tracking
 */
async function initAboutPage() {
  try {
    updateLoader(0.1, 'Lade Seite...');

    // Step 1: Wait for DOM
    if (document.readyState === 'loading') {
      await new Promise((resolve) => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }

    updateLoader(0.3, 'Initialisiere Komponenten...');

    // Step 2: Initialize Lucide Icons
    await initializeLucideIcons();
    updateLoader(0.5, 'Lade Icons...');

    // Step 3: Animate cards
    await animateCards();
    updateLoader(0.7, 'Animiere Elemente...');

    // Step 4: Setup interactions
    setupInteractions();
    updateLoader(0.9, 'Aktiviere Interaktionen...');

    // Complete
    updateLoader(0.95, 'Seite bereit');

    setTimeout(() => {
      hideLoader(100);
    }, 100);

    log.info('About page initialized successfully');
  } catch (error) {
    log.error('Failed to initialize about page:', error);
    updateLoader(0.95, 'Fehler beim Laden');
  }
}

/**
 * Initialize Lucide Icons
 */
async function initializeLucideIcons() {
  return new Promise((resolve) => {
    const tryInit = () => {
      // Check if lucide is available globally
      if (typeof window !== 'undefined' && window.lucide) {
        try {
          window.lucide.createIcons();
          log.debug('Lucide icons initialized');
          resolve();
        } catch (error) {
          log.warn('Failed to initialize Lucide icons:', error);
          resolve(); // Continue anyway
        }
      } else {
        // Retry after a short delay
        setTimeout(tryInit, 50);
      }
    };
    tryInit();
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

export { initAboutPage };
