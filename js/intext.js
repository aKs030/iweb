"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // Hilfsfunktion, um ein zufälliges Element aus einem Array zu erhalten
    const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Fisher-Yates (Knuth) Shuffle Algorithmus
    // Mischt ein Array in-place
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]; // Tausche Elemente
        }
        return array; // Gibt das gemischte Array zurück (obwohl es in-place mischt)
    }

    // Mapping von Sektions-IDs zu Arrays von HTML-Template-IDs
    const sectionTemplateIds = {
        'section-hero': ['template-hero-1', 'template-hero-2', 'template-hero-3'],
        'section-features': ['template-features-1', 'template-features-2', 'template-features-3'],
        'section-about': ['template-about-1', 'template-about-2']
    };

    // Speicher für die gemischten Reihenfolgen der Template-IDs und den aktuellen Index
    const shuffledSections = {};

    // Initialisiere die gemischten Reihenfolgen beim Skriptstart
    function initializeShuffledSequences() {
        for (const sectionId in sectionTemplateIds) {
            if (sectionTemplateIds.hasOwnProperty(sectionId)) {
                const originalIds = [...sectionTemplateIds[sectionId]];
                shuffledSections[sectionId] = {
                    sequence: shuffleArray(originalIds),
                    index: 0
                };
                 console.log(`Sequenz für ${sectionId} gemischt:`, shuffledSections[sectionId].sequence);
            }
        }
    }

    // Animation-Tracking: Speichert, welche Sektionen bereits erfolgreich animiert wurden seit dem letzten Reset
    const animatedSections = {
        'section-hero': false,
        'section-features': false,
        'section-about': false
    };

    // Animation-Cooldown-Tracking pro Sektion
    let animationCooldowns = {};
    const COOLDOWN_DURATION = 800; // ms: Cooldown-Dauer (anpassbar)

    // Prüft, ob für einen Abschnitt eine Animation basierend auf dem Cooldown ausgeführt werden kann
    function canAnimate(sectionId) {
        const now = Date.now();
        if (animationCooldowns[sectionId] && now - animationCooldowns[sectionId] < COOLDOWN_DURATION) {
            return false;
        }
        animationCooldowns[sectionId] = now;
        return true;
    }

    // Fügt den Karten in der Features Sektion Layout-basierte Klassen hinzu (Upper, Middle, Lower)
    // Dies basiert auf der Reihenfolge der Karten im HTML/DOM.
    function addCardLayoutClasses(containerElement) {
        // Suche Karten nur innerhalb der Features Sektion
         if (containerElement.parentElement.id !== 'section-features') {
             return; // Mache nichts, wenn es nicht die Features Sektion ist
         }

        const cards = containerElement.querySelectorAll('.card');
        // Diese Logik ist spezifisch für den Fall, dass es genau 3 Karten gibt.
        if (cards.length === 3) {
            // Entferne eventuell vorhandene alte Layout-Klassen
            cards.forEach(card => card.classList.remove('is-upper-card', 'is-middle-card', 'is-lower-card'));

            // Füge neue Klassen basierend auf der Reihenfolge hinzu
            cards[0].classList.add('is-upper-card');
            cards[1].classList.add('is-middle-card');
            cards[2].classList.add('is-lower-card');
            console.log("Karten-Layout-Klassen hinzugefügt (Upper, Middle, Lower)");
        } else {
             // Logge eine Warnung, wenn die Anzahl der Karten nicht 3 ist
             console.warn(`Features Sektion erwartet 3 Karten für spezielle Animation, aber ${cards.length} gefunden.`);
             // Stelle sicher, dass keine speziellen Layout-Klassen gesetzt sind, die stören könnten
             cards.forEach(card => card.classList.remove('is-upper-card', 'is-middle-card', 'is-lower-card'));
        }
    }


    // Initialisiert und startet die sequenziellen Animationen innerhalb eines Containers
    function initializeAnimations(containerElement) {
         const sectionId = containerElement.parentElement.id;

         console.log(`Starte innere Animationen innerhalb von ${sectionId}`);
         animatedSections[sectionId] = true;


        requestAnimationFrame(() => {
            setTimeout(() => { // 50ms anfängliche Verzögerung nach rAF

                const animElements = containerElement.querySelectorAll('.text-animate, .scroll-animate, .card');

                const staggerDelayText = 150;
                const staggerDelayCard = 100;

                let textDelay = 0;
                const cardElements = Array.from(containerElement.querySelectorAll('.card'));


                animElements.forEach(element => {
                    const animationData = element.dataset.animation;

                    if (!animationData) return;

                    const possibleAnimations = animationData.split(',')
                                                            .map(anim => anim.trim())
                                                            .filter(anim => anim);

                    if (possibleAnimations.length === 0) {
                        console.warn(`Element hat data-animation="${animationData}", aber keine gültigen Animationen gefunden.`, element);
                        return;
                    }

                    const chosenAnimation = getRandomElement(possibleAnimations);

                    // --- Z-Index Steuerung für Karten während der Animation ---
                     let initialZIndex = '';
                     if (element.classList.contains('is-middle-card')) {
                         initialZIndex = '10';
                     } else if (element.classList.contains('is-upper-card') || element.classList.contains('is-lower-card')) {
                         initialZIndex = '5';
                     }
                     if(initialZIndex !== '') {
                         element.style.zIndex = initialZIndex;
                     }
                    // --- Ende Z-Index Steuerung ---


                    // Setze das Element in seinen Startzustand zurück (entferne alte Animationen)
                    element.classList.remove('animate__animated');
                     const classes = Array.from(element.classList);
                     classes.forEach(cls => {
                         if (cls.startsWith('animate__')) {
                             element.classList.remove(cls);
                         }
                     });

                    element.style.opacity = '0';

                    void element.offsetWidth; // Erzwinge Reflow

                    let currentDelay;
                    if (element.classList.contains('card')) {
                         const cardBaseDelay = parseInt(element.dataset.delay) || 0;
                         const cardIndex = cardElements.indexOf(element);
                         currentDelay = cardBaseDelay + (cardIndex * staggerDelayCard);

                    } else {
                         currentDelay = textDelay;
                         textDelay += staggerDelayText;
                    }

                    // Starte die Animation nach der berechneten Verzögerung
                    setTimeout(() => {
                        element.classList.add('animate__animated', chosenAnimation);
                        element.style.opacity = '1';
                    }, currentDelay);
                });

                 console.log(`Innere Animationen für ${sectionId} gestartet.`);

            }, 50);
        });
    }

     // Führt den visuellen Reset der Animationen durch (Klassen und Opazität entfernen)
    function resetAnimations(sectionElement) {
        const currentContent = sectionElement.querySelector('.full-screen-section, .vh-100');

        const elementsToReset = [];
        if(currentContent) {
            elementsToReset.push(currentContent);
            elementsToReset.push(...currentContent.querySelectorAll('.text-animate, .scroll-animate, .card'));
        } else {
            elementsToReset.push(...sectionElement.querySelectorAll('.text-animate, .scroll-animate, .card'));
        }


        setTimeout(() => {
            elementsToReset.forEach(el => {
                el.classList.remove('animate__animated');
                 const classes = Array.from(el.classList);
                 classes.forEach(cls => {
                     if (cls.startsWith('animate__')) {
                         el.classList.remove(cls);
                     }
                 });
                el.style.opacity = '0';
                el.style.removeProperty('transition');
                 el.style.removeProperty('z-index');
            });
        }, 100);
    }


    // Aktualisiert den Inhalt einer Sections-Elements aus der gemischten Sequenz und startet Animationen
    function updateSection(sectionId) {
        const sectionElement = document.getElementById(sectionId);
        const sectionSequenceData = shuffledSections[sectionId];

        if (!sectionElement || !sectionSequenceData || sectionSequenceData.sequence.length === 0) {
            console.error(`Sektion ${sectionId} nicht gefunden oder keine gemischte Sequenz.`);
            return;
        }

        const templateId = sectionSequenceData.sequence[sectionSequenceData.index];
        // Hier greifen wir auf das Template zu, das von templateLoader.js geladen und ins DOM eingefügt wurde.
        const template = document.getElementById(templateId);

        if (!template) {
            console.error(`HTML Template mit ID ${templateId} nicht gefunden.`);
            sectionSequenceData.index = (sectionSequenceData.index + 1) % sectionSequenceData.sequence.length;
            return;
        }

        console.log(`Lade und setze Inhalt aus Template ${templateId} für Sektion ${sectionId}`);

        sectionSequenceData.index = (sectionSequenceData.index + 1) % sectionSequenceData.sequence.length;

        const clonedContent = document.importNode(template.content, true);

        while (sectionElement.firstChild) {
            sectionElement.removeChild(sectionElement.firstChild);
        }

        sectionElement.appendChild(clonedContent);

        const newContentContainer = sectionElement.querySelector('.full-screen-section, .vh-100');

        if (newContentContainer) {
            addCardLayoutClasses(newContentContainer);
            newContentContainer.style.opacity = '0';
            newContentContainer.classList.add('animate__animated', 'animate__fadeIn');
            initializeAnimations(newContentContainer);
        } else {
             console.warn(`Kein erwarteter Container (.full-screen-section oder .vh-100) im Template ${templateId} gefunden. Versuche Animation auf Section-Element selbst.`);
             sectionElement.style.opacity = '0';
             sectionElement.classList.add('animate__animated', 'animate__fadeIn');
             initializeAnimations(sectionElement);
        }
    }

    // Überwacht die Sichtbarkeit der Sections mit dem IntersectionObserver
    function observeSections() {
        const options = {
            root: document.querySelector('.viewport-box'),
            rootMargin: '0px',
            threshold: 0.5
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const section = entry.target;
                const sectionId = section.id;

                if (entry.isIntersecting) {
                     if (!animatedSections[sectionId] && canAnimate(sectionId)) {
                         console.log(`Sektion ${sectionId} ist sichtbar und bereit für Initialisierung.`);
                         updateSection(sectionId);
                     }
                } else {
                    animatedSections[sectionId] = false;
                    delete animationCooldowns[sectionId];
                    resetAnimations(section);
                }
            });
        }, options);

        ['section-hero', 'section-features', 'section-about'].forEach(id => {
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


    // --- Event-Handler für externe Trigger ---

    document.addEventListener('sectionUpdate', (event) => {
        const { sectionId } = event.detail;
        const sectionElement = document.getElementById(sectionId);

        if (sectionId && sectionElement && shuffledSections[sectionId]) {
            console.log(`'sectionUpdate' Event für ${sectionId} empfangen. Erzwinge Update/Animation.`);
            animatedSections[sectionId] = false;
            delete animationCooldowns[sectionId];

            setTimeout(() => {
                updateSection(sectionId);
            }, 100);
        } else if (sectionId && !shuffledSections[sectionId]) {
             console.warn(`'sectionUpdate' Event für Sektion ${sectionId} empfangen, aber keine gemischte Sequenz gefunden.`);
        }
    });

     document.addEventListener('scrollToSection', (event) => {
         const { sectionId } = event.detail;
         const sectionElement = document.getElementById(sectionId);

         if (sectionId && sectionElement && shuffledSections[sectionId]) {
              console.log(`'scrollToSection' Event für ${sectionId} empfangen.`);

              animatedSections[sectionId] = false;
              delete animationCooldowns[sectionId];

              const tempObserver = new IntersectionObserver((entries, observer) => {
                   entries.forEach(entry => {
                       if (entry.isIntersecting && entry.target.id === sectionId) {
                           console.log(`Scroll-Ziel Sektion ${sectionId} ist jetzt sichtbar. Starte Update.`);
                           observer.unobserve(sectionElement);
                           updateSection(sectionId);
                       }
                   });
               }, { threshold: 0.7, root: document.querySelector('.viewport-box') });

               tempObserver.observe(sectionElement);

         } else if (sectionId && !shuffledSections[sectionId]) {
             console.warn(`'scrollToSection' Event für Sektion ${sectionId} empfangen, aber keine gemischte Sequenz gefunden.`);
         }
     });


    // Event-Delegation für Touch-Interaktionen auf .card-Elementen
    document.addEventListener('touchstart', (event) => {
        const card = event.target.closest('.card');
        if (card) {
            card.classList.add('touch-active');
        }
    }, { passive: true });

    document.addEventListener('touchend', (event) => {
        const card = event.target.closest('.card');
        if (card) {
            card.classList.remove('touch-active');
        }
    }, { passive: true });

    document.addEventListener('touchcancel', (event) => {
        const card = event.target.closest('.card');
        if (card) {
            card.classList.remove('touch-active');
        }
    }, { passive: true });

});