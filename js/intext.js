document.addEventListener('DOMContentLoaded', () => {
    // Funktion zur zufälligen Auswahl eines Elements aus einem Array
    const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Abschnittsdaten
    const sections = {
        hero: [
            `<div class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center">
                <h3 class="display-3 fw-bold text-animate animate__animated shimmer-text">
                    Willkommen 1<hr>
                </h3>
                <p class="lead text-animate" style="text-align: left;">
                    Inhalt für Hero 1
                </p>
            </div>`,
            `<div class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center">
                <h3 class="display-3 fw-bold text-animate animate__animated shimmer-text">
                    Willkommen 2<hr>
                </h3>
                <p class="lead text-animate" style="text-align: left;">
                    Inhalt für Hero 2
                </p>
            </div>`
        ],
        about: [
            `<div class="vh-100 d-flex flex-column justify-content-center align-items-center text-center">
                <p class="lead scroll-animate">
                    Über mich - Variante 1
                </p>
                <h2>
                    Details zu mir 1
                </h2>
            </div>`,
            `<div class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center">
                <p class="lead text-animate">
                    Über mich - Variante 2
                </p>
                <h2>
                    Details zu mir 2
                </h2>
            </div>`
        ],
        features: [
            `<div class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center">
                <div class="container">
                    <div class="row row-cols-1 row-cols-md-2 g-4 justify-content-center">
                        <div class="col">
                            <h5 class="fw-bold animated-text text-dark">Feature 1</h5>
                            <p class="animated-text text-secondary">
                                Beschreibung Feature 1
                            </p>
                        </div>
                        <div class="col">
                            <h5 class="fw-bold animated-text text-dark">Feature 2</h5>
                            <p class="animated-text text-secondary">
                                Beschreibung Feature 2
                            </p>
                        </div>
                    </div>
                </div>
            </div>`
        ]
    };

    // Funktion zum Aktualisieren der Abschnitte mit zufälligen Inhalten
    const updateSections = () => {
        console.log('Aktualisiere Inhalte...');
        
        const heroSection = document.getElementById('section-hero');
        const aboutSection = document.getElementById('section-about');
        const featuresSection = document.getElementById('section-features');

        if (heroSection && aboutSection && featuresSection) {
            heroSection.innerHTML = getRandomElement(sections.hero);
            aboutSection.innerHTML = getRandomElement(sections.about);
            featuresSection.innerHTML = getRandomElement(sections.features);

            console.log('Hero-Inhalt:', heroSection.innerHTML);
            console.log('About-Inhalt:', aboutSection.innerHTML);
            console.log('Features-Inhalt:', featuresSection.innerHTML);
        } else {
            console.error('Ein oder mehrere Container wurden nicht gefunden.');
        }
    };

    // Initiales Laden der Inhalte
    updateSections();

    // Scroll-Event mit Throttling zur Performance-Optimierung
    let lastScrollTime = 0;
    const throttleDelay = 500; // Zeit in ms, um das Neuladen zu begrenzen

    window.addEventListener('scroll', () => {
        const currentTime = new Date().getTime();
        if (currentTime - lastScrollTime > throttleDelay) {
            updateSections();
            lastScrollTime = currentTime;
        }
    });
});