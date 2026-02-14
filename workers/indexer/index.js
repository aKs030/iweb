/**
 * Content Indexer Worker
 * Crawls website and indexes content into Vectorize
 */

// Content to index - manually curated for best results
const PAGES_TO_INDEX = [
  {
    url: '/',
    title: 'Abdulkerim Sesli - Digital Creator & Web Developer',
    category: 'Home',
    description:
      'Portfolio von Abdulkerim Sesli. Webentwickler, Fotograf und Digital Creator aus Berlin.',
    keywords:
      'portfolio webentwickler developer berlin javascript typescript react threejs fotografie',
  },
  {
    url: '/projekte',
    title: 'Projekte - Webentwicklung & Coding',
    category: 'Projekte',
    description:
      'Übersicht meiner Webentwicklungsprojekte. Von interaktiven 3D-Visualisierungen bis zu modernen Web-Apps.',
    keywords:
      'projekte webentwicklung javascript typescript react threejs web components pwa',
  },
  {
    url: '/blog',
    title: 'Blog - Technische Artikel',
    category: 'Blog',
    description:
      'Technische Artikel über Webentwicklung, Performance, Design und moderne Web-Technologien.',
    keywords: 'blog artikel webentwicklung javascript performance seo css',
  },
  {
    url: '/blog/threejs-performance',
    title: 'Three.js Performance Optimierung',
    category: 'Blog',
    description:
      'Wie man Three.js Anwendungen für das Web optimiert. Tipps zu Performance, Bundle Size und Rendering.',
    keywords:
      'threejs three.js performance optimierung webgl 3d rendering bundle',
  },
  {
    url: '/blog/visual-storytelling',
    title: 'Visuelles Storytelling in der Fotografie',
    category: 'Blog',
    description:
      'Techniken und Ansätze für visuelles Storytelling in der Urban Photography.',
    keywords: 'fotografie storytelling urban photography komposition berlin',
  },
  {
    url: '/blog/react-no-build',
    title: 'React ohne Build-Tools nutzen',
    category: 'Blog',
    description:
      'Wie man React direkt im Browser ohne komplexe Build-Tools verwenden kann.',
    keywords: 'react javascript es modules build tools vite webpack',
  },
  {
    url: '/blog/modern-ui-design',
    title: 'Modernes UI-Design: Mehr als nur Dark Mode',
    category: 'Blog',
    description:
      'Moderne UI-Design Prinzipien, Accessibility und User Experience.',
    keywords: 'ui design ux dark mode accessibility wcag design system',
  },
  {
    url: '/gallery',
    title: 'Fotogalerie - Urban Photography',
    category: 'Galerie',
    description:
      'Urban Photography aus Berlin. Architektur, Street Photography und visuelles Storytelling.',
    keywords: 'fotografie gallery urban photography berlin architektur street',
  },
  {
    url: '/videos',
    title: 'Videos - Motion Design',
    category: 'Videos',
    description: 'Motion Design, Animationen und Video-Produktionen.',
    keywords: 'videos motion design animation after effects cinema 4d',
  },
  {
    url: '/about',
    title: 'Über mich - Abdulkerim Sesli',
    category: 'About',
    description:
      'Webentwickler und Digital Creator aus Berlin. Kontakt und Informationen.',
    keywords: 'abdulkerim sesli berlin webentwickler kontakt about',
  },
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Simple authentication
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${env.INDEXER_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Clear index endpoint
    if (path === '/clear') {
      try {
        console.log('🗑️ Clearing Vectorize index...');

        // Delete old vectors by ID
        const idsToDelete = [
          'home',
          '_',
          '_projekte',
          '_blog',
          '_blog_threejs-performance',
          '_blog_visual-storytelling',
          '_blog_react-no-build',
          '_blog_modern-ui-design',
          '_gallery',
          '_videos',
          '_about',
        ];

        for (const id of idsToDelete) {
          try {
            await env.VECTOR_INDEX.deleteByIds([id]);
            console.log(`Deleted: ${id}`);
          } catch (e) {
            console.log(`Could not delete ${id}: ${e.message}`);
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Index cleared' }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    try {
      console.log('🚀 Starting content indexing...');

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const page of PAGES_TO_INDEX) {
        try {
          // Create text for embedding
          const textToEmbed = `${page.title} ${page.description} ${page.keywords}`;

          // Generate embedding using Cloudflare AI
          const embeddingResponse = await env.AI.run(
            '@cf/baai/bge-large-en-v1.5',
            {
              text: textToEmbed,
            },
          );

          const embedding = embeddingResponse.data[0];

          // Insert into Vectorize
          await env.VECTOR_INDEX.upsert([
            {
              id: page.url.replace(/\//g, '_') || 'home',
              values: embedding,
              metadata: {
                url: page.url,
                title: page.title,
                category: page.category,
                description: page.description,
              },
            },
          ]);

          console.log(`✅ Indexed: ${page.url}`);
          results.push({ url: page.url, status: 'success' });
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to index ${page.url}:`, error.message);
          results.push({
            url: page.url,
            status: 'error',
            error: error.message,
          });
          errorCount++;
        }

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log(
        `✅ Indexing complete: ${successCount} success, ${errorCount} errors`,
      );

      return new Response(
        JSON.stringify({
          success: true,
          indexed: successCount,
          errors: errorCount,
          results: results,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Indexing error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
