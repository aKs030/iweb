document.addEventListener("DOMContentLoaded", () => {
  const observerOptions = {
      threshold: 0.6, // Aktiviert, wenn 60% sichtbar sind
      rootMargin: "0px 0px -50px 0px", // Offset für besseres Scrollen
  };

  // Selektoren zwischenspeichern
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll("section");
  const scrollAnimateElements = document.querySelectorAll(".scroll-animate");
  const navLinks = document.querySelectorAll(".nav-link");

  // Callback-Funktion für den IntersectionObserver
  const observerCallback = (entries) => {
      entries.forEach(({ target, isIntersecting }) => {
          const animationClass = target.dataset.animation || "animate__fadeInUp";
          const delayInS = parseFloat(target.dataset.delay || "0") / 1000; // Verzögerung in Sekunden

          if (isIntersecting) {
              // Sichtbare Elemente: Animation anwenden
              if (target.classList.contains("scroll-animate")) {
                  target.style.transitionDelay = `${delayInS}s`;
                  target.classList.add("visible", "animate__animated", animationClass);
              }

              // Navigation aktualisieren, wenn die Section eine ID hat
              if (target.id) {
                  navItems.forEach((item) => item.classList.remove("active"));
                  const activeNavItem = document.querySelector(`.nav-item[data-section="${target.id}"]`);
                  if (activeNavItem) {
                      activeNavItem.classList.add("active");
                  }
              }
          } else {
              // Animation entfernen, wenn Element nicht mehr sichtbar ist
              if (target.classList.contains("scroll-animate")) {
                  target.classList.remove("visible", "animate__animated", animationClass);
              }
          }
      });
  };

  // Initialisierung des IntersectionObserver
  const observer = new IntersectionObserver(observerCallback, observerOptions);

  // Beobachte alle <section>-Elemente und alle scroll-animate-Elemente
  sections.forEach((section) => observer.observe(section));
  scrollAnimateElements.forEach((element) => observer.observe(element));

  // Sanftes Scrollen bei Klick auf Navigation
  navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
          e.preventDefault(); // Standard-Link-Verhalten verhindern

          const targetId = link.getAttribute("href").substring(1);
          const targetSection = document.getElementById(targetId);
          if (targetSection) {
              targetSection.scrollIntoView({
                  behavior: "smooth", // Sanftes Scrollen
                  block: "start", // Scrollt zum Anfang des Abschnitts
              });
          }

          // Entferne die 'active'-Klasse von allen Navigationspunkten
          navItems.forEach((item) => item.classList.remove("active"));

          // Füge die 'active'-Klasse nur vorübergehend hinzu
          const clickedNavItem = link.closest(".nav-item");
          if (clickedNavItem) {
              clickedNavItem.classList.add("active");

              // Entferne die 'active'-Klasse nach einer kurzen Verzögerung
              setTimeout(() => {
                  clickedNavItem.classList.remove("active");
              }, 500); // Zeit in Millisekunden
          }
      });
  });
});
/*************************************************************************
 * BACK TO TOP BUTTON *
 *************************************************************************/
function smoothScrollToSection(sectionId) {
  const target = document.getElementById(sectionId);
  if (target) {
    window.scrollTo({
      top: target.offsetTop,
      behavior: 'smooth',
    });
  }
}
$(document).ready(function () {
  // Back-to-Top Button erstellen
  const backToTopButton = $(
    `<a href="#top" class="back-to-top">
      <img src="img/top.png" alt="Back to top" style="max-width: 50px;">
    </a>`
  );

  // Button einfügen
  $("body").append(backToTopButton);

  // CSS für den Button setzen
  $(".back-to-top").css({
    position: "fixed",
    bottom: "20px",
    right: "20px",
    display: "none", // Button versteckt initial
    cursor: "pointer",
    zIndex: 9999, // Button immer im Vordergrund
  });

  // Scroll-Event-Listener hinzufügen
  $(window).on("scroll", function () {
    if ($(this).scrollTop() > 50) {
      // Zeige Button, wenn mehr als 50px gescrollt
      $(".back-to-top").fadeIn();
    } else {
      // Verstecke Button, wenn weniger als 50px gescrollt
      $(".back-to-top").fadeOut();
    }
  });

  // Smooth-Scroll nach oben beim Klick
  $(".back-to-top").on("click", function (e) {
    e.preventDefault();
    $("html, body").animate({ scrollTop: 0 }, 800);
  });

  // Button initial anzeigen, wenn bereits gescrollt
  if ($(window).scrollTop() > 50) {
    $(".back-to-top").show();
  }
});