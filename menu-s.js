document.addEventListener('DOMContentLoaded', function () {
    // Dynamically load the menu
    const menuHTML = `
      <nav>
        <ul>
          <li><a href="index.html">Home</a></li>
          <li><a href="spiel.html">Spiel</a></li>
          <li><a href="kontakt.html">Kontakt</a></li>
        </ul>
      </nav>
    `;
  
    const menuContainer = document.querySelector('.menu-container');
    menuContainer.innerHTML = menuHTML;
  
    // Highlight the active page
    const currentPage = window.location.pathname.split('/').pop();
    const menuLinks = document.querySelectorAll('nav ul li a');
  
    menuLinks.forEach(link => {
      if (link.getAttribute('href') === currentPage) {
        link.style.fontWeight = 'bold';
      }
    });
  });