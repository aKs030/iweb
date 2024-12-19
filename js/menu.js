/*************************************************************************
 * For loading the menu.
 * The menu will not work if you open the file directly rather than on a web server.
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

  //Scroll top menü page 
$(window).on('load resize scroll', function() {
$('.bg-static').each(function() {
  var windowTop = $(window).scrollTop();
  var elementTop = $(this).offset().top;
  var leftPosition = windowTop - elementTop;
    $(this)
      .find('.bg-move')
      .css({ left: leftPosition });
});
});




