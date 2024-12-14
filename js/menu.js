$(document).ready(function () {
  /*************************************************************************
   * Dynamically load the menu and highlight the active menu item.
   *************************************************************************/
  $(".menu-container").load("menu.html", function () {
    console.log("Menu loaded successfully.");

    // Get the current page from the URL
    const currentPage = window.location.pathname.split("/").pop();

    // Highlight the active menu item
    $(".menu-items a").each(function () {
      const linkPage = $(this).attr("href");

      if (linkPage === currentPage || (currentPage === "" && linkPage === "index.html")) {
        $(this).addClass("active-menu");
      } else {
        $(this).removeClass("active-menu");
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

  const $backToTop = $(".back-to-top").hide(); // Initially hide the button

  // Show/Hide Back-to-Top button on scroll
  $(window).on("scroll", function () {
    if ($(this).scrollTop() > 100) {
      $backToTop.fadeIn();
    } else {
      $backToTop.fadeOut();
    }
  });

  // Smooth scroll to top on button click
  $backToTop.on("click", function (e) {
    e.preventDefault();
    $("html, body").animate({ scrollTop: 0 }, 800);
  });

  /*************************************************************************
   * Mobile Menu Button Toggle
   *************************************************************************/
  const $menuButton = $(".menu-button");
  const $menu = $(".menu-items");

  $menuButton.on("click", function (e) {
    e.preventDefault();
    $menu.toggle();
  });

  $(document).on("click", function (e) {
    if (!$(e.target).closest(".menu").length) {
      $menu.hide();
    }
  });
});