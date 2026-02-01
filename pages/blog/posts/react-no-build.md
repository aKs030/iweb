---
id: react-no-build
title: React ohne Build-Tools nutzen
date: 2025-09-05
category: Webdesign
author: Abdulkerim Sesli
image: /content/assets/img/og/og-react-800.svg
excerpt: React ohne Build-Tools: Praktische Setups mit ES Modules und htm für schnelle Prototypen und kleine Projekte. Hinweise zu Performance, Limitations und Best Practices.
readTime: 5 min
---

## Wann React ohne Build-Tools sinnvoll ist

Nicht jedes Projekt benötigt eine komplexe Build-Toolchain. In diesem Artikel zeige ich, wie sich React auch ohne Webpack, Vite oder ähnliche Tools einsetzen lässt.

### Vorteile eines No-Build-Ansatzes

Dank moderner Browser-Features wie ES Modules und leichtgewichtiger Helfer wie `htm` kann React direkt im Browser genutzt werden. Das vereinfacht das Setup erheblich und ist ideal für kleinere Projekte, Prototypen oder Lernzwecke. Neben den Vorteilen bespreche ich auch die Grenzen dieses Ansatzes und zeige, wann ein klassisches Build-System dennoch sinnvoll ist.

### Beispiel-Setup

Ein einfaches Setup besteht aus: einem kleinen ES Module‑Import, `htm` für deklarative Templates und einem zentralen State-Pattern (kein komplexes globales State). Für Prototypen empfiehlt sich eine schlanke Ordnerstruktur und Tests direkt im Browser.

Dieser Ansatz eignet sich besonders für Lernprojekte, interne Tools oder statische Seiten mit interaktiven Komponenten.

#### Takeaways:

- Nutze ES Modules & `htm` für schnelle Prototypen.
- Vermeide komplexen State für No-Build-Projekte.
- Für größere Apps empfiehlt sich eine klassische Build-Toolchain.

Entwickler profitieren von kürzeren Ladezeiten im Development und einem besseren Verständnis der zugrunde liegenden Web-Technologien. Für größere Anwendungen mit komplexem State-Management oder Performance-Anforderungen bleibt ein klassisches Build-Setup jedoch weiterhin die bessere Wahl.

🔗 Passend dazu: Auch der Artikel „Modernes UI-Design: Mehr als nur Dark Mode" zeigt, wie Performance und Nutzererlebnis Hand in Hand gehen.

👉 Planen Sie ein Web- oder Softwareprojekt? Lassen Sie uns über eine performante und saubere Umsetzung sprechen.

```javascript
// Beispiel für eine React-Komponente ohne Build-Step
import { html, render, useState } from 'https://unpkg.com/htm/react';

function Counter() {
  const [count, setCount] = useState(0);
  return html`
    <button onClick=${() => setCount(count + 1)}>Klicks: ${count}</button>
  `;
}

render(html`<${Counter} />`, document.body);
```
