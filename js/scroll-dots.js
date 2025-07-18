/**
 * Scroll-Dots Navigation System
 *
 * Features:
 * - Automatische Scroll-Position-Erkennung
 * - Smooth-Scroll zu Sektionen
 * - Keyboard-Navigation (Arrow Keys, Home, End)
 * - ARIA-Accessibility-Unterstützung
 * - Performance-optimierte Scroll-Handler
 */

// js/scroll-dots.js
document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('.snap-section');
  const dots = Array.from(document.querySelectorAll('.dots-nav .dot'));
  const viewportBox = document.querySelector('.viewport-box');

  // Validierung der erforderlichen Elemente
  if (!viewportBox) {
    console.warn(
      'Viewport-Box (.viewport-box) nicht gefunden - Scroll-Dots werden nicht initialisiert'
    );
    return;
  }

  if (sections.length === 0 || dots.length === 0) {
    console.warn(
      'Keine Sektionen oder Dots gefunden - Scroll-Dots werden nicht initialisiert'
    );
    return;
  }

  let isScrolling = false;
  let lastActiveSection = null;

  function updateActiveDot() {
    const scrollPosition = viewportBox.scrollTop;
    let currentActiveIndex = -1;

    sections.forEach((section, index) => {
      const sectionTop = section.offsetTop - viewportBox.offsetTop;
      const sectionHeight = section.offsetHeight;

      // Verbesserte Scroll-Position-Erkennung mit konfigurierbarer Toleranz
      const scrollTolerance = 100;
      if (
        currentActiveIndex === -1 &&
        scrollPosition >= sectionTop - scrollTolerance &&
        scrollPosition < sectionTop + sectionHeight - scrollTolerance
      ) {
        currentActiveIndex = index;

        if (lastActiveSection !== section.id && !isScrolling) {
          lastActiveSection = section.id;
          document.dispatchEvent(
            new CustomEvent('scrollToSection', {
              detail: { sectionId: section.id },
            })
          );
        }
        lastActiveSection = section.id;
      }
    });

    dots.forEach((dot, index) => {
      const isActive = index === currentActiveIndex;
      dot.classList.toggle('active', isActive);
      dot.setAttribute('aria-selected', isActive.toString());
      dot.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  }

  // Scroll-Navigation mit Keyboard-Support und verbesserter Accessibility
  dots.forEach((clickedDot) => {
    clickedDot.addEventListener('click', () => {
      const targetSectionId = clickedDot.getAttribute('data-target');
      const targetSection = document.getElementById(targetSectionId);

      if (targetSection) {
        isScrolling = true;

        viewportBox.scrollTo({
          top: targetSection.offsetTop - viewportBox.offsetTop,
          behavior: 'smooth',
        });

        // Aktualisiere Dot-Status sofort für besseres UX
        dots.forEach((dot) => {
          const isClicked = dot === clickedDot;
          dot.classList.toggle('active', isClicked);
          dot.setAttribute('aria-selected', isClicked.toString());
          dot.setAttribute('tabindex', isClicked ? '0' : '-1');
        });

        // Fokus-Management
        if (document.activeElement !== clickedDot) {
          clickedDot.focus();
        }

        // Dispatch Event für andere Komponenten
        document.dispatchEvent(
          new CustomEvent('scrollToSection', {
            detail: { sectionId: targetSectionId },
          })
        );

        // Reset Scrolling-Flag nach Animation
        const scrollTimeout = 600; // Smooth scroll duration
        setTimeout(() => {
          isScrolling = false;
          updateActiveDot();
        }, scrollTimeout);
      }
    });

    // Erweiterte Keyboard-Navigation mit verbesserter Accessibility
    clickedDot.addEventListener('keydown', (event) => {
      const currentIndex = dots.indexOf(event.target);
      let newIndex;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          newIndex = (currentIndex + 1) % dots.length;
          break;
        case 'ArrowUp':
          event.preventDefault();
          newIndex = (currentIndex - 1 + dots.length) % dots.length;
          break;
        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          newIndex = dots.length - 1;
          break;
        default:
          return; // Früher Return für nicht behandelte Keys
      }

      if (newIndex !== currentIndex) {
        dots[newIndex].focus();
        dots[newIndex].click();
      }
    });
  });

  // Performance-optimierter Scroll-Event-Handler
  let scrollTimeout;
  const scrollDebounceDelay = 150;

  viewportBox.addEventListener('scroll', () => {
    isScrolling = true;
    updateActiveDot();
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
      updateActiveDot();
    }, scrollDebounceDelay);
  });

  // Initiale Aktivierung
  updateActiveDot();
});
