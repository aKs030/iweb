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
 * - Performance-Monitoring Integration
 */

// js/templateLoader.js
document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        try {
            const startTime = performance.now();
            
            const response = await fetch('/pages/index-card.html');
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
                
                const endTime = performance.now();
                const loadTime = endTime - startTime;
                const templateCount = hiddenTemplatesContainer.querySelectorAll('template').length;
                console.log(`Templates erfolgreich geladen: ${templateCount} Template(s) in ${Math.round(loadTime)}ms`);
                
                document.dispatchEvent(new CustomEvent('templatesLoaded', {
                    detail: { 
                        templateCount,
                        loadTime,
                        timestamp: Date.now()
                    }
                }));
            } else {
                console.warn('Keine .hidden-templates Container in der geladenen Datei gefunden');
            }
        } catch (error) {
            console.error('Fehler beim Laden der Templates:', error);
            
            // Dispatch error event for monitoring and graceful degradation
            document.dispatchEvent(new CustomEvent('templateLoadError', {
                detail: { 
                    error: error.message, 
                    timestamp: Date.now() 
                }
            }));
        }
    })();
});
