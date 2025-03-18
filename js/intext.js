"use strict";

document.addEventListener('DOMContentLoaded', () => {
    const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Abschnittsdaten mit aktualisierten IDs
    const sections = {
        'section-hero': [
            `
<section id="section-hero" class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
    <h3 class="display-3 fw-bold text-animate animate__animated shimmer-text" data-animation="animate__fadeInDown">
      Willkommen1<hr>
    </h3>
    <p class="lead text-animate left-text" data-animation="animate__fadeInUp">
      Ich freue mich, dass du den Weg hierher gefunden hast.<br>
      Diese Seite dient als mein digitales Zuhause im
      World Wide Web, auf der ich meine Interessen,
      Erfahrungen und Gedanken teilen möchte.
    </p>
</section>
            `,
            `
<section id="section-hero" class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
    <h3 class="display-3 fw-bold text-animate animate__animated shimmer-text" data-animation="animate__fadeInDown">
      Willkommen2<hr>
    </h3>
    <p class="lead text-animate left-text" data-animation="animate__fadeInUp">
      Ich freue mich, dass du den Weg hierher gefunden hast.<br>
      Diese Seite dient als mein digitales Zuhause im<br>
      World Wide Web, auf der ich meine Interessen,<br>
      Erfahrungen und Gedanken teilen möchte.
    </p>
</section>
            `,
            `
<section id="section-hero" class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
    <h3 class="display-3 fw-bold text-animate animate__animated shimmer-text" data-animation="animate__fadeInDown">
      Willkommen3<hr>
    </h3>
    <p class="lead text-animate left-text" data-animation="animate__fadeInUp">
      Ich freue mich, dass du den Weg hierher gefunden hast.<br>
      Diese Seite dient als mein digitales Zuhause im
      World Wide Web, auf der ich meine Interessen,
      Erfahrungen und Gedanken teilen möchte.
    </p>
</section>
            `
        ],

        'section-features': [
            `

            <section id="section-features" class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
  <div class="container">
    <div class="row row-cols-1 row-cols-md-2 g-4 justify-content-center">
    
      <div class="col">
        <a href="ubermich.html" class="text-decoration-none text-reset animated-link">
                 <div class="card border-0 text-center scroll-animate p-4"
          data-animation="animate__flipInX" 
          data-delay="400">
          <div class="icon-wrapper d-flex justify-content-center align-items-center">
            <i class="bi bi-person-circle display-4 animated-icon mb-3" style="color: #444;"></i>
            </div>
            <h5 class="fw-bold animated-text" style="color: #444;">Wer bin ich?</h5>
            <p class="animated-text" style="color: #666;">
              Einblicke in meine Persönlichkeit,<br>
              meine Hobbys und das, was mich begeistert.
              1
            </p>
          </div>
        </a>
      </div>

      <div class="col">
        <a href="album.html" class="text-decoration-none text-reset animated-link">
          <div class="card border-0 text-center scroll-animate p-4"
          data-animation="animate__flipInX" 
          data-delay="800">
          <div class="icon-wrapper d-flex justify-content-center align-items-center">
          <i class="bi bi-camera-fill display-4 animated-icon mb-3" style="color: #444;"></i>
            </div>
            <h5 class="fw-bold animated-text" style="color: #444;">Meine Erinnerungen</h5>
            <p class="animated-text" style="color: #666;">
              Hier findet ihr eine bunte Sammlung von Fotos,
              spannenden Eindrücken und besonderen Momenten.
            </p>
          </div>
        </a>
      </div>

      <div class="col">
        <a href="game.html" class="text-decoration-none text-reset animated-link">
          <div class="card border-0 text-center scroll-animate p-4"
            data-animation="animate__flipInX" 
            data-delay="1200">
            <div class="icon-wrapper d-flex justify-content-center align-items-center">
            <i class="bi bi-joystick display-4 animated-icon mb-3" style="color: #444;"></i>
              </div>
              <h5 class="fw-bold animated-text" style="color: #444;">Game-Zone</h5>
              <p class="animated-text" style="color: #666;">
                  Tauche ein in spannende Spiele!<br>
                  Teste dein Können in kniffligen Herausforderungen.
              </p>
          </div>
        </a>
      </div>
    </div>
  </div>
</section>

            
            `,
            `



<section id="section-features" class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
  <div class="container">
    <div class="row row-cols-1 row-cols-md-2 g-4 justify-content-center">
    
      <div class="col">
        <a href="ubermich.html" class="text-decoration-none text-reset animated-link">
          <div class="card border-0 text-center scroll-animate p-4           <div class="card border-0 text-center scroll-animate p-4" "
          data-animation="animate__flipInX" 
          data-delay="400">
          <div class="icon-wrapper d-flex justify-content-center align-items-center">
            <i class="bi bi-person-badge display-4 animated-icon mb-3" style="color: #444;"></i>
            </div>
            <h5 class="fw-bold animated-text" style="color: #444;">Wer bin ich?</h5>
            <p class="animated-text" style="color: #666;">
              Einblicke in meine Persönlichkeit,<br>
              meine Hobbys und das, was mich begeistert.
              2
            </p>
          </div>
        </a>
      </div>

      <div class="col">
        <a href="album.html" class="text-decoration-none text-reset animated-link">
          <div class="card border-0 text-center scroll-animate p-4           <div class="card border-0 text-center scroll-animate p-4" "
          data-animation="animate__flipInX" 
          data-delay="800">
          <div class="icon-wrapper d-flex justify-content-center align-items-center">
          <i class="bi bi-images display-4 animated-icon mb-3" style="color: #444;"></i>
            </div>
            <h5 class="fw-bold animated-text" style="color: #444;">Meine Erinnerungen</h5>
            <p class="animated-text" style="color: #666;">
              Hier findet ihr eine bunte Sammlung von Fotos,spannenden Eindrücken und besonderen Momenten.
            </p>
          </div>
        </a>
      </div>

      <div class="col">
        <a href="game.html" class="text-decoration-none text-reset animated-link">
          <div class="card border-0 text-center scroll-animate p-4           <div class="card border-0 text-center scroll-animate p-4" "
            data-animation="animate__flipInX" 
            data-delay="1200">
            <div class="icon-wrapper d-flex justify-content-center align-items-center">
            <i class="bi bi-controller display-4 animated-icon mb-3" style="color: #444;"></i>
              </div>
              <h5 class="fw-bold animated-text" style="color: #444;">Game-Zone</h5>
              <p class="animated-text" style="color: #666;">
                  Tauche ein in spannende Spiele!<br>
                  Teste dein Können in kniffligen Herausforderungen.
              </p>
          </div>
        </a>
      </div>
    </div>
  </div>
</section>

            `,
            `

<section id="section-features" class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
  <div class="container">
    <div class="row row-cols-1 row-cols-md-2 g-4 justify-content-center">
    
      <div class="col">
        <a href="ubermich.html" class="text-decoration-none text-reset animated-link">
          <div class="card border-0 text-center scroll-animate p-4           <div class="card border-0 text-center scroll-animate p-4" "
          data-animation="animate__flipInX" 
          data-delay="400">
          <div class="icon-wrapper d-flex justify-content-center align-items-center">
            <i class="bi bi-person-lines-fill display-4 animated-icon mb-3" style="color: #444;"></i>
            </div>
            <h5 class="fw-bold animated-text" style="color: #444;">Wer bin ich?</h5>
            <p class="animated-text" style="color: #666;">
              Einblicke in meine Persönlichkeit,<br>
              meine Hobbys und das, was mich begeistert.
              3
            </p>
          </div>
        </a>
      </div>

      <div class="col">
        <a href="album.html" class="text-decoration-none text-reset animated-link">
          <div class="card border-0 text-center scroll-animate p-4           <div class="card border-0 text-center scroll-animate p-4" "
          data-animation="animate__flipInX" 
          data-delay="800">
          <div class="icon-wrapper d-flex justify-content-center align-items-center">
          <i class="bi bi-file-image display-4 animated-icon mb-3" style="color: #444;"></i>
            </div>
            <h5 class="fw-bold animated-text" style="color: #444;">Meine Erinnerungen</h5>
            <p class="animated-text" style="color: #666;">
              Hier findet ihr eine bunte Sammlung von Fotos, spannenden Eindrücken und besonderen Momenten.
            </p>
          </div>
        </a>
      </div>

      <div class="col">
        <a href="game.html" class="text-decoration-none text-reset animated-link">
          <div class="card border-0 text-center scroll-animate p-4           <div class="card border-0 text-center scroll-animate p-4" "
            data-animation="animate__flipInX" 
            data-delay="1200">
            <div class="icon-wrapper d-flex justify-content-center align-items-center">
            <i class="bi bi-dice-5 display-4 animated-icon mb-3" style="color: #444;"></i>
              </div>
              <h5 class="fw-bold animated-text" style="color: #444;">Game-Zone</h5>
              <p class="animated-text" style="color: #666;">
                  Tauche ein in spannende Spiele! Teste dein Können in kniffligen Herausforderungen.
              </p>
          </div>
        </a>
      </div>
    </div>
  </div>
</section>


            `
        ],

        'section-about': [
          `
      <section id="section-about" class="vh-100 d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
          <p class="lead scroll-animate" data-animation="animate__fadeInUp">
              Vielen Dank, dass du meine Homepage besuchst.
              Ich hoffe, dass du hier interessante Inhalte findest und dich gerne auf meiner Seite umsiehst.
              Vergiss nicht, regelmäßig , vorbeizuschauen,
              um über meine neuesten Aktivitäten und Gedanken auf dem Laufenden zu bleiben.
       </p>
      <h2 class="scroll-animate" data-animation="animate__fadeInDown">Alles Gute und viel Spaß beim Stöbern!<hr></h2>
      </section>
          `,
          `
      <section id="section-about" class="vh-100 d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
          <p class="lead scroll-animate" data-animation="animate__fadeInUp">
              Vielen Dank, dass du meine Homepage besuchst.
              Ich hoffe, dass du hier interessante Inhalte findest und dich gerne auf meiner Seite umsiehst.
              Vergiss nicht, regelmäßig , vorbeizuschauen,
              um über meine neuesten Aktivitäten und Gedanken auf dem Laufenden zu bleiben.
       </p>
      <h2 class="scroll-animate" data-animation="animate__fadeInDown">Alles Gute und viel Spaß beim Stöbern!<hr></h2>
      </section>
          `
      ]
    };

    // Initialisiert Animationsklassen in den jeweiligen Containern
    function initializeAnimations(container) {
        if (container.id === 'section-features') {
            const cards = container.querySelectorAll('.card');
            cards.forEach(card => {
                const animation = card.dataset.animation;
                const delay = parseInt(card.dataset.delay) || 0;
                card.classList.remove('animate__animated', animation);
                card.style.opacity = '0';
                setTimeout(() => {
                    card.classList.add('animate__animated', animation);
                    card.style.opacity = '1';
                }, delay);
            });
        } else {
            const animElements = container.querySelectorAll('.text-animate, .scroll-animate');
            animElements.forEach(element => {
                const animation = element.dataset.animation;
                if (animation) {
                    element.classList.remove('animate__animated', animation);
                    element.style.opacity = '0';
                    // Neuzuordnung erzwingen
                    void element.offsetWidth;
                    element.classList.add('animate__animated', animation);
                    element.style.opacity = '1';
                }
            });
        }
    }

    // Aktualisiert den Inhalt eines Sections
    function updateSection(sectionId) {
        const element = document.getElementById(sectionId);
        if (!element || !sections[sectionId]) return;
        element.innerHTML = getRandomElement(sections[sectionId]);
        initializeAnimations(element);
    }

    // Setzt Animationen zurück
    function resetAnimations(container) {
        const animElements = container.querySelectorAll('.text-animate, .scroll-animate');
        animElements.forEach(el => {
            const animation = el.dataset.animation;
            if (animation) {
                el.classList.remove('animate__animated', animation);
                el.style.opacity = '0';
            }
        });
    }

    // Überwacht die Sichtbarkeit der Sections
    function observeSections() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const section = entry.target;
                if (entry.isIntersecting) {
                    requestAnimationFrame(() => updateSection(section.id));
                } else {
                    requestAnimationFrame(() => resetAnimations(section));
                }
            });
        });
        ['section-hero', 'section-features', 'section-about'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                observer.observe(element);
            }
        });
    }

    // Initialisiert alle Sections
    function initSections() {
        ['section-hero', 'section-features', 'section-about'].forEach(id => {
            updateSection(id);
        });
    }

    // Hört auf externe Section-Updates
    document.addEventListener('sectionUpdate', (event) => {
        const { sectionId } = event.detail;
        updateSection(sectionId);
    });

    initSections();
    observeSections();

    // AnimationManager aus combined.js – optimiert und ergänzt
    class AnimationManager {
        constructor() {
            // Elemente selektieren (ohne .card)
            this.animateElements = document.querySelectorAll(".scroll-animate:not(.card), .text-animate:not(.card)");
            this.fullVisibleElements = document.querySelectorAll(".full-visible");
            this.animations = {
                fadeInUp: {
                    class: 'animate__fadeInUp',
                    duration: '0.8s',
                    timing: 'cubic-bezier(0.4, 0, 0.2, 1)'
                }
            };
        }

        init() {
            this.setupScrollAnimations();
            this.setupFullVisibleAnimations();
        }

        // Setzt den Observer für Elemente, die beim Scrollen animiert werden sollen
        setupScrollAnimations() {
            const observer = new IntersectionObserver(
                (entries) => this.handleScrollAnimations(entries),
                { threshold: 0.1 }
            );
            this.animateElements.forEach(el => observer.observe(el));
        }

        handleScrollAnimations(entries) {
            entries.forEach(({ target, isIntersecting }) => {
                if (!target.classList.contains("full-visible")) {
                    this.animateElement(target, isIntersecting);
                }
            });
        }

        // Setzt den Observer für voll sichtbare Elemente
        setupFullVisibleAnimations() {
            const observer = new IntersectionObserver(
                (entries, observer) => this.handleFullVisibleAnimations(entries, observer),
                { threshold: 1.0 }
            );
            this.fullVisibleElements.forEach(el => observer.observe(el));
        }

        handleFullVisibleAnimations(entries, observer) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateElement(entry.target, true);
                    observer.unobserve(entry.target);
                }
            });
        }

        animateElement(element, isIntersecting) {
            const delay = parseFloat(element.dataset.delay) || 0;
            if (isIntersecting) {
                element.style.opacity = '0';
                element.style.transform = 'translateY(0)';
                element.style.visibility = 'visible';
                setTimeout(() => {
                    element.classList.add('animate__animated', this.animations.fadeInUp.class);
                    element.style.animationDuration = this.animations.fadeInUp.duration;
                    element.style.animationTimingFunction = this.animations.fadeInUp.timing;
                    element.style.opacity = '1';
                    element.style.transform = 'translateY(0)';
                    element.addEventListener('animationend', () => {
                        element.classList.remove('animate__animated', this.animations.fadeInUp.class);
                    }, { once: true });
                }, delay);
            }
        }
    }

    const animationManager = new AnimationManager();
    animationManager.init();

    // Neue Event-Delegation für Touch-Interaktionen auf .card-Elementen mit passiver Option
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

