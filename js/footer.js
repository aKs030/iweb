document.addEventListener("DOMContentLoaded", function () {
    /**
     * Funktion zum Erstellen des Footers
     */
    function createFooter() {
        // HTML für den Footer
        return `
            <footer class="site-footer">
                <div class="footer-content">
                    <p>&copy; ${new Date().getFullYear()} <a href="https://github.com/aKs030">aKs030</a>. Alle Rechte vorbehalten.</p>
                    <nav class="footer-nav">
                        <a href="impressum.html">Impressum</a>
                        <a href="datenschutz.html">Datenschutz</a>
                        <a href="kontakt.html">Kontakt</a>
                    </nav>
                </div>
            </footer>
        `;
    }

    /**
     * Dynamischer Footer-Einsatz
     */
    const footerPlaceholder = document.getElementById("footer-placeholder");
    if (footerPlaceholder) {
        footerPlaceholder.innerHTML = createFooter();
    } else {
        console.error("⚠️ Der Footer-Platzhalter (#footer-placeholder) wurde nicht gefunden!");
    }
});