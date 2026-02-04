# Safe-Areas Implementierung

## Übersicht

Die Safe-Areas-Implementierung stellt sicher, dass der Webseiteninhalt dynamisch zwischen Menüleiste und Footer positioniert wird und auf allen Geräten (einschließlich Geräten mit Notches, abgerundeten Ecken und Home-Indikatoren) korrekt dargestellt wird.

## CSS-Variablen

### Globale Safe-Area-Variablen (root.css)

```css
/* Safe Area Insets - Native Geräte-Abstände */
--safe-top: env(safe-area-inset-top, 0);
--safe-bottom: env(safe-area-inset-bottom, 0);
--safe-left: env(safe-area-inset-left, 0);
--safe-right: env(safe-area-inset-right, 0);

/* Dynamic Layout Spacing - Menü & Footer */
--menu-height: 76px; /* 52px + 12px top + 12px spacing */
--footer-height: 76px; /* 52px + 12px bottom + 12px spacing */
--content-top-offset: calc(var(--menu-height) + var(--safe-top));
--content-bottom-offset: calc(var(--footer-height) + var(--safe-bottom));
```

### Mobile Anpassungen (≤768px)

```css
@media (width <= 768px) {
  :root {
    --menu-height: 64px; /* 48px + 8px top + 8px spacing */
    --footer-height: 64px; /* 48px + 8px bottom + 8px spacing */
  }
}
```

## Body Layout

Der Body verwendet die Safe-Area-Variablen für dynamisches Padding:

```css
body {
  padding-top: var(--content-top-offset);
  padding-bottom: var(--content-bottom-offset);
  padding-left: var(--safe-left);
  padding-right: var(--safe-right);
}
```

## Main Content

Der Hauptinhalt passt sich automatisch an:

```css
main {
  min-height: calc(
    100vh - var(--content-top-offset) - var(--content-bottom-offset)
  );
}
```

## Sections

Sections nutzen die gleichen Variablen:

```css
.section {
  min-height: calc(
    100vh - var(--content-top-offset) - var(--content-bottom-offset)
  );
  height: calc(
    100vh - var(--content-top-offset) - var(--content-bottom-offset)
  );
}
```

## Menü-Positionierung

Das Menü berücksichtigt Safe-Areas:

```css
.site-header {
  position: fixed;
  top: calc(12px + var(--safe-top));
  width: calc(100% - 32px - var(--safe-left) - var(--safe-right));
}

/* Mobile */
@media (width <= 900px) {
  .site-header {
    top: calc(8px + var(--safe-top));
    width: calc(100% - 16px - var(--safe-left) - var(--safe-right));
  }
}
```

## Footer-Positionierung

Der Footer berücksichtigt Safe-Areas:

```css
.site-footer {
  position: fixed;
  bottom: calc(12px + var(--safe-bottom));
  width: calc(100% - 32px - var(--safe-left) - var(--safe-right));
}

/* Mobile */
@media (width <= 900px) {
  .site-footer {
    bottom: calc(8px + var(--safe-bottom));
    width: calc(100% - 16px - var(--safe-left) - var(--safe-right));
  }
}
```

## Container System

Container nutzen Safe-Areas für horizontales Padding:

```css
.container {
  padding-inline: max(clamp(0.5rem, 4vw, 1.5rem), var(--safe-left));
}
```

## Vorteile

1. **Automatische Anpassung**: Inhalt passt sich automatisch an Menü- und Footer-Höhe an
2. **Geräte-Kompatibilität**: Unterstützt Notches, abgerundete Ecken und Home-Indikatoren
3. **Responsive**: Funktioniert auf allen Bildschirmgrößen
4. **Zentrale Verwaltung**: Alle Werte werden über CSS-Variablen gesteuert
5. **Konsistenz**: Gleiche Implementierung auf allen Seiten

## Verwendung auf neuen Seiten

Um Safe-Areas auf neuen Seiten zu nutzen:

1. Importiere die globalen Styles:

   ```html
   <link rel="stylesheet" href="/content/styles/root.css" />
   <link rel="stylesheet" href="/content/styles/main.css" />
   ```

2. Verwende die Standard-HTML-Struktur:

   ```html
   <body>
     <main id="main-content">
       <section class="section">
         <!-- Inhalt -->
       </section>
     </main>
   </body>
   ```

3. Die Safe-Areas werden automatisch angewendet!

## Browser-Unterstützung

- **env()**: Alle modernen Browser (Safari 11.1+, Chrome 69+, Firefox 65+)
- **CSS Custom Properties**: Alle modernen Browser
- **Fallback**: Wenn `env()` nicht unterstützt wird, wird `0` verwendet

## Wartung

Bei Änderungen der Menü- oder Footer-Höhe:

1. Aktualisiere `--menu-height` und `--footer-height` in `root.css`
2. Aktualisiere die Mobile-Werte im entsprechenden Media Query
3. Teste auf allen Geräten
