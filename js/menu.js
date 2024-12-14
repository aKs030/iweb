$(document).ready(function () {
  // Load menu dynamically
  $(".menu-container").load("menu.html", function () {
    console.log("Menu loaded successfully.");

    // Highlight active menu item
    const currentPage = window.location.pathname.split("/").pop(); // Aktuelle Seite
    $(".menu-items a").each(function () {
      const linkPage = $(this).attr("href").split("/").pop(); // Link im Menü
      if (linkPage === currentPage || (currentPage === "" && linkPage === "index.html")) {
        $(this).css({
          "font-weight": "bold",
          "color": "rgb(255, 255, 255)",
          "opacity": "1",
        });
      } else {
        $(this).css({
          "font-weight": "normal",
          "color": "rgba(255, 255, 255, 0.8)",
          "opacity": "0.8",
        });
      }
    });
  });

  // Back-to-Top Button
  const backToTopHTML = `
    <a href="#top" class="back-to-top" aria-label="Back to Top">
      <img src="img/top.png" alt="Back to Top Icon" style="max-width: 50px;">
    </a>`;
  $("body").append(backToTopHTML);

  const $backToTop = $(".back-to-top").hide();

  // Show/Hide Back-to-Top button on scroll
  $(window).on("scroll", function () {
    if ($(this).scrollTop() > 100) {
      $backToTop.fadeIn();
    } else {
      $backToTop.fadeOut();
    }
  });

  // Smooth scroll to top
  $backToTop.on("click", function (e) {
    e.preventDefault();
    $("html, body").animate({ scrollTop: 0 }, 800);
  });
});