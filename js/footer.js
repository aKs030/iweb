document.addEventListener("DOMContentLoaded", function() {
    // HTML-Inhalt des Footers
    const footerHTML = `
        <footer>
            <p>&copy; 2025 Dein Unternehmen. Alle Rechte vorbehalten.</p>
            <nav>
                <a href="impressum.html">Impressum</a> |
                <a href="datenschutz.html">Datenschutz</a> |
                <a href="kontakt.html">Kontakt</a>
            </nav>
        </footer>
    `;

    // Footer in den Platzhalter einfügen
    document.getElementById("footer-placeholder").innerHTML = footerHTML;
});