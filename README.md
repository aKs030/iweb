# iweb

## Hinweis: Service Worker vollständig entfernt (Nov 2025)

Die Website nutzt keinen Service Worker mehr. Bei Auslieferung nach diesem Datum werden eventuell vorhandene, alte Installer automatisch entfernt und projektbezogene Caches bereinigt:

- Registrierungen werden beim Seitenaufruf im Browser entfernt
- Ein "Tombstone"-Service-Worker (`sw.js`) deregistriert sich selbst, falls er doch installiert würde
- CI-Workflow referenziert keinen Service Worker mehr

So kann die Datei `sw.js` nach einer weiteren Veröffentlichung auch vollständig gelöscht werden.
