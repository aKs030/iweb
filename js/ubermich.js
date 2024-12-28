
    // Aktualisiert den aria-current Status für Navigationsbuttons
    function updateAriaCurrent(id) {
        document.querySelectorAll('.section-nav button').forEach((btn) => {
            btn.setAttribute('aria-current', btn.getAttribute('data-target') === `#${id}` ? 'true' : 'false');
        });
    }
    
    // DOMContentLoaded: Hauptlogik
    document.addEventListener('DOMContentLoaded', () => {
        const sections = document.querySelectorAll('.snap-ubermichbox');
        const navButtons = document.querySelectorAll('.section-nav button');
    
        // IntersectionObserver für sichtbare Sektionen
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    navButtons.forEach((button) => button.classList.remove('active'));
                    const activeButton = document.querySelector(`.section-nav button[data-target="#${entry.target.id}"]`);
                    if (activeButton) activeButton.classList.add('active');
                    updateAriaCurrent(entry.target.id);
                    entry.target.classList.add('is-visible');
                } else {
                    entry.target.classList.remove('is-visible');
                }
            });
        }, { threshold: 0.5 });
    
        sections.forEach((section) => observer.observe(section));
    
        // LazyLoad für Bilder
        const lazyImages = document.querySelectorAll('.lazyload');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazyload');
                    imageObserver.unobserve(img);
                }
            });
        });
    
        lazyImages.forEach((img) => imageObserver.observe(img));
    });
    
    // Navigation: Aktiver Link
    document.addEventListener('DOMContentLoaded', () => {
        const sections = document.querySelectorAll('.snap-ubermichbox');
        const navLinks = document.querySelectorAll('.section-nav button');
    
        function setActiveLink(sectionId) {
            navLinks.forEach((link) => {
                link.classList.remove('blink');
                if (link.getAttribute('data-target') === `#${sectionId}`) {
                    link.classList.add('blink');
                }
            });
        }
    
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const sectionId = entry.target.getAttribute('id');
                    setActiveLink(sectionId);
                }
            });
        }, { threshold: 0.6 });
    
        sections.forEach((section) => observer.observe(section));
    });
    
    // Überprüfung der Scroll-Position
    document.addEventListener('DOMContentLoaded', () => {
        const contentContainer = document.querySelector('.content-container');
        const button = document.querySelector('.button-runter');
    
        const checkScrollPosition = () => {
            const scrollTop = contentContainer.scrollTop;
            const clientHeight = contentContainer.clientHeight;
            const scrollHeight = contentContainer.scrollHeight;
    
            const isScrolledToEnd = scrollTop + clientHeight >= scrollHeight - 10;
            if (isScrolledToEnd) {
                button.classList.add('visible');
            } else {
                button.classList.remove('visible');
            }
        };
    
        if (contentContainer && button) {
            contentContainer.addEventListener('scroll', checkScrollPosition);
            checkScrollPosition();
        } else {
            console.error('contentContainer oder Button nicht gefunden.');
        }
    });
    
    // Scroll zu einer bestimmten Sektion
    function scrollToSection(id) {
        document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
    }
    
    // Highlight aktiver Button basierend auf sichtbarer Sektion
    document.addEventListener('DOMContentLoaded', () => {
        const sections = document.querySelectorAll('.snap-ubermichbox');
        const navButtons = document.querySelectorAll('.section-nav button');
    
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const targetId = entry.target.id;
                    navButtons.forEach((button) => {
                        button.classList.toggle('active', button.getAttribute('data-target') === `#${targetId}`);
                    });
                }
            });
        }, { threshold: 0.5 });
    
        sections.forEach((section) => observer.observe(section));
    });
    
    // Funktion, um einen bestimmten TEXT aus der Datei zu laden
    function loadSection(filePath, sectionName) {
        return fetch(filePath)
            .then(response => {
                if (!response.ok) throw new Error(`Fehler: ${response.statusText}`);
                return response.text();
            })
            .then(data => {
                const regex = new RegExp(`<!-- SECTION:${sectionName} -->([\\s\\S]*?)(?=<!-- SECTION:|$)`, 'g');
                const match = regex.exec(data);
                return match ? match[1].trim() : 'Abschnitt nicht gefunden.';
            })
            .catch(error => {
                console.error(`Fehler beim Laden des Abschnitts ${sectionName}:`, error);
                return 'Fehler beim Laden des Abschnitts.';
            });
    }
    
    // Liste von Containern und den zu ladenden Abschnitten
    const sectionsToLoad = [
        { containerId: 'section-ubersicht', section: 'UBERSICHT' },
        { containerId: 'section-person', section: 'PERSON' },
        { containerId: 'section-hobbys', section: 'HOBBYS' },
        { containerId: 'section-karriere', section: 'KARRIERE' },
        { containerId: 'section-kontakt', section: 'KONTAKT' },
    ];
    
    // Inhalte in die jeweiligen Container laden
    sectionsToLoad.forEach(({ containerId, section }) => {
        loadSection('content.txt', section).then(content => {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = content;
            }
        });
    });
    