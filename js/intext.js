document.addEventListener('DOMContentLoaded', () => {
    console.log("Seite wurde geladen");

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
        document.getElementById('section-hero').innerHTML = getRandomElement(sections.hero);
        document.getElementById('section-about').innerHTML = getRandomElement(sections.about);
        document.getElementById('section-features').innerHTML = getRandomElement(sections.features);
    };

    // Initiales Laden der Inhalte
    updateSections();

    // Scroll-Event hinzufügen, um die Seite komplett neu zu laden
    window.addEventListener('scroll', () => {
        console.log("Seite wird neu geladen...");
        window.location.reload(); // Seite komplett neu laden
    });
});