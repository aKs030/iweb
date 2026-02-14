/**
 * Content Indexierung für Cloudflare AI Search
 * Lädt alle Website-Inhalte in den Vectorize Index
 */

const WORKER_URL =
  'https://ai-search-proxy.httpsgithubcomaks030website.workers.dev';

const PAGES = [
  // Hauptseiten
  {
    url: '/',
    title: 'Startseite - Abdulkerim Sesli Portfolio',
    description:
      'Portfolio von Abdulkerim Sesli - Web Developer & Photographer aus Berlin. Spezialisiert auf React, Three.js und Urban Photography.',
    category: 'Home',
    rag_id: 'suche',
  },
  {
    url: '/projekte',
    title: 'Projekte - Webentwicklung Portfolio',
    description:
      'Entdecken Sie meine Webentwicklungsprojekte mit React, Three.js, Cloudflare AI und modernen Web-Technologien. Professionelle Coding-Arbeiten und innovative Lösungen.',
    category: 'Projekte',
    rag_id: 'suche',
  },
  {
    url: '/blog',
    title: 'Blog - Technische Artikel',
    description:
      'Technische Artikel über Webentwicklung, Performance-Optimierung, React, Three.js, Progressive Web Apps und moderne Design-Patterns.',
    category: 'Blog',
    rag_id: 'suche',
  },
  {
    url: '/gallery',
    title: 'Fotogalerie - Urban Photography',
    description:
      'Urban Photography und visuelles Storytelling aus Berlin. Professionelle Fotografie mit Fokus auf Architektur, Straßenfotografie und urbane Landschaften.',
    category: 'Galerie',
    rag_id: 'suche',
  },
  {
    url: '/videos',
    title: 'Videos - Motion Design Portfolio',
    description:
      'Motion Design, Video-Produktionen und Animationen. After Effects, Logo-Animationen und kreative Video-Experimente.',
    category: 'Videos',
    rag_id: 'suche',
  },
  {
    url: '/about',
    title: 'Über mich - Abdulkerim Sesli',
    description:
      'Web Developer, Photographer und Digital Creator aus Berlin. Erfahren Sie mehr über meinen Werdegang, Skills und kontaktieren Sie mich für Projekte.',
    category: 'About',
    rag_id: 'suche',
  },

  // Blog Posts
  {
    url: '/blog/react-no-build',
    title: 'React ohne Build-Tools nutzen',
    description:
      'Wie man React direkt im Browser ohne komplexe Build-Tools verwendet. ESM Imports, CDN-Integration und moderne Entwicklung ohne Webpack oder Vite.',
    category: 'Blog',
    rag_id: 'suche',
  },
  {
    url: '/blog/modern-ui-design',
    title: 'Modernes UI-Design: Mehr als nur Dark Mode',
    description:
      'Moderne UI/UX Design-Prinzipien, Accessibility, responsive Design und Best Practices für zeitgemäße Benutzeroberflächen.',
    category: 'Blog',
    rag_id: 'suche',
  },
  {
    url: '/blog/visual-storytelling',
    title: 'Visuelles Storytelling in der Fotografie',
    description:
      'Techniken für visuelles Storytelling, Komposition, Licht und Bildsprache in der Urban Photography und Straßenfotografie.',
    category: 'Blog',
    rag_id: 'suche',
  },
  {
    url: '/blog/threejs-performance',
    title: 'Optimierung von Three.js für das Web',
    description:
      'Performance-Optimierung für Three.js Anwendungen: Code-Splitting, Lazy Loading, Geometrie-Optimierung und Best Practices für 3D im Browser.',
    category: 'Blog',
    rag_id: 'suche',
  },
  {
    url: '/blog/seo-technische-optimierung',
    title: 'Technische SEO: Core Web Vitals',
    description:
      'Core Web Vitals optimieren: LCP, FID, CLS verbessern. Technische SEO-Strategien für bessere Rankings und User Experience.',
    category: 'Blog',
    rag_id: 'suche',
  },
  {
    url: '/blog/progressive-web-apps-2026',
    title: 'Progressive Web Apps 2026',
    description:
      'Moderne PWA-Entwicklung: Service Worker, Offline-Support, App-Installation und native Features im Browser.',
    category: 'Blog',
    rag_id: 'suche',
  },
  {
    url: '/blog/web-components-zukunft',
    title: 'Web Components: Die Zukunft',
    description:
      'Web Components ohne Framework: Custom Elements, Shadow DOM, Templates und wiederverwendbare Komponenten mit Vanilla JavaScript.',
    category: 'Blog',
    rag_id: 'suche',
  },
  {
    url: '/blog/css-container-queries',
    title: 'CSS Container Queries',
    description:
      'Container Queries für responsive Design: Komponenten-basierte Layouts, moderne CSS-Features und praktische Anwendungsfälle.',
    category: 'Blog',
    rag_id: 'suche',
  },
  {
    url: '/blog/javascript-performance-patterns',
    title: 'JavaScript Performance Patterns',
    description:
      'Performance-Patterns in JavaScript: Debouncing, Throttling, Memoization, Lazy Loading und Optimierungstechniken.',
    category: 'Blog',
    rag_id: 'suche',
  },
  {
    url: '/blog/typescript-advanced-patterns',
    title: 'TypeScript Advanced Patterns',
    description:
      'Fortgeschrittene TypeScript-Patterns: Generics, Conditional Types, Mapped Types und Type Guards für typsichere Anwendungen.',
    category: 'Blog',
    rag_id: 'suche',
  },

  // Videos
  {
    url: '/videos/tImMPQKiQVk',
    title: 'Logo Animation (Software Style)',
    description:
      'Professionelle Logo-Animation im Software-Stil. Motion Design mit After Effects für moderne Markenidentität.',
    category: 'Video',
    rag_id: 'suche',
  },
  {
    url: '/videos/z8W9UJbUSo4',
    title: 'Lunar Surface — Astrophotography',
    description:
      'Astrophotografie der Mondoberfläche. Detailaufnahmen und Bildbearbeitung für astronomische Fotografie.',
    category: 'Video',
    rag_id: 'suche',
  },
  {
    url: '/videos/clbOHUT4w5o',
    title: 'Future Bot Animation',
    description:
      'Futuristische Bot-Animation mit Neon-Effekten. Motion Graphics und 3D-Animation für moderne Designs.',
    category: 'Video',
    rag_id: 'suche',
  },
  {
    url: '/videos/UorHOTKWtK4',
    title: 'Neon Robot Animation',
    description:
      'Neon-Roboter-Animation mit leuchtenden Effekten. Kreative Motion Design Experimente.',
    category: 'Video',
    rag_id: 'suche',
  },
  {
    url: '/videos/1bL8bZd6cpY',
    title: 'Motion Design: Neon Bot Experiment',
    description:
      'Experimentelles Motion Design mit Neon-Bot. After Effects Animation und visuelle Effekte.',
    category: 'Video',
    rag_id: 'suche',
  },
  {
    url: '/videos/lpictttLoEk',
    title: 'Motion Graphics Test | After Effects',
    description:
      'Motion Graphics Test mit After Effects. Experimentelle Animationen und visuelle Effekte.',
    category: 'Video',
    rag_id: 'suche',
  },
  {
    url: '/videos/rXMLVt9vhxQ',
    title: 'Logo Animation Test 1',
    description:
      'Logo-Animations-Test mit verschiedenen Effekten. Motion Design Experimente für Branding.',
    category: 'Video',
    rag_id: 'suche',
  },
];

