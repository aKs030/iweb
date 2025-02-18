document.addEventListener('DOMContentLoaded', () => {
    // Funktion zur zufälligen Auswahl eines Elements aus einem Array
    const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Abschnittsdaten
    const sections = {
hero: [`
    <section id="hero1" class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
        <h3 class="display-3 fw-bold text-animate animate__animated shimmer-text" data-animation="animate__fadeInDown">
        Willkommen1<hr>
      </h3>
      <p class="lead text-animate" style="text-align: left;" data-animation="animate__fadeInUp">
        Ich freue mich, dass du den Weg hierher gefunden hast.<br>
        Diese Seite dient als mein digitales Zuhause im<br>
        World Wide Web, auf der ich meine Interessen,<br>
        Erfahrungen und Gedanken teilen möchte.
      </p>
    </section>
            `,
            `
    <section id="hero2" class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
        <h3 class="display-3 fw-bold text-animate animate__animated shimmer-text" data-animation="animate__fadeInDown">
        Willkommen2<hr>
      </h3>
      <p class="lead text-animate" style="text-align: left;" data-animation="animate__fadeInUp">
        Ich freue mich, dass du den Weg hierher gefunden hast.<br>
        Diese Seite dient als mein digitales Zuhause im<br>
        World Wide Web, auf der ich meine Interessen,<br>
        Erfahrungen und Gedanken teilen möchte.
      </p>
    </section>
            `,
            `
    <section id="hero3" class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
        <h3 class="display-3 fw-bold text-animate animate__animated shimmer-text" data-animation="animate__fadeInDown">
        Willkommen3<hr>
      </h3>
      <p class="lead text-animate" style="text-align: left;" data-animation="animate__fadeInUp">
        Ich freue mich, dass du den Weg hierher gefunden hast.<br>
        Diese Seite dient als mein digitales Zuhause im<br>
        World Wide Web, auf der ich meine Interessen,<br>
        Erfahrungen und Gedanken teilen möchte.
      </p>
    </section>
`],

about: [
            `
            <section id="about1" class="vh-100 d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
             <p class="lead scroll-animate" data-animation="animate__fadeInDown">
1
            </p>
                <h2 class="scroll-animate" data-animation="animate__fadeInUp">
1
                 </h2>
            </section>
            `,
            `
            <section id="about2" class="vh-100 d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
    <p class="lead scroll-animate" data-animation="animate__fadeInDown">
2
                </p>
    <h2 class="scroll-animate" data-animation="animate__fadeInUp">
2
                </h2>
            </section>
            `
        ],
        features: [
            `
            <section id="features1" class="d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
                <div id="card-container">
                    <a href="ubermich.html" class="card-link">
                        <div class="card bg-white text-center p-4">
                            <i class="bi bi-person-circle display-4 mb-3"></i>
                            <h5 class="fw-bold">Über Mich</h5>
                            <p>Ich teile hier meine Leidenschaften, Interessen und Erlebnisse.</p>1
                        </div>
                    </a>
                    <a href="album.html" class="card-link">
                        <div class="card bg-white text-center p-4">
                            <i class="bi bi-images display-4 mb-3"></i>
                            <h5 class="fw-bold">Fotogalerie</h5>
                            <p>Hier findest du einige Fotos von meinen Reisen und besonderen Ereignissen.</p>1
                        </div>
                    </a>
                </div>
            </section>
            `,
            `
            <section id="features2" class="d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
                <div id="card-container">
                    <a href="skills.html" class="card-link">
                        <div class="card bg-white text-center p-4">
                            <i class="bi bi-gear-wide-connected display-4 mb-3"></i>
                            <h5 class="fw-bold">Fähigkeiten</h5>
                            <p>Erfahre mehr über meine technischen und kreativen Skills.</p>2
                        </div>
                    </a>
                    <a href="projekte.html" class="card-link">
                        <div class="card bg-white text-center p-4">
                            <i class="bi bi-lightbulb display-4 mb-3"></i>
                            <h5 class="fw-bold">Projekte</h5>
                            <p>Entdecke einige meiner erfolgreich umgesetzten Projekte.</p>2
                        </div>
                    </a>
                </div>
            </section>
            `
        ]
    };

    // Abschnitte in die entsprechenden Container einfügen
    document.getElementById('section-hero').innerHTML = getRandomElement(sections.hero);
    document.getElementById('section-about').innerHTML = getRandomElement(sections.about);
    document.getElementById('section-features').innerHTML = getRandomElement(sections.features);

    // Initialisierung der Karten-Animation
    initializeFeatureSections();
});

// Funktion zur Initialisierung der Karten-Animation für mehrere Feature-Sektionen
const initializeFeatureSections = () => {
    const featureSectionIds = ["features1", "features2", "features3"];
    let activeIndex = 0;

    featureSectionIds.forEach(sectionId => {
        const featuresSection = document.getElementById(sectionId);
        if (!featuresSection) return;

        const cards = featuresSection.querySelectorAll("#card-container .card");
        if (!cards.length) return;

        const updateCards = () => {
            cards.forEach((card, index) => {
                card.classList.toggle("active", index === activeIndex);
            });
        };

        const handleCardScroll = () => {
            const rect = featuresSection.getBoundingClientRect();
            if (rect.top < window.innerHeight / 2 && rect.bottom > window.innerHeight / 2) {
                const maxScroll = rect.height / cards.length;
                const scrolled = Math.abs(rect.top - window.innerHeight / 2);
                const newIndex = Math.floor(scrolled / maxScroll);
                if (newIndex !== activeIndex && newIndex < cards.length) {
                    activeIndex = newIndex;
                    updateCards();
                }
            }
        };

        // Optimiertes Scroll-Event mit IntersectionObserver
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    window.addEventListener("scroll", throttle(handleCardScroll, 150), { passive: true });
                    updateCards();
                } else {
                    window.removeEventListener("scroll", handleCardScroll);
                }
            });
        }, { threshold: 0.5 });

        observer.observe(featuresSection);
    });
};

// Throttle-Funktion zur Optimierung der Scroll-Performance
const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;
    return function () {
        const context = this, args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if (Date.now() - lastRan >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
};