(function () {
  "use strict";

  // Dynamisches Laden der Menüstruktur
  $(function () {
    $(".menu-container").load("menu.html", function () {
      console.log("Menu loaded successfully.");
    });
  });

  // Selektoren für Menü und Menü-Button
  const $menu = $("#menu");
  const $menuButton = $("#menu_button");

  // Klick-Handler für das Dokument
  $(document).on("click.menuToggle", function (event) {
    const $target = $(event.target);

    // Wenn auf den Menü-Button geklickt wird, Menü ein-/ausblenden
    if ($target.is($menuButton)) {
      $menu.toggle();
    }
    // Wenn außerhalb des Menüs geklickt wird, Menü ausblenden
    else if (!$target.closest($menu).length) {
      $menu.hide();
    }
  });

  $(document).ready(function(){
    var back_to_top_button = ['<a href="#top" class="back-to-top"> <img class="image" src="img/top.png" style="max-width: 50px;"></a>'].join("");
    $("body").append(back_to_top_button)
    $(".back-to-top").hide();
  
    $(function () {
      $(window).scroll(function () {
        if ($(this).scrollTop() > 100) {
          $('.back-to-top').fadeIn();
        } else {
          $('.back-to-top').fadeOut();
        }
      });
  
      $('.back-to-top').click(function () {
        $('body,html').animate({
          scrollTop: 0
        }, 800);
        return false;
      });
    });
  
  });
  
})();
