document.addEventListener("DOMContentLoaded", function () {
    /**
     * Dynamische Erstellung des Footers
     */
    function createFooter() {
        return `
            <footer class="site-footer">
                <p>© ${new Date().getFullYear()} <a href="https://github.com/aKs030">aKs030</a>. Alle Rechte vorbehalten.</p>
                <nav>
                    <a href="impressum.html">Impressum</a>
                    <a href="datenschutz.html">Datenschutz</a>
                    <a href="kontakt.html">Kontakt</a>
                </nav>
                <div class="social-icons">
                    <a href="https://facebook.com" target="_blank" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
                    <a href="https://twitter.com" target="_blank" aria-label="Twitter"><i class="fab fa-twitter"></i></a>
                    <a href="https://instagram.com" target="_blank" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
                </div>
            </footer>
        `;
    }

    const footerPlaceholder = document.getElementById("footer-placeholder");
    if (footerPlaceholder) {
        footerPlaceholder.innerHTML = createFooter();
    } else {
        console.error("⚠️ Footer-Platzhalter (#footer-placeholder) wurde nicht gefunden!");
    }
});