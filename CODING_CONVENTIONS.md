# Coding Conventions

Diese Regeln beschreiben die Zielarchitektur fuer neue und migrierte Module.

## Feature-Grenzen

- Jedes Feature hat genau einen oeffentlichen Einstieg: `index.js` im Feature-Root.
- Verbrauchercode importiert nur den Feature-Einstieg oder einen stabilen Alias wie `#menu/index.js`.
- Tiefe Pfade wie `modules/`, `state/`, `memory/`, `runtime/` und `styles/` sind intern und bleiben innerhalb des Features.
- Wenn nur ein Feature ein Modul nutzt, gehoert es in dieses Feature und nicht nach `content/core`.

## Styles

- Feature-nahe CSS-Dateien bleiben beim Feature.
- Hat ein Feature mehr als zwei CSS-Dateien, liegen sie in `styles/`.
- `content/styles` bleibt fuer globale Foundation, Utilities und wirklich seitenweite CSS-Regeln.

## Core

- `content/core` enthaelt nur echte Querschnittslogik, die von mehreren Bereichen genutzt wird.
- Keine feature-spezifischen Datenmodelle, Runtime-Orchestrierung oder speziellen UI-Module in `core`.
- Neue Core-Module brauchen mindestens zwei nachvollziehbare Verbraucher oder einen klaren Plattformzweck.

## Facades und Shims

- Stabile Facades sind erlaubt, wenn sie oeffentliche Imports kurz und robust halten.
- Re-Export-Shims sind nur temporaer: erst verschieben, dann Aufrufer migrieren, dann Shim loeschen.
- Dauerhafte Doppelstrukturen sind zu vermeiden.

## Feature-README

Jedes groessere Feature dokumentiert knapp:

- Zweck
- Oeffentliche API ueber `index.js`
- Interne Ordner
- Migrationshinweise oder temporaere Shims

Keine langen Sammeldokus im Root, wenn die Information einem Feature gehoert.
