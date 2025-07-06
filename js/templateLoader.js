
// Lädt pages/index-card.html und injiziert .hidden-templates

document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        try {
            // WICHTIG: Passe diesen Pfad an den tatsächlichen Speicherort deiner index-card.html an!
            const response = await fetch('pages/index-card.html'); 
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = text;

            const hiddenTemplatesContainer = tempDiv.querySelector('.hidden-templates');

            if (hiddenTemplatesContainer) {
                document.body.appendChild(hiddenTemplatesContainer);
                document.dispatchEvent(new CustomEvent('templatesLoaded'));
                console.log("index-card.html geladen und .hidden-templates injiziert.");
            } else {
                console.warn("Warnung: .hidden-templates Container nicht in index-card.html gefunden.");
            }
        } catch (error) {
            console.error('Fehler beim Laden von index-card.html oder Templates:', error);
        }
    })();
});