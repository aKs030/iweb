document.addEventListener('DOMContentLoaded', () => {
    // Funktion zur zufälligen Auswahl eines Elements aus einem Array
    const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Abschnittsdaten
    const sections = {
        hero: [
            `
            <section id="hero1" class="vh-100 d-flex flex-column align-items-center text-center snap transparent-section">
                <h3 class="display-3 fw-bold scroll-animate animate__animated animate__fadeInDown shimmer-text">
                    Willkommen auf meiner Website!
                    <hr>
                </h3>
                <p class="lead scroll-animate animate__fadeInUp">
                    Entdecke meine neuesten Projekte und Ideen. Lass dich inspirieren!
                </p>
            </section>
            `,
            `
            <section id="hero2" class="vh-100 d-flex flex-column align-items-center text-center snap transparent-section">
                <h3 class="display-3 fw-bold scroll-animate animate__animated animate__fadeInDown shimmer-text">
                    Schön, dass du da bist!
                    <hr>
                </h3>
                <p class="lead scroll-animate animate__fadeInUp">
                    Hier findest du spannende Einblicke in meine kreativen Projekte.
                </p>
            </section>
            `
        ],
        about: [
            `
            <section id="about1" class="vh-100 d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
             <p class="lead scroll-animate" data-animation="animate__fadeInDown">
                Vielen Dank für deinen Besuch! Ich hoffe, du findest interessante Inhalte.
            </p>
                <h2 class="scroll-animate" data-animation="animate__fadeInUp">
                    Viel Spaß beim Stöbern!
                 </h2>
            </section>
            `,
            `
            <section id="about2" class="vh-100 d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
    <p class="lead scroll-animate" data-animation="animate__fadeInDown">
                    Hier teile ich meine Gedanken und Erfahrungen mit dir. Bleib dran!
                </p>
    <h2 class="scroll-animate" data-animation="animate__fadeInUp">
                    Lass uns gemeinsam Neues entdecken!
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
                            <p>Ich teile hier meine Leidenschaften, Interessen und Erlebnisse.</p>
                        </div>
                    </a>
                    <a href="album.html" class="card-link">
                        <div class="card bg-white text-center p-4">
                            <i class="bi bi-images display-4 mb-3"></i>
                            <h5 class="fw-bold">Fotogalerie</h5>
                            <p>Hier findest du einige Fotos von meinen Reisen und besonderen Ereignissen.</p>
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
                            <p>Erfahre mehr über meine technischen und kreativen Skills.</p>
                        </div>
                    </a>
                    <a href="projekte.html" class="card-link">
                        <div class="card bg-white text-center p-4">
                            <i class="bi bi-lightbulb display-4 mb-3"></i>
                            <h5 class="fw-bold">Projekte</h5>
                            <p>Entdecke einige meiner erfolgreich umgesetzten Projekte.</p>
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