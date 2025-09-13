/**
 * SUPER EINFACHE Karten-Animation
 */

export function animateCardEntrance(card, delay = 0) {
  if (!card || window.prefersReducedMotion?.()) return;
  
  // Starte mit versteckter Karte
  card.classList.add('card-hidden');
  card.classList.remove('card-visible');
  
  setTimeout(() => {
    // Nach delay: zeige Karte
    card.classList.remove('card-hidden');
    card.classList.add('card-visible');
  }, delay);
}

