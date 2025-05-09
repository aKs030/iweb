document.addEventListener("DOMContentLoaded", function () {
    /**
     * Funktion zum Erstellen des Footers
     */
    function createFooter() {
        // HTML-Inhalt des Footers
        return `
            <footer class="site-footer">
                <p>&copy; ${new Date().getFullYear()} Dein Unternehmen. Alle Rechte vorbehalten.</p>
                <nav>
                    <a href="impressum.html">Impressum</a> |
                    <a href="datenschutz.html">Datenschutz</a> |
                    <a href="kontakt.html">Kontakt</a>
                </nav>
            </footer>
        `;
    }

    /**
     * Footer dynamisch in den Platzhalter einfügen
     */
    const footerPlaceholder = document.getElementById("footer-placeholder");
    if (footerPlaceholder) {
        footerPlaceholder.innerHTML = createFooter();
    } else {
        console.error("⚠️ Der Footer-Platzhalter (#footer-placeholder) wurde nicht gefunden!");
    }
});