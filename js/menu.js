document.addEventListener('DOMContentLoaded', () => {
  fetch('menu.html')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP-Error! Status: ${response.status}`);
      }
      return response.text();
    })
    .then(menuMarkup => {
      const menuContainer = document.getElementById('menuContainer');
      if (!menuContainer) {
        console.error('menuContainer nicht gefunden!');
        return;
      }
      menuContainer.innerHTML = menuMarkup;

      const menuToggle = menuContainer.querySelector('.menu-toggle');
      const menu = menuContainer.querySelector('.menu');
      if (menuToggle && menu) {
        menuToggle.addEventListener('click', () => {
          menu.classList.toggle('open');
          menuToggle.classList.toggle('active');
        });
      }

      const logoContainer = menuContainer.querySelector('.logo-container');
      if (logoContainer) {
        logoContainer.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          window.location.href = 'index.html';
        });
      }
    })
    .catch(err => {
      console.error('Fehler beim Laden des Menüs:', err);
      const fallback = document.createElement('div');
      fallback.textContent = 'Menü konnte nicht geladen werden.';
      fallback.style.color = 'red';
      fallback.style.textAlign = 'center';
      document.body.prepend(fallback);
    });

  document.addEventListener('click', (event) => {
    const menu = document.querySelector('.menu');
    const menuToggle = document.querySelector('.menu-toggle');

    if (menu && menuToggle && menu.classList.contains('open')) {
      if (!menu.contains(event.target) && !menuToggle.contains(event.target)) {
        menu.classList.remove('open');
        menuToggle.classList.remove('active');
      }
    }
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