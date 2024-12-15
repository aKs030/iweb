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