/**
 * SUPER EINFACHE Scroll-Animation für Karten
 */

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
    if (!card || window.prefersReducedMotion?.()) return;
    
    const delay = Math.random() * 200; // Zufälliger Delay
    
    // Starte mit versteckter Karte
    card.classList.add('card-hidden');
    card.classList.remove('card-visible');
    
    setTimeout(() => {
      // Nach delay: zeige Karte
      card.classList.remove('card-hidden');
      card.classList.add('card-visible');
    }, delay);
    
    this.observer.unobserve(card); // Nur einmal animieren
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

export default SnapScrollAnimations;