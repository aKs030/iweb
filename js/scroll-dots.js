document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('.snap-section');
    const dots = document.querySelectorAll('.dots-nav .dot');
    const viewportBox = document.querySelector('.viewport-box');
    
    // Variable, um zu verfolgen, ob gerade gescrollt wird
    let isScrolling = false;
    // Variable, um den letzten aktiven Abschnitt zu verfolgen
    let lastActiveSection = null;
    
    // Funktion zum Aktualisieren des aktiven Punktes basierend auf der Scroll-Position
    function updateActiveDot() {
        const scrollPosition = viewportBox.scrollTop;
        
        sections.forEach((section, index) => {
            // Position der Sektion relativ zum viewport-box
            const sectionTop = section.offsetTop - viewportBox.offsetTop;
            const sectionHeight = section.offsetHeight;
            
            // Prüfen, ob die Sektion im sichtbaren Bereich ist
            if (scrollPosition >= sectionTop - 100 && 
                scrollPosition < sectionTop + sectionHeight - 100) {
                
                // Aktiven Punkt aktualisieren
                dots.forEach(dot => dot.classList.remove('active'));
                dots[index].classList.add('active');
                
                // Event nur auslösen, wenn die Sektion gewechselt hat und kein aktives Scrollen stattfindet
                if (lastActiveSection !== section.id && !isScrolling) {
                    lastActiveSection = section.id;
                    // Event auslösen für intext.js
                    document.dispatchEvent(new CustomEvent('scrollToSection', { 
                        detail: { sectionId: section.id } 
                    }));
                }
                
                // Sektions-ID merken
                lastActiveSection = section.id;
            }
        });
    }
    
    // Event-Listener für Klicks auf die Dots
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const targetSectionId = dot.getAttribute('data-target');
            const targetSection = document.getElementById(targetSectionId);
            
            if (targetSection) {
                // Scroll-Flag setzen
                isScrolling = true;
                
                // Sanft zur Zielsektion scrollen
                viewportBox.scrollTo({
                    top: targetSection.offsetTop - viewportBox.offsetTop,
                    behavior: 'smooth'
                });
                
                // Aktiven Punkt sofort aktualisieren
                dots.forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                
                // Event auslösen für intext.js
                document.dispatchEvent(new CustomEvent('scrollToSection', { 
                    detail: { sectionId: targetSectionId } 
                }));
                
                // Scroll-Flag nach dem Scrollen zurücksetzen
                setTimeout(() => {
                    isScrolling = false;
                }, 600); // Länger als die Scroll-Animation
            }
        });
    });
    
    // Scroll-Event-Listener mit verbessertem Debounce
    let scrollTimeout;
    viewportBox.addEventListener('scroll', () => {
        // Flag setzen, wenn gescrollt wird
        isScrolling = true;
        
        // Sofort den aktiven Punkt aktualisieren für flüssiges Feedback
        updateActiveDot();
        
        // Bestehende Timeouts löschen
        clearTimeout(scrollTimeout);
        
        // Neuen Timeout setzen
        scrollTimeout = setTimeout(() => {
            // Scroll ist abgeschlossen
            isScrolling = false;
            
            // Einen letzten updateActiveDot-Aufruf machen
            updateActiveDot();
        }, 150); // Warten, bis der Benutzer mit dem Scrollen fertig ist
    });
    
    // Initialisierung beim Laden
    updateActiveDot();
});
