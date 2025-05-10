document.addEventListener('DOMContentLoaded', () => {
  const viewportBox = document.querySelector('.viewport-box');
  const sections = document.querySelectorAll('.snap-section');
  const dots = document.querySelectorAll('.dot');
  
  // Funktion zur Aktualisierung des aktiven Punktes basierend auf sichtbarem Abschnitt
  const updateActiveDot = () => {
    const scrollPosition = viewportBox.scrollTop;
    
    sections.forEach((section, index) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      
      // Wenn der Abschnitt im Viewport ist (mit etwas Toleranz)
      if (scrollPosition >= sectionTop - 100 && 
          scrollPosition < sectionTop + sectionHeight - 100) {
        
        // Alle Punkte zurücksetzen und den aktuellen aktivieren
        dots.forEach(dot => dot.classList.remove('active'));
        dots[index].classList.add('active');
      }
    });
  };
  
  // Event-Listener für Scroll-Ereignisse
  viewportBox.addEventListener('scroll', updateActiveDot);
  
  // Klick-Event-Listener für Punkte
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const targetId = dot.getAttribute('data-target');
      const targetSection = document.getElementById(targetId);
      
      if (targetSection) {
        // Smooth Scroll zur Zielsektion
        viewportBox.scrollTo({
          top: targetSection.offsetTop,
          behavior: 'smooth'
        });
        
        // Punkt als aktiv markieren
        dots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      }
    });
  });
  
  // Initialisierung
  updateActiveDot();
});
