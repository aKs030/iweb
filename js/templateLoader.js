// js/templateLoader.js

document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        try {
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
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    })();
});