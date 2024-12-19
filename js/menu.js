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


  
})();
