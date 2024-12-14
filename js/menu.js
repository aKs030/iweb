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
  cdocument.addEventListener("DOMContentLoaded", function () {
    const menuButton = document.getElementById("menu_button");
    const menu = document.getElementById("menu");
  
    // Toggle visibility of the menu
    menuButton.addEventListener("click", function () {
      if (menu.style.display === "flex") {
        menu.style.display = "none";
      } else {
        menu.style.display = "flex";
      }
    });
  
    // Close the menu when clicking outside
    document.addEventListener("click", function (event) {
      if (!menu.contains(event.target) && !menuButton.contains(event.target)) {
        menu.style.display = "none";
      }
    });
  });