async function indexPage(page) {
  try {
    // 1. Generate embedding
    const embeddingRes = await fetch(`${WORKER_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `${page.title} ${page.description}` }),
    });

    if (!embeddingRes.ok) {
      throw new Error(`Embedding failed: ${embeddingRes.status}`);
    }

    const { embedding } = await embeddingRes.json();

    // 2. Insert into Vectorize
    const insertRes = await fetch(`${WORKER_URL}/api/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: page.url,
        values: embedding,
        metadata: page,
      }),
    });

    if (!insertRes.ok) {
      throw new Error(`Insert failed: ${insertRes.status}`);
    }

    console.log(`✅ ${page.url} - ${page.title}`);
  } catch (error) {
    console.error(`❌ ${page.url} - ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starte Content-Indexierung...\n');
  console.log(`Worker URL: ${WORKER_URL}`);
  console.log(`Anzahl Seiten: ${PAGES.length}\n`);

  for (const page of PAGES) {
    await indexPage(page);
    // Kleine Pause zwischen Requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log('\n✨ Indexierung abgeschlossen!');
  console.log('\nTeste die Suche:');
  console.log(
    `curl -X POST ${WORKER_URL}/api/search -H "Content-Type: application/json" -d '{"query": "projekte", "topK": 5}'`,
  );
}

main().catch(console.error);
