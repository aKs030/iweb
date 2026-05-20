# Contact

React-basiertes Kontaktformular fuer `/contact/`.

## Public API

- `index.js`: Browser-Einstieg; mountet das Formular in `#main-content`.
- Export: `ContactForm` fuer Tests oder gezielte Wiederverwendung.

```html
<script type="module" src="/content/components/contact/index.js"></script>
```

## Intern

- `contact-app.js`: Mounting-Code.
- `contact-component.js`: Formular-Komponente und Submit-Flow.
- `contact.css`: feature-naher Style.

## Migration

- Seiten laden nur `index.js`.
- Formularlogik bleibt im Feature und wandert nicht nach `content/core`.
