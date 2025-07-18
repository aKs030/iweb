/**
 * Dynamisches Content-Management-System für Website-Sektionen
 *
 * Hauptfunktionen:
 * - Lädt HTML-Templates dynamisch
 * - Mischt Template-Reihenfolgen für Abwechslung
 * - Verwaltet Animationen mit Intersection Observer
 * - Behandelt Touch-Interaktionen für mobile Geräte
 *
 * Performance-Optimierungen:
 * - Modulare Funktionsstruktur
 * - Defensive Programmierung mit Try-Catch
 * - Optimierte DOM-Operationen
 * - Event-Delegation für bessere Memory-Performance
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Hilfsfunktion, um ein zufälliges Element aus einem Array zu erhalten
  const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Fisher-Yates (Knuth) Shuffle Algorithmus - Optimiert
  function shuffleArray(array) {
    const result = [...array]; // Erstelle Kopie für Unveränderlichkeit
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // Mapping von Sektions-IDs zu Arrays von HTML-Template-IDs
  const sectionTemplateIds = {
    'section-hero': ['template-hero-1', 'template-hero-2', 'template-hero-3'],
    'section-features': [
      'template-features-1',
      'template-features-2',
      'template-features-3',
    ],
    'section-about': [
      'template-about-1',
      'template-about-2',
      'template-about-3',
    ],
  };

  // Speicher für die gemischten Reihenfolgen der Template-IDs und den aktuellen Index
  const shuffledSections = {};

  // Initialisiere die gemischten Reihenfolgen beim Skriptstart - Optimiert
  function initializeShuffledSequences() {
    for (const [sectionId, templateIds] of Object.entries(sectionTemplateIds)) {
      shuffledSections[sectionId] = {
        sequence: shuffleArray(templateIds),
        index: 0,
      };
    }
  }

  // Animation-Tracking: Speichert, welche Sektionen bereits erfolgreich animiert wurden seit dem letzten Reset
  const animatedSections = {
    'section-hero': false,
    'section-features': false,
    'section-about': false,
  };

  // Animation-Cooldown-Tracking pro Sektion
  const animationCooldowns = {};
  const COOLDOWN_DURATION = 800; // ms: Cooldown-Dauer

  // Prüft, ob für einen Abschnitt eine Animation basierend auf dem Cooldown ausgeführt werden kann
  function canAnimate(sectionId) {
    const now = Date.now();
    if (
      animationCooldowns[sectionId] &&
      now - animationCooldowns[sectionId] < COOLDOWN_DURATION
    ) {
      return false;
    }
    animationCooldowns[sectionId] = now;
    return true;
  }

  // Fügt den Karten in der Features Sektion Layout-basierte Klassen hinzu - Optimiert
  function addCardLayoutClasses(containerElement) {
    // Prüfe, ob es sich um die Features Sektion handelt
    if (
      !containerElement?.parentElement ||
      containerElement.parentElement.id !== 'section-features'
    ) {
      return;
    }

    const cards = containerElement.querySelectorAll('.card');
    const layoutClasses = ['is-upper-card', 'is-middle-card', 'is-lower-card'];

    // Entferne alte Layout-Klassen von allen Karten
    cards.forEach((card) => card.classList.remove(...layoutClasses));

    if (cards.length === 3) {
      // Füge neue Klassen basierend auf der Reihenfolge hinzu
      cards[0].classList.add('is-upper-card');
      cards[1].classList.add('is-middle-card');
      cards[2].classList.add('is-lower-card');
    } else {
      console.warn(
        `Features Sektion erwartet 3 Karten für spezielle Animation, aber ${cards.length} gefunden.`
      );
    }
  }

  // Hilfsfunktion zum Entfernen von animate__ Klassen
  function removeAnimateClasses(element) {
    const classes = Array.from(element.classList);
    classes.forEach((cls) => {
      if (cls.startsWith('animate__')) {
        element.classList.remove(cls);
      }
    });
  }

  // Hilfsfunktion zum Konfigurieren der Z-Index für Karten
  function configureCardZIndex(element) {
    if (element.classList.contains('is-middle-card')) {
      element.style.zIndex = '10';
    } else if (
      element.classList.contains('is-upper-card') ||
      element.classList.contains('is-lower-card')
    ) {
      element.style.zIndex = '5';
    }
  }

  // Hilfsfunktion zum Animieren eines einzelnen Elements
  function animateElement(element, chosenAnimation, delay) {
    setTimeout(() => {
      element.classList.add('animate__animated', chosenAnimation);
      element.style.opacity = '1';
    }, delay);
  }

  // Verarbeitet ein einzelnes Animationselement
  function processAnimationElement(
    element,
    cardElements,
    staggerDelayText,
    staggerDelayCard,
    textDelayRef
  ) {
    const animationData = element.dataset.animation;
    if (!animationData) return;

    const possibleAnimations = animationData
      .split(',')
      .map((anim) => anim.trim())
      .filter((anim) => anim);

    if (possibleAnimations.length === 0) {
      console.warn(
        `Element hat data-animation="${animationData}", aber keine gültigen Animationen gefunden.`,
        element
      );
      return;
    }

    const chosenAnimation = getRandomElement(possibleAnimations);

    // Z-Index Steuerung für Karten
    configureCardZIndex(element);

    // Setze das Element in seinen Startzustand zurück
    element.classList.remove('animate__animated');
    removeAnimateClasses(element);
    element.style.opacity = '0';

    // Erzwinge Reflow - notwendig für Animation
    element.getBoundingClientRect();

    // Berechne Verzögerung
    let currentDelay;
    if (element.classList.contains('card')) {
      const cardBaseDelay = parseInt(element.dataset.delay) || 0;
      const cardIndex = cardElements.indexOf(element);
      currentDelay = cardBaseDelay + cardIndex * staggerDelayCard;
    } else {
      currentDelay = textDelayRef.value;
      textDelayRef.value += staggerDelayText;
    }

    // Starte die Animation
    animateElement(element, chosenAnimation, currentDelay);
  }

  // Startet die Animationen für alle Elemente
  function startAnimations(containerElement, sectionId) {
    const animElements = containerElement.querySelectorAll(
      '.text-animate, .scroll-animate, .card'
    );

    // Animation-Timing-Konstanten für bessere Wartbarkeit
    const STAGGER_DELAY_TEXT = 150;
    const STAGGER_DELAY_CARD = 100;

    const textDelayRef = { value: 0 };
    const cardElements = Array.from(containerElement.querySelectorAll('.card'));

    animElements.forEach((element) => {
      processAnimationElement(
        element,
        cardElements,
        STAGGER_DELAY_TEXT,
        STAGGER_DELAY_CARD,
        textDelayRef
      );
    });
  }

  // Initialisiert und startet die sequenziellen Animationen innerhalb eines Containers - Optimiert
  function initializeAnimations(containerElement) {
    const sectionId = containerElement.parentElement?.id;
    if (!sectionId) {
      console.warn('Container hat kein Parent-Element mit ID');
      return;
    }

    console.log(`Starte innere Animationen innerhalb von ${sectionId}`);
    animatedSections[sectionId] = true;

    requestAnimationFrame(() => {
      setTimeout(() => {
        startAnimations(containerElement, sectionId);
      }, 50); // Kleine Verzögerung für bessere Animation-Performance
    });
  }

  // Führt den visuellen Reset der Animationen durch - Optimiert
  function resetAnimations(sectionElement) {
    const currentContent = sectionElement.querySelector(
      '.full-screen-section, .vh-100'
    );
    const elementsToReset = [];

    if (currentContent) {
      elementsToReset.push(currentContent);
      elementsToReset.push(
        ...currentContent.querySelectorAll(
          '.text-animate, .scroll-animate, .card'
        )
      );
    } else {
      elementsToReset.push(
        ...sectionElement.querySelectorAll(
          '.text-animate, .scroll-animate, .card'
        )
      );
    }

    setTimeout(() => {
      elementsToReset.forEach((el) => {
        el.classList.remove('animate__animated');
        removeAnimateClasses(el);
        el.style.opacity = '0';
        el.style.removeProperty('transition');
        el.style.removeProperty('z-index');
      });
    }, 100);
  }

  // Aktualisiert den Inhalt einer Sections-Elements - Optimiert
  function updateSection(sectionId) {
    const sectionElement = document.getElementById(sectionId);
    const sectionSequenceData = shuffledSections[sectionId];

    if (
      !sectionElement ||
      !sectionSequenceData ||
      sectionSequenceData.sequence.length === 0
    ) {
      console.error(
        `Sektion ${sectionId} nicht gefunden oder keine gemischte Sequenz.`
      );
      return;
    }

    const templateId = sectionSequenceData.sequence[sectionSequenceData.index];
    const template = document.getElementById(templateId);

    if (!template) {
      console.error(`HTML Template mit ID ${templateId} nicht gefunden.`);
      sectionSequenceData.index =
        (sectionSequenceData.index + 1) % sectionSequenceData.sequence.length;
      return;
    }

    console.log(
      `Lade und setze Inhalt aus Template ${templateId} für Sektion ${sectionId}`
    );

    // Aktualisiere Index für nächsten Aufruf
    sectionSequenceData.index =
      (sectionSequenceData.index + 1) % sectionSequenceData.sequence.length;

    // Klone Template-Inhalt
    const clonedContent = document.importNode(template.content, true);

    // Leere Sektion und füge neuen Inhalt hinzu
    sectionElement.replaceChildren(clonedContent);

    // Finde neuen Container und initialisiere Animationen
    const newContentContainer = sectionElement.querySelector(
      '.full-screen-section, .vh-100'
    );

    if (newContentContainer) {
      addCardLayoutClasses(newContentContainer);
      newContentContainer.style.opacity = '0';
      newContentContainer.classList.add('animate__animated', 'animate__fadeIn');
      initializeAnimations(newContentContainer);
    } else {
      console.warn(
        `Kein erwarteter Container (.full-screen-section oder .vh-100) im Template ${templateId} gefunden. Versuche Animation auf Section-Element selbst.`
      );
      sectionElement.style.opacity = '0';
      sectionElement.classList.add('animate__animated', 'animate__fadeIn');
      initializeAnimations(sectionElement);
    }
  }

  // Überwacht die Sichtbarkeit der Sections mit dem IntersectionObserver - Optimiert
  function observeSections() {
    // Cache für ViewportBox - Performance-Optimierung
    const viewportBox = document.querySelector('.viewport-box');
    if (!viewportBox) {
      console.error('Viewport-Box (.viewport-box) nicht gefunden');
      return;
    }

    const options = {
      root: viewportBox,
      rootMargin: '0px',
      threshold: 0.5,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const section = entry.target;
        const sectionId = section.id;

        if (entry.isIntersecting) {
          if (!animatedSections[sectionId] && canAnimate(sectionId)) {
            console.log(
              `Sektion ${sectionId} ist sichtbar und bereit für Initialisierung.`
            );
            updateSection(sectionId);
          }
        } else {
          animatedSections[sectionId] = false;
          delete animationCooldowns[sectionId];
          resetAnimations(section);
        }
      });
    }, options);

    // Verwende moderne Array-Methoden
    ['section-hero', 'section-features', 'section-about'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      } else {
        console.error(`Element mit ID ${id} zum Beobachten nicht gefunden.`);
      }
    });
  }

  // --- Start der Ausführung ---
  initializeShuffledSequences(); // Diese Funktion kann sofort laufen.

  // Warte auf das benutzerdefinierte Event 'templatesLoaded' von templateLoader.js
  document.addEventListener('templatesLoaded', () => {
    console.log('Templates wurden geladen. Starte Sektionsbeobachtung.');
    observeSections(); // Jetzt können wir sicher sein, dass getElementById die Templates finden wird.
  });

  // Event-Handler für externe Trigger - Optimiert mit verbesserter Fehlerbehandlung
  function handleSectionUpdate(event) {
    try {
      const { sectionId } = event.detail || {};
      if (!sectionId) {
        console.warn('sectionUpdate Event ohne sectionId empfangen');
        return;
      }

      const sectionElement = document.getElementById(sectionId);

      if (sectionElement && shuffledSections[sectionId]) {
        console.log(
          `'sectionUpdate' Event für ${sectionId} empfangen. Erzwinge Update/Animation.`
        );
        animatedSections[sectionId] = false;
        delete animationCooldowns[sectionId];

        setTimeout(() => {
          updateSection(sectionId);
        }, 100);
      } else if (sectionId && !shuffledSections[sectionId]) {
        console.warn(
          `'sectionUpdate' Event für Sektion ${sectionId} empfangen, aber keine gemischte Sequenz gefunden.`
        );
      } else {
        console.warn(`Element mit ID ${sectionId} nicht gefunden.`);
      }
    } catch (error) {
      console.error('Fehler beim Verarbeiten des sectionUpdate Events:', error);
    }
  }

  function handleScrollToSection(event) {
    try {
      const { sectionId } = event.detail || {};
      if (!sectionId) {
        console.warn('scrollToSection Event ohne sectionId empfangen');
        return;
      }

      const sectionElement = document.getElementById(sectionId);

      if (sectionElement && shuffledSections[sectionId]) {
        console.log(`'scrollToSection' Event für ${sectionId} empfangen.`);

        animatedSections[sectionId] = false;
        delete animationCooldowns[sectionId];

        const viewportBox = document.querySelector('.viewport-box');
        if (!viewportBox) {
          console.warn(
            'Viewport-Box nicht gefunden für ScrollToSection Observer'
          );
          return;
        }

        const tempObserver = new IntersectionObserver(
          (entries, observer) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && entry.target.id === sectionId) {
                console.log(
                  `Scroll-Ziel Sektion ${sectionId} ist jetzt sichtbar. Starte Update.`
                );
                observer.unobserve(sectionElement);
                updateSection(sectionId);
              }
            });
          },
          { threshold: 0.7, root: viewportBox }
        );

        tempObserver.observe(sectionElement);
      } else if (sectionId && !shuffledSections[sectionId]) {
        console.warn(
          `'scrollToSection' Event für Sektion ${sectionId} empfangen, aber keine gemischte Sequenz gefunden.`
        );
      } else {
        console.warn(`Element mit ID ${sectionId} nicht gefunden.`);
      }
    } catch (error) {
      console.error(
        'Fehler beim Verarbeiten des scrollToSection Events:',
        error
      );
    }
  }

  // Registriere Event-Handler
  document.addEventListener('sectionUpdate', handleSectionUpdate);
  document.addEventListener('scrollToSection', handleScrollToSection);

  // Event-Delegation für Touch-Interaktionen - Optimiert mit verbesserter Fehlerbehandlung
  function handleTouchEvent(event, action) {
    try {
      const card = event.target?.closest('.card');
      if (card) {
        card.classList[action]('touch-active');
      }
    } catch (error) {
      console.error(
        `Fehler beim Verarbeiten des Touch-Events (${action}):`,
        error
      );
    }
  }

  // Registriere Touch-Events mit optimierter Event-Delegation
  document.addEventListener(
    'touchstart',
    (event) => handleTouchEvent(event, 'add'),
    { passive: true }
  );
  document.addEventListener(
    'touchend',
    (event) => handleTouchEvent(event, 'remove'),
    { passive: true }
  );
  document.addEventListener(
    'touchcancel',
    (event) => handleTouchEvent(event, 'remove'),
    { passive: true }
  );
});
