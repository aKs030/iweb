/**
 * Blog Content Data
 * A list of professional articles for the portfolio blog.
 */

export const blogPosts = [
  {
    id: 'threejs-performance',
    title: 'Optimierung von Three.js für das Web',
    date: '2025-12-15',
    dateDisplay: '15. Dezember 2025',
    category: 'Development',
    excerpt:
      'Praxisnahe Techniken zur Performance-Optimierung von Three.js: InstancedMesh, LOD-Strategien, Texturkompression (KTX2) und Shader-Optimierung. Mit Messmethoden (Chrome DevTools & Spector.js) und konkreter Checkliste für stabile FPS — auch auf mobilen Geräten. 👉 Kontakt für Projektunterstützung.',
    content: `## Warum Performance in Three.js entscheidend ist\n\nPerformance entscheidet darüber, ob eine 3D‑Erfahrung angenehm oder frustrierend wirkt. Dieser Leitfaden liefert direkte, umsetzbare Maßnahmen, um Three.js‑Szenen effizient und ressourcenschonend im Browser zu betreiben.\n\n## Zentrale Optimierungstechniken\n\nDazu gehören der gezielte Einsatz von InstancedMesh zur Reduktion von Draw Calls, effektives Level-of-Detail-Management (LOD) sowie die Optimierung von Geometrien und Texturen.\n\n### Shader- und Memory-Optimierung\n\nEin weiterer Schwerpunkt liegt auf Shader-Optimierung und effizientem Memory-Management, um Speicherlecks zu vermeiden und Ladezeiten zu minimieren. Besonders auf mobilen Geräten ist es entscheidend, Berechnungen sinnvoll auf die GPU auszulagern und unnötige Rechenoperationen zu vermeiden. Mit diesen Methoden lassen sich stabile 60 FPS erreichen – selbst auf Mittelklasse-Smartphones. \n\nZusätzlich ist ein sauberes Asset-Management entscheidend für langfristige Performance. Durch das Wiederverwenden von Materialien, das gezielte Entladen nicht mehr benötigter Ressourcen und den Einsatz komprimierter Texturformate wie Basis oder KTX2 lassen sich Speicherverbrauch und Ladezeiten deutlich reduzieren. Auch das Profiling mit Tools wie den Chrome DevTools oder Spector.js hilft dabei, Performance-Engpässe frühzeitig zu erkennen und gezielt zu beheben.\n\n**Takeaways:**\n- Priorisieren Sie Draw‑Call‑Reduktion (InstancedMesh / merged geometry).\n- Nutze komprimierte Texturformate (KTX2) und implementiere LOD für entfernte Szeneninhalte.

### Praktische Checkliste

- Prüfe Draw Calls mit DevTools / Spector.js und priorisiere die größten Kostenpunkte.
- Verwende Instancing oder \`mergeGeometry\` bzw. BufferGeometry‑Merges, um Draw Calls zu reduzieren.\n- Automatisieren Sie Profiling und Messläufe (DevTools, Spector.js, Lighthouse).\n\n🔗 Passend dazu: Auch der Artikel „Modernes UI-Design: Mehr als nur Dark Mode" zeigt, wie Performance und Nutzererlebnis Hand in Hand gehen.\n\n👉 Planen Sie ein Web- oder Softwareprojekt? Lassen Sie uns über eine performante und saubere Umsetzung sprechen.`,
    tags: ['three.js', 'webgl', 'performance'],
    readTime: '7 min',
    imageAlt: 'Three.js Performance - optimierte 3D Szene',
    meta: {
      description: 'Konkrete Performance‑Techniken für Three.js: Instancing, LOD, KTX2 und Profiling (Spector.js, Lighthouse).',
      keywords: 'Three.js, WebGL, Performance, Optimization'
    },
    resources: [
      { title: 'Three.js Docs', url: 'https://threejs.org/docs/' },
      { title: 'Spector.js (WebGL Profiler)', url: 'https://spector.babylonjs.com/' },
      { title: 'KTX2 Textures', url: 'https://github.com/KhronosGroup/KTX-Specification' },
      { title: 'Lighthouse (Performance Audits)', url: 'https://developers.google.com/web/tools/lighthouse' }
    ],
    related: ['modern-ui-design'],
    author: 'Abdulkerim Sesli (Abdul Berlin)',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': 'https://www.abdulkerimsesli.de/blog/threejs-performance',
      },
      author: {
        '@type': 'Person',
        name: 'Abdulkerim Sesli',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Abdulkerim Sesli',
        logo: {
          '@type': 'ImageObject',
          url: 'https://www.abdulkerimsesli.de/content/assets/img/logo/logo-512.webp',
        },
      },
      headline: 'Optimierung von Three.js für das Web',
      datePublished: '2025-12-15',
      dateModified: '2025-12-15',
      image: 'https://www.abdulkerimsesli.de/content/assets/img/og/og-threejs-800.webp',
      keywords: 'Three.js,WebGL,Performance',
    },
    imageKey: 'og-threejs',
    image:
      'https://www.abdulkerimsesli.de/content/assets/img/og/og-threejs-800.webp',
  },
  {
    id: 'visual-storytelling',
    title: 'Visuelles Storytelling in der Fotografie',
    date: '2025-11-02',
    dateDisplay: '2. November 2025',
    category: 'Photography',
    excerpt:
      'Visuelles Storytelling: Komposition, Licht und Reduktion als Mittel, um Emotionen und klare Botschaften zu transportieren. Enthält Praxisbeispiele und eine Checkliste für Bildaufbau und Marken‑Fotografie. 👉 Anfrage für Shootings & Beratung.',
    content: `## Fotografie als visuelle Sprache\n\nJedes Bild erzählt eine Geschichte – aber nur, wenn die Komposition stimmt. In diesem Artikel erläutere ich, wie visuelles Storytelling in der Fotografie bewusst eingesetzt werden kann.\n\n## Bildkomposition gezielt einsetzen\n\nAnhand von Beispielen aus der Urban Photography zeige ich, wie Leading Lines, Negative Space und die Drittel-Regel den Blick des Betrachters lenken. Darüber hinaus gehe ich auf Lichtstimmung, Farbkontraste und Bildrhythmus ein. Gute Fotografie entsteht nicht durch Technik allein, sondern durch das Verständnis für Bildaufbau und Emotion. Ziel ist es, mit jedem Foto eine klare Botschaft zu vermitteln und beim Betrachter ein Gefühl auszulösen. \n\nEin weiterer wichtiger Aspekt ist die bewusste Reduktion. Weniger Elemente im Bild schaffen mehr Fokus und verstärken die Aussage.

### Praxis & Workflow

Beim Shooting hilft eine klare Vorbereitung: Moodboards, Farbschemata und eine kurze Shotlist reduzieren Entscheidungen vor Ort. Wähle gezielt Objektive und Blenden, um den gewünschten Look zu erzielen.

**Takeaways:**
- Nutze Leading Lines und Negative Space gezielt.
- Reduktion schafft Fokus, Licht formt Stimmung.
- Entwickle ein klares Konzept vor dem Shooting.

Gerade in der Street- und Urban-Fotografie entscheidet oft der richtige Moment über die Wirkung eines Fotos. Geduld, Beobachtung und ein klares Konzept helfen dabei, aus einer Alltagsszene ein aussagekräftiges Bild zu machen.\n\n🔗 Ebenfalls interessant: Im Artikel „Optimierung von Three.js für das Web“ zeige ich, wie visuelle Qualität und technische Performance kombiniert werden können.\n\n👉 Interessiert an ausdrucksstarken Bildern mit klarer Bildsprache? Kontaktieren Sie mich für ein unverbindliches Gespräch.`,
    tags: ['photography', 'composition', 'art'],
    readTime: '5 min',
    imageAlt: 'Visuelles Storytelling - Street Photography Beispiel',
    meta: {
      description: 'Praxisleitfaden: Bildkomposition, Licht und Reduktion für starke Fotografie. Inklusive Workflow‑Tipps für Shootings und Markenbildsprache.',
      keywords: 'photography, composition, storytelling'
    },
    resources: [
      { title: 'Understanding Composition', url: 'https://www.cambridgeincolour.com/techniques/composition.htm' },
      { title: 'Negative Space Techniques', url: 'https://photographylife.com/negative-space' },
      { title: 'Shooting Street: Practical Tips', url: 'https://digital-photography-school.com/street-photography-tips/' }
    ],
    related: ['modern-ui-design'],
    author: 'Abdulkerim Sesli (Abdul Berlin)',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': 'https://www.abdulkerimsesli.de/blog/visual-storytelling',
      },
      author: {
        '@type': 'Person',
        name: 'Abdulkerim Sesli',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Abdulkerim Sesli',
        logo: {
          '@type': 'ImageObject',
          url: 'https://www.abdulkerimsesli.de/content/assets/img/logo/logo-512.webp',
        },
      },
      headline: 'Visuelles Storytelling in der Fotografie',
      datePublished: '2025-11-02',
      dateModified: '2025-11-02',
      image: 'https://www.abdulkerimsesli.de/content/assets/img/og/og-photography-800.webp',
      keywords: 'Photography,Composition,Art',
    },
    imageKey: 'og-photography',
    image:
      'https://www.abdulkerimsesli.de/content/assets/img/og/og-photography-800.webp',
  },
  {
    id: 'modern-ui-design',
    title: 'Modernes UI-Design: Mehr als nur Dark Mode',
    date: '2025-10-10',
    dateDisplay: '10. Oktober 2025',
    category: 'Design',
    excerpt:
      'Modernes UI-Design bedeutet mehr als visuelle Trends: Es vereint Accessibility, Mikro‑Interaktionen und konsistente Nutzerführung. Praktische Beispiele und Guidelines für barrierefreie Interfaces. 👉 Beratung & Audit erhältlich.',
    content: `## Was modernes UI-Design wirklich ausmacht\n\nModernes UI-Design geht weit über ästhetische Trends wie Dark Mode hinaus. Eine wirklich gute Benutzeroberfläche verbindet visuelle Klarheit mit funktionaler Zugänglichkeit.\n\n## Nutzerführung durch Details\n\nIn diesem Beitrag zeige ich, wie Mikro-Interaktionen, sinnvolle Animationen und klares visuelles Feedback die User Experience verbessern. Gleichzeitig spielt Barrierefreiheit eine zentrale Rolle: semantisches HTML, ausreichende Farbkontraste und eine logische Tastaturnavigation sind unverzichtbar. Wer Accessibility von Anfang an mitdenkt, schafft nicht nur inklusivere Produkte, sondern auch robustere und zukunftssichere Web-Anwendungen. \n\nNeben der visuellen Gestaltung spielt auch die Konsistenz eine große Rolle. Wiederkehrende Muster, klare Abstände und vorhersehbares Verhalten von UI-Elementen erhöhen das Vertrauen der Nutzer und reduzieren kognitive Belastung. Design-Systeme und dokumentierte Komponentenbibliotheken sind dabei ein effektives Mittel, um Qualität und Skalierbarkeit langfristig sicherzustellen.

### Umsetzung & Tools

Praktische Maßnahmen sind: Farbaudits (Kontrastprüfungen), automatisierte Accessibility‑Tests (axe) und dokumentierte Komponenten in Storybook. Kleine Mikro‑Interaktionen (Feedback, loading states) steigern die wahrgenommene Qualität ohne die Performance zu belasten.

**Takeaways:**
- Denke Accessibility früh mit (Semantik, Kontrast, Tastatur).
- Nutze Mikro-Interaktionen sparsam und sinnvoll.
- Dokumentiere Patterns in einem Design-System.\n\n🔗 Ebenfalls interessant: Im Artikel „Optimierung von Three.js für das Web“ zeige ich, wie visuelle Qualität und technische Performance kombiniert werden können.\n\n👉 Möchten Sie ein nutzerfreundliches und barrierefreies Interface gestalten lassen? Ich berate Sie gerne.`,
    tags: ['ui/ux', 'accessibility', 'design'],
    readTime: '6 min',
    imageAlt: 'Modernes UI-Design - Beispiel Interaktion',
    meta: {
      description: 'Praktische Guidelines für barrierefreies UI‑Design: Accessibility, Micro‑Interactions, Dokumentation und Testintegration.',
      keywords: 'UI, UX, accessibility, design'
    },
    resources: [
      { title: 'WCAG Overview', url: 'https://www.w3.org/WAI/standards-guidelines/wcag/' },
      { title: 'Design Systems Handbook', url: 'https://www.designbetter.co/design-systems-handbook' },
      { title: 'axe-core (Accessibility Testing)', url: 'https://www.deque.com/axe/' }
    ],
    related: ['threejs-performance'],
    author: 'Abdulkerim Sesli (Abdul Berlin)',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': 'https://www.abdulkerimsesli.de/blog/modern-ui-design',
      },
      author: {
        '@type': 'Person',
        name: 'Abdulkerim Sesli',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Abdulkerim Sesli',
        logo: {
          '@type': 'ImageObject',
          url: 'https://www.abdulkerimsesli.de/content/assets/img/logo/logo-512.webp',
        },
      },
      headline: 'Modernes UI-Design: Mehr als nur Dark Mode',
      datePublished: '2025-10-10',
      dateModified: '2025-10-10',
      image: 'https://www.abdulkerimsesli.de/content/assets/img/og/og-design-800.webp',
      keywords: 'UI/UX,Accessibility,Design',
    },
    imageKey: 'og-design',
    image:
      'https://www.abdulkerimsesli.de/content/assets/img/og/og-design-800.webp',
  },
  {
    id: 'react-no-build',
    title: 'React ohne Build-Tools nutzen',
    date: '2025-09-05',
    dateDisplay: '5. September 2025',
    category: 'Development',
    excerpt:
      'React ohne Build-Tools: Praktische Setups mit ES Modules und `htm` für schnelle Prototypen und kleine Projekte. Hinweise zu Performance, Limitations und Best Practices. 👉 Ich unterstütze beim Prototyping.',
    content: `## Wann React ohne Build-Tools sinnvoll ist\n\nNicht jedes Projekt benötigt eine komplexe Build-Toolchain. In diesem Artikel zeige ich, wie sich React auch ohne Webpack, Vite oder ähnliche Tools einsetzen lässt.\n\n## Vorteile eines No-Build-Ansatzes\n\nDank moderner Browser-Features wie ES Modules und leichtgewichtiger Helfer wie \`htm\` kann React direkt im Browser genutzt werden. Das vereinfacht das Setup erheblich und ist ideal für kleinere Projekte, Prototypen oder Lernzwecke. Neben den Vorteilen bespreche ich auch die Grenzen dieses Ansatzes und zeige, wann ein klassisches Build-System dennoch sinnvoll ist. \n\n### Beispiel-Setup

Ein einfaches Setup besteht aus: einem kleinen ES Module‑Import, \`htm\` für deklarative Templates und einem zentralen State-Pattern (kein komplexes globales State). Für Prototypen empfiehlt sich eine schlanke Ordnerstruktur und Tests direkt im Browser.

Dieser Ansatz eignet sich besonders für Lernprojekte, interne Tools oder statische Seiten mit interaktiven Komponenten.

**Takeaways:**
- Nutze ES Modules & \`htm\` für schnelle Prototypen.
- Vermeide komplexen State für No-Build-Projekte.
- Für größere Apps empfiehlt sich eine klassische Build-Toolchain.

Entwickler profitieren von kürzeren Ladezeiten im Development und einem besseren Verständnis der zugrunde liegenden Web-Technologien. Für größere Anwendungen mit komplexem State-Management oder Performance-Anforderungen bleibt ein klassisches Build-Setup jedoch weiterhin die bessere Wahl.\n\n🔗 Passend dazu: Auch der Artikel „Modernes UI-Design: Mehr als nur Dark Mode“ zeigt, wie Performance und Nutzererlebnis Hand in Hand gehen.\n\n👉 Planen Sie ein Web- oder Softwareprojekt? Lassen Sie uns über eine performante und saubere Umsetzung sprechen.`,
    tags: ['react', 'javascript', 'no-build'],
    readTime: '4 min',
    imageAlt: 'React ohne Build-Tools - Beispiel Setup',
    meta: {
      description: 'Leitfaden: React ohne Build‑Tools mit ES Modules & `htm` — schnell für Prototypen, mit Hinweisen zu Grenzen und Migration.'
      keywords: 'react, javascript, no-build, prototyping'
    },
    resources: [
      { title: 'htm (no-build JSX alternative)', url: 'https://github.com/developit/htm' },
      { title: 'ES Modules Guide (MDN)', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules' },
      { title: 'Quick prototyping with ES Modules', url: 'https://web.dev/es-modules-in-browsers/' }
    ],
    related: ['threejs-performance'],
    author: 'Abdulkerim Sesli (Abdul Berlin)',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': 'https://www.abdulkerimsesli.de/blog/react-no-build',
      },
      author: {
        '@type': 'Person',
        name: 'Abdulkerim Sesli',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Abdulkerim Sesli',
        logo: {
          '@type': 'ImageObject',
          url: 'https://www.abdulkerimsesli.de/content/assets/img/logo/logo-512.webp',
        },
      },
      headline: 'React ohne Build-Tools nutzen',
      datePublished: '2025-09-05',
      dateModified: '2025-09-05',
      image: 'https://www.abdulkerimsesli.de/content/assets/img/og/og-react-800.webp',
      keywords: 'React,JavaScript,No-Build',
    },
    imageKey: 'og-react',
    image:
      'https://www.abdulkerimsesli.de/content/assets/img/og/og-react-800.webp',
  },
];
