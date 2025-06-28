// js/templateLoader.js

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/templates.html'); // Stelle sicher, dass dieser Pfad korrekt ist!
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;

        const hiddenTemplatesContainer = tempDiv.querySelector('.hidden-templates');

        if (hiddenTemplatesContainer) {
            document.body.appendChild(hiddenTemplatesContainer);
            console.log('Templates erfolgreich geladen und "templatesLoaded" Event ausgelöst.');
            document.dispatchEvent(new CustomEvent('templatesLoaded'));
        } else {
            console.warn('Could not find .hidden-templates container in templates.html');
            // Wichtig: Wenn der Container nicht gefunden wird, intext.js wird nicht starten.
            // Überprüfe templates.html auf den korrekten Container.
        }

    } catch (error) {
        console.error('Error loading templates:', error);
    }
});