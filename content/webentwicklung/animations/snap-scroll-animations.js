/**
 * SUPER EINFACHE Scroll-Animation für Karten
 */

import { animateCardEntrance } from './card-animation-utils.js';

class SnapScrollAnimations {
  constructor() {
    this.processedCards = new WeakSet();
    this.observer = null;
    this.init();
  }

  init() {
    const options = {
      root: null,
      rootMargin: '-10px',
      threshold: 0.2
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target.classList.contains('card')) {
          this.animateCard(entry.target);
        }
      });
    }, options);

    this.observeCards();
  }

  observeCards() {
    const cards = document.querySelectorAll('.features-cards .card');
    cards.forEach((card) => {
      if (!this.processedCards.has(card)) {
        this.observer.observe(card);
        this.processedCards.add(card);
      }
    });
  }

  animateCard(card) {
    const delay = Math.random() * 200; // Zufälliger Delay
    animateCardEntrance(card, delay);
    this.observer.unobserve(card); // Nur einmal animieren
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

export default SnapScrollAnimations;