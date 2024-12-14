$(document).ready(function () {
  /*************************************************************************
   * Dynamically load the menu from an external file.
   *************************************************************************/
  $(".menu-container").load("menu.html", function () {
    console.info("Menu loaded successfully.");

    // Highlight the active menu item
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    $(".menu-items a").each(function () {
      const linkPage = $(this).attr("href").split("/").pop();
      if (linkPage === currentPage) {
        $(this).addClass("active");
      }
    });

    // Add mobile menu toggle functionality
    $(".menu-button").on("click", function () {
      $(".menu-items").toggleClass("show");
    });

    // Hide menu when clicking outside
    $(document).on("click", function (e) {
      if (!$(e.target).closest(".menu").length) {
        $(".menu-items").removeClass("show");
      }
    });
  });

  /*************************************************************************
   * Back-to-Top Button Functionality
   *************************************************************************/
  const backToTopHTML = `
    <a href="#top" class="back-to-top" aria-label="Back to Top">
      <img src="img/top.png" alt="Back to Top Icon" style="max-width: 50px;">
    </a>`;
  $("body").append(backToTopHTML);

  const $backToTop = $(".back-to-top").hide();

  // Show/Hide Back-to-Top button
  $(window).on("scroll", function () {
    if ($(this).scrollTop() > 100) {
      $backToTop.fadeIn();
    } else {
      $backToTop.fadeOut();
    }
  });

  // Smooth scroll to the top
  $backToTop.on("click", function (e) {
    e.preventDefault();
    $("html, body").animate({ scrollTop: 0 }, 800);
  });
});