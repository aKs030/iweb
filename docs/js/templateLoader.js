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

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  (async () => {
    try {
      const startTime = performance.now();

      // RELATIVER PFAD → funktioniert mit GitHub Pages UND lokal
      const response = await fetch('pages/index-card.html');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }

      const text = await response.text();

      if (!text.trim()) {
        throw new Error('Template-Datei ist leer oder konnte nicht gelesen werden');
      }

      // DOM-Fragment für besseres Einfügen
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = text;

      const hiddenTemplatesContainer = tempDiv.querySelector('.hidden-templates');

      if (hiddenTemplatesContainer) {
        // Templates am Ende von <body> einfügen
        document.body.appendChild(hiddenTemplatesContainer);

        const loadTime = performance.now() - startTime;
        const templateCount = hiddenTemplatesContainer.querySelectorAll('template').length;

        console.log(
          `✅ Templates geladen: ${templateCount} in ${Math.round(loadTime)}ms`
        );

        // Event für andere Scripte
        document.dispatchEvent(
          new CustomEvent('templatesLoaded', {
            detail: {
              templateCount,
              loadTime,
              timestamp: Date.now(),
            },
          })
        );
      } else {
        console.warn('⚠️ Kein .hidden-templates-Container gefunden in der geladenen Datei.');
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Templates:', error);

      // Event bei Fehler → für Logging oder Fallbacks
      document.dispatchEvent(
        new CustomEvent('templateLoadError', {
          detail: {
            error: error.message,
            timestamp: Date.now(),
          },
        })
      );
    }
  })();
});