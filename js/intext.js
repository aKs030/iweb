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
        Diese Seite dient als mein digitales Zuhause im<br>
        World Wide Web, auf der ich meine Interessen,<br>
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
        Diese Seite dient als mein digitales Zuhause im<br>
        World Wide Web, auf der ich meine Interessen,<br>
        Erfahrungen und Gedanken teilen möchte.
      </p>
    </section>
            `
        ],
        'section-about': [
          `
    <section id="section-about" class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
      <p class="lead text-animate" data-animation="animate__fadeInUp">
        Vielen Dank, dass du meine Homepage besuchst.<br>
        Ich hoffe, dass du hier interessante Inhalte findest und dich gerne auf meiner Seite umsiehst.<br>
        Vergiss nicht, regelmäßig vorbeizuschauen,<br>
        um über meine neuesten Aktivitäten und Gedanken auf dem Laufenden zu bleiben.
      </p>
      <h2 class="text-animate" data-animation="animate__fadeInDown">
        Alles Gute und viel Spaß beim Stöbern!
      </h2>
    </section>
            `,
            `
    <section id="section-about" class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
      <p class="lead text-animate" data-animation="animate__fadeInUp">
        Vielen Dank, dass du meine Homepage besuchst.<br>
        Ich hoffe, dass du hier interessante Inhalte findest und dich gerne auf meiner Seite umsiehst.<br>
        Vergiss nicht, regelmäßig vorbeizuschauen,<br>
        um über meine neuesten Aktivitäten und Gedanken auf dem Laufenden zu bleiben.
      </p>
      <h2 class="text-animate" data-animation="animate__fadeInDown">
        Alles Gute und viel Spaß beim Stöbern!
      </h2>
    </section>
            `
        ],
        'section-features': [
          `
    <section id="section-features" class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
      <div class="container">
        <div class="row row-cols-1 row-cols-md-2 g-4 justify-content-center">
          <!-- Link zu Über Mich -->
          <div class="col">
            <a href="ubermich.html" class="text-decoration-none text-reset animated-link">
              <div class="card border-0 bg-white text-center scroll-animate p-4" data-animation="animate__flipInX" data-delay="400">
                <i class="bi bi-person-circle display-4 animated-icon mb-3 text-muted"></i>
                <h5 class="fw-bold animated-text text-dark">Über Mich</h5>
                <p class="animated-text text-secondary">
                  Ich teile hier meine Leidenschaften,<br>
                  Interessen und Erlebnisse.
                </p>
              </div>
            </a>
          </div>
          <div class="col">
            <a href="album.html" class="text-decoration-none text-reset animated-link">
              <div class="card border-0 bg-white text-center scroll-animate p-4" data-animation="animate__flipInX" data-delay="800">
                <i class="bi bi-images display-4 animated-icon mb-3 text-muted"></i>
                <h5 class="fw-bold animated-text text-dark">Fotogalerie</h5>
                <p class="animated-text text-secondary">
                  Hier findest du einige Fotos von meinen Reisen,<br>
                  von meinem Alltag und von besonderen Ereignissen,<br>
                  an denen ich teilgenommen habe.
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
          <div class="card border-0 bg-white text-center scroll-animate p-4" data-animation="animate__flipInX" data-delay="400">
            <i class="bi bi-emoji-smile display-4 animated-icon mb-3 text-primary"></i>
            <h5 class="fw-bold animated-text text-dark">Wer bin ich?</h5>
            <p class="animated-text text-secondary">
              Einblicke in meine Persönlichkeit,<br>
              meine Hobbys und das, was mich begeistert.
            </p>
          </div>
        </a>
      </div>
      <div class="col">
        <a href="album.html" class="text-decoration-none text-reset animated-link">
          <div class="card border-0 bg-white text-center scroll-animate p-4" data-animation="animate__flipInX" data-delay="800">
            <i class="bi bi-collection-fill display-4 animated-icon mb-3 text-primary"></i>
            <h5 class="fw-bold animated-text text-dark">Meine Erinnerungen</h5>
            <p class="animated-text text-secondary">
              Hier findet ihr eine bunte Sammlung von Fotos,<br>
              spannenden Eindrücken und besonderen Momenten.
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
          <div class="card border-0 bg-white text-center scroll-animate p-4" data-animation="animate__flipInX" data-delay="400">
            <i class="bi bi-person-fill display-4 animated-icon mb-3 text-muted"></i>
            <h5 class="fw-bold animated-text text-dark">Meine Geschichte</h5>
            <p class="animated-text text-secondary">
              Erfahre mehr über meine Leidenschaften,<br>
              Interessen und meine persönlichen Erlebnisse.
            </p>
          </div>
        </a>
      </div>
       <div class="col">
        <a href="album.html" class="text-decoration-none text-reset animated-link">
          <div class="card border-0 bg-white text-center scroll-animate p-4" data-animation="animate__flipInX" data-delay="800">
            <i class="bi bi-camera-fill display-4 animated-icon mb-3 text-muted"></i>
            <h5 class="fw-bold animated-text text-dark">Mein Album</h5>
            <p class="animated-text text-secondary">
              Entdecke Fotos von meinen Reisen,<br>
              besonderen Momenten und meinem Alltag.
            </p>
          </div>
        </a>
      </div>
    </div>
  </div>
    </section>
            `
        ]
    };

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
                    void element.offsetWidth;
                    element.classList.add('animate__animated', animation);
                    element.style.opacity = '1';
                }
            });
        }
    }

    function updateSection(sectionId) {
        const element = document.getElementById(sectionId);
        if (!element || !sections[sectionId]) return;

        element.innerHTML = getRandomElement(sections[sectionId]);
        initializeAnimations(element);
    }

    document.addEventListener('sectionUpdate', (event) => {
        const { sectionId } = event.detail;
        updateSection(sectionId);
    });

    function initSections() {
        ['section-hero', 'section-features', 'section-about'].forEach(section => {
            updateSection(section);
        });
    }

    function observeSections() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const sectionId = entry.target.id;
                if (entry.isIntersecting) {
                    updateSection(sectionId);
                } else {
                    resetAnimations(sectionId);
                }
            });
        }, );

        ['section-hero', 'section-features', 'section-about'].forEach(section => {
            const element = document.getElementById(section);
            if (element) {
                observer.observe(element);
            }
        });
    }

    function resetAnimations(sectionId) {
        const element = document.getElementById(sectionId);
        if (!element) return;

        const animElements = element.querySelectorAll('.text-animate, .scroll-animate');
        animElements.forEach(el => {
            const animation = el.dataset.animation;
            if (animation) {
                el.classList.remove('animate__animated', animation);
                el.style.opacity = '0';
            }
        });
    }

    initSections();
    observeSections();
});


