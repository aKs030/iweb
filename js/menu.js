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


document.addEventListener('DOMContentLoaded', () => {
    const menuContainer = document.querySelector('.menu-container');
    fetch('menu.html')
        .then(response => response.text())
        .then(html => menuContainer.innerHTML = html)
        .catch(error => console.error('Fehler beim Laden des Menüs:', error));
});

const footerContainer = document.querySelector('.footer-container');
fetch('footer.html')
    .then(response => response.text())
    .then(html => footerContainer.innerHTML = html)
    .catch(error => console.error('Fehler beim Laden der Fußzeile:', error));

const lazyImages = document.querySelectorAll('img[loading="lazy"]');
lazyImages.forEach(img => {
    const src = img.dataset.src;
    if (src) {
        img.setAttribute('src', src);
    }
});