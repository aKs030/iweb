/*************************************************************************
 * For loading the menu.
 * The menu will not work if you open the file directly rather than on a web server.
 *************************************************************************/

(function () {
  "use strict";

  // Load menu content dynamically
  $(function () {
    $(".menu-container").load("menu.html");
  });

  // Menu button click handling
  var $menu = $('#menu'),
      $menuButton = $('#menu_button');
  
  $(document).on('click', function (evt) {
    if ($(evt.target).is($menuButton)) {
      $menu.toggle();
    } else if (!$(evt.target).closest($menu).length) {
      $menu.hide();
    }
  });

  // Back to top button functionality
  $(document).ready(function () {
    var backToTopButton = $('<a href="#top" class="back-to-top"><img class="image" src="img/top.png" style="max-width: 50px;"></a>');
    $("body").append(backToTopButton);
    backToTopButton.hide();

    $(window).on('scroll', function () {
      if ($(this).scrollTop() > 100) {
        backToTopButton.fadeIn();
      } else {
        backToTopButton.fadeOut();
      }
    });

    backToTopButton.on('click', function () {
      $('html, body').animate({ scrollTop: 0 }, 800);
      return false;
    });
  });

  // Scroll effect for moving background
  $(window).on('load resize scroll', function () {
    $('.bg-static').each(function () {
      var $this = $(this);
      var windowTop = $(window).scrollTop();
      var elementTop = $this.offset().top;
      var leftPosition = windowTop - elementTop;

      $this.find('.bg-move').css({ left: leftPosition });
    });
  });
})();
