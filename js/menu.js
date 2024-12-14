$(document).ready(function () {
  // Menü dynamisch laden
  $(".menu-container").load("menu.html", function () {
    console.log("Menu loaded successfully.");

    // Aktive Seite hervorheben
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    $(".menu-items a").each(function () {
      const linkPage = $(this).attr("href").split("/").pop();
      if (linkPage === currentPage) {
        $(this).addClass("active");
      } else {
        $(this).removeClass("active");
      }
    });
  });

  // Mobile Menü öffnen/schließen
  const $menuButton = $(".menu-button");
  const $menuItems = $(".menu-items");

  $menuButton.on("click", function (e) {
    e.preventDefault();
    $menuItems.toggleClass("show");
    console.log("Mobile menu toggled");
  });

  // Menü schließen, wenn außerhalb geklickt wird
  $(document).on("click", function (e) {
    if (!$(e.target).closest(".menu").length) {
      $menuItems.removeClass("show");
    }
  });
});