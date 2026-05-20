# Head

Frueher Browser-Bootstrap fuer Metadaten, Core-Assets, Analytics und den Footer/Menu-Shell-Start.

## Public API

- `index.js`: einziger oeffentlicher Einstieg; startet `head-inline.js`.

```html
<script type="module" src="/content/components/head/index.js"></script>
```

## Intern

- `head-inline.js`: Runtime-Bootstrap und fruehe Seiteneffekte.
- `head-manager.js`: spaetere SEO-/Schema-/Head-Anreicherung.
- `bootstrap/`: Analytics- und Core-Asset-Gruppen.
- `state/`: Head-spezifischer Initialisierungszustand.

## Migration

- Neue externe Imports sollten direkt aus dem jeweiligen internen Modul kommen, wenn wirklich benoetigt.
- Interne Head-Module importieren sich relativ.
- Alte Root-Shims wie `head-state.js` bleiben nicht dauerhaft bestehen.
