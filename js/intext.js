document.addEventListener('DOMContentLoaded', () => {
    // Funktion zur zufälligen Auswahl eines Elements aus einem Array
    const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Abschnittsdaten
    const sections = {
        hero: [
            `<section class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
                <h3 class="display-3 fw-bold text-animate animate__animated shimmer-text" data-animation="animate__fadeInDown">
                    Willkommen 1<hr>
                </h3>
                <p class="lead text-animate" style="text-align: left;" data-animation="animate__fadeInUp">
                    Inhalt für Hero 1
                </p>
            </section>`,
            `<section class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
                <h3 class="display-3 fw-bold text-animate animate__animated shimmer-text" data-animation="animate__fadeInDown">
                    Willkommen 2<hr>
                </h3>
                <p class="lead text-animate" style="text-align: left;" data-animation="animate__fadeInUp">
                    Inhalt für Hero 2
                </p>
            </section>`
        ],
        about: [
            `<section class="vh-100 d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
                <p class="lead scroll-animate" data-animation="animate__fadeInDown">
                    Über mich - Variante 1
                </p>
                <h2 class="scroll-animate" data-animation="animate__fadeInUp">
                    Details zu mir 1
                </h2>
            </section>`,
            `<section class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
                <p class="lead text-animate" data-animation="animate__fadeInUp">
                    Über mich - Variante 2
                </p>
                <h2 class="text-animate" data-animation="animate__fadeInDown">
                    Details zu mir 2
                </h2>
            </section>`
        ],
        features: [
            `<section class="full-screen-section d-flex flex-column justify-content-center align-items-center text-center snap transparent-section">
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
            </section>`
        ]
    };

    // Funktion zum Aktualisieren der Abschnitte mit zufälligen Inhalten
    const updateSections = () => {
        document.getElementById('section-hero').innerHTML = getRandomElement(sections.hero);
        document.getElementById('section-about').innerHTML = getRandomElement(sections.about);
        document.getElementById('section-features').innerHTML = getRandomElement(sections.features);
    };

    // Abschnitte initial laden
    updateSections();

    // Event Listener für das Scrollen hinzufügen (mit Throttling zur Performance-Optimierung)
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