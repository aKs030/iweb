/*************************************************************************
 * MENU *
 *************************************************************************/

(function () {
  "use strict";
  
  $(function () {
    $(".menu-container").load("menu.html");
  });
})();

/* menu button click */
var menu = $('#menu'), but = $('#menu_button');
$(document).on('click', '*', function(evt) {
    evt.stopPropagation();
    if ($(this).is(but))
        menu.toggle();
    else if (!$(this).closest(menu).length)
        menu.hide();
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