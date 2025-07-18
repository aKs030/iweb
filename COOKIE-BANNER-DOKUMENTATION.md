# Cookie Banner System v2.4 - All-in-One Dokumentation

## Überblick

Das Cookie-Banner-System wurde in ein einheitliches All-in-One-System zusammengeführt. Eine einzige JavaScript-Datei übernimmt sowohl das automatische Laden des Cookie-Banners als auch die komplette Cookie-Verwaltung.

## Hauptkomponente

### Cookie System All-in-One

**Datei:** `/js/cookie-system.js`

Kombiniert folgende Funktionen:

- Automatisches Laden des Cookie-Banner HTML
- CSS-Preloading
- Vollständige Cookie-Consent-Verwaltung
- Google Analytics Integration
- DSGVO/CCPA Compliance
- Accessibility Features

### Cookie-Banner Snippet (unverändert)

**Datei:** `/pages/komponente/cookie-banner.html`

Enthält das komplette HTML für alle Cookie-Banner-Komponenten.

## Vereinfachte Implementierung

### Integration in HTML-Seiten

Jede Seite benötigt nur eine Zeile:

```html
<script src="/js/cookie-system.js" defer></script>
```

Das war's! Keine weitere Konfiguration erforderlich.

## Vorteile der Zusammenführung

### 1. Einfachheit

- ✅ Eine Datei für alles
- ✅ Keine Abhängigkeiten zwischen mehreren Scripts
- ✅ Automatische Initialisierung

### 2. Performance

- ✅ Weniger HTTP-Requests
- ✅ Optimierte Bundle-Größe
- ✅ Bessere Browser-Caching

### 3. Wartbarkeit

- ✅ Zentrale Codebasis
- ✅ Einheitliche API
- ✅ Weniger Dateien zu verwalten

### 4. Robustheit

- ✅ Keine Timing-Probleme zwischen Loader und Manager
- ✅ Bessere Fehlerbehandlung
- ✅ Konsistente Funktionalität

## Implementierung

### Automatische Initialisierung

Der Cookie-Banner-Loader wird automatisch initialisiert, wenn das DOM geladen ist:

```javascript
// Auto-Initialisierung in cookie-banner-loader.js
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    const loader = new CookieBannerLoader();
    await loader.init();
  });
} else {
  const loader = new CookieBannerLoader();
  loader.init();
}
```

### Manuelle Konfiguration

Für erweiterte Konfiguration:

```javascript
const loader = new CookieBannerLoader();
await loader.init({
  cssPath: '/css/cookies.css',
  bannerPath: '/pages/komponente/cookie-banner.html',
  cookieScriptPath: '/js/cookies.js',
  insertTarget: 'body',
  insertPosition: 'beforeend',
  preloadCSS: true,
});
```

### Integration in HTML-Seiten

Jede Seite benötigt nur eine Zeile:

```html
<script src="/js/cookie-banner-loader.js" defer></script>
```

## Aktualisierte Seiten

Die folgenden Seiten wurden bereits aktualisiert:

- ✅ `index.html` - Cookie-Banner entfernt, Loader hinzugefügt
- ✅ `pages/album.html` - Loader hinzugefügt
- ✅ `pages/ubermich.html` - Loader hinzugefügt
- ✅ `pages/index-game.html` - Loader hinzugefügt

## Vorteile

### 1. Zentrale Wartung

- Ein Cookie-Banner für alle Seiten
- Änderungen nur an einer Stelle erforderlich
- Konsistente Funktionalität

### 2. Performance

- CSS wird nur einmal geladen
- Lazy Loading des Cookie-Banners
- Keine doppelten Ressourcen

### 3. Fehlerbehandlung

- Graceful Degradation
- Detaillierte Logs
- Error Recovery

### 4. Flexibilität

- Konfigurierbare Optionen
- Event-basierte Architektur
- Einfache Erweiterung

## Events

Der Cookie-Banner-Loader stößt folgende Events an:

```javascript
// Cookie-Banner erfolgreich geladen
document.addEventListener('cookieBannerLoaded', (event) => {
  console.log('Cookie-Banner geladen:', event.detail);
});
```

## Debugging

Für Debugging-Zwecke:

```javascript
// Cookie-Banner Status prüfen
const loader = new CookieBannerLoader();
console.log('Geladen:', loader.isLoaded());

// Cookie-Banner entfernen (für Tests)
loader.remove();
```

## Migration neuer Seiten

Für neue HTML-Seiten:

1. Cookie-Banner-Loader Script hinzufügen:

   ```html
   <script src="/js/cookie-banner-loader.js" defer></script>
   ```

2. Keine weitere Konfiguration erforderlich - funktioniert automatisch!

## Fehlerbehebung

### Cookie-Banner wird nicht angezeigt

1. Browser-Konsole auf Fehler prüfen
2. Pfade in der Konfiguration überprüfen
3. CSS-Dateien auf Ladeproblemen prüfen

### JavaScript-Konflikte

1. Script-Loading-Reihenfolge prüfen
2. Event-Listener auf doppelte Registrierung prüfen
3. Browser-Kompatibilität testen

## Wartung

### Cookie-Banner aktualisieren

1. Änderungen in `/pages/komponente/cookie-banner.html` vornehmen
2. Bei CSS-Änderungen: `/css/cookies.css` bearbeiten
3. Bei JavaScript-Änderungen: `/js/cookies.js` bearbeiten

### Neue Features hinzufügen

1. HTML in `cookie-banner.html` erweitern
2. Funktionalität in `cookies.js` implementieren
3. Styling in `cookies.css` hinzufügen

Das System ist vollständig modular und ermöglicht einfache Wartung und Erweiterung des Cookie-Banners für die gesamte Website.
