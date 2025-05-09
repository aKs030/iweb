document.addEventListener("DOMContentLoaded", function () {
    /**
     * Ultra-minimalistischer Footer
     */
    function createFooter() {
        return `
            <footer class="site-footer">
                <p>© ${new Date().getFullYear()} <a href="https://github.com/aKs030">aKs030</a></p>
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