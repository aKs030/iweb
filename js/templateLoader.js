/**
 * Template Loader System
 * 
 * Lädt HTML-Templates dynamisch und macht sie für das intext.js System verfügbar.
 * 
 * Features:
 * - Asynchrones Laden von HTML-Templates
 * - Robuste Fehlerbehandlung
 * - Custom Event für Template-Ready-Status
 * - Performance-optimierte DOM-Manipulation
 */

// js/templateLoader.js
document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        try {
            console.log('Starte Template-Loading...');
            
            const response = await fetch('pages/index-card.html');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            
            const text = await response.text();
            
            // Sicherheitsprüfung für leeren Content
            if (!text.trim()) {
                throw new Error('Template-Datei ist leer oder konnte nicht gelesen werden');
            }

            // DOM-Fragment für bessere Performance
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = text;

            const hiddenTemplatesContainer = tempDiv.querySelector('.hidden-templates');

            if (hiddenTemplatesContainer) {
                document.body.appendChild(hiddenTemplatesContainer);
                
                // Bestätige erfolgreiches Laden
                const templateCount = hiddenTemplatesContainer.querySelectorAll('template').length;
                console.log(`Templates erfolgreich geladen: ${templateCount} Template(s) gefunden`);
                
                // Dispatch Event für abhängige Systeme
                document.dispatchEvent(new CustomEvent('templatesLoaded', {
                    detail: { templateCount }
                }));
            } else {
                console.warn('Keine .hidden-templates Container in der geladenen Datei gefunden');
            }
        } catch (error) {
            console.error('Fehler beim Laden der Templates:', error);
            
            // Fallback-Event für graceful degradation
            document.dispatchEvent(new CustomEvent('templatesLoadError', {
                detail: { error: error.message }
            }));
        }
    })();
});