/* global React, ReactDOM */
import htm from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.module.js';
import { createLogger } from '../../content/utils/shared-utilities.js';

const log = createLogger('BlogApp');
import { blogPosts } from './blog-data.js';

const html = htm.bind(React.createElement);

// Icons
const Clock = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
`;

const ArrowRight = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
`;

function BlogApp() {
  const [filter, setFilter] = React.useState('All');
  const [currentPostId, setCurrentPostId] = React.useState(null);

  // Extract unique categories
  const categories = ['All', ...new Set(blogPosts.map((post) => post.category))];

  const filteredPosts =
    filter === 'All' ? blogPosts : blogPosts.filter((post) => post.category === filter);

  // Sync with hash routing (#/blog/:id)
  React.useEffect(() => {
    const parseHash = () => {
      const m = location.hash.match(/^#\/blog\/(.+)$/);
      setCurrentPostId(m ? decodeURIComponent(m[1]) : null);
    };
    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, []);

  // Update head (meta + JSON-LD) when viewing a single post
  React.useEffect(() => {
    if (!currentPostId) {
      // remove temp article JSON-LD and restore description/title if present
      const t = document.querySelector('script[type="application/ld+json"][data-temp-article]');
      if (t) t.remove();
      const meta = document.querySelector('meta[name="description"][data-temp]');
      if (meta) {
        const orig = meta.getAttribute('data-orig');
        if (orig) meta.setAttribute('content', orig);
        meta.removeAttribute('data-temp');
      }

      // FIX: Restore the central title defined in head-complete.js/PAGE_CONFIG
      document.title = 'Tech Blog & Insights | Abdulkerim Sesli';
      return;
    }

    const post = blogPosts.find((p) => p.id === currentPostId);
    if (!post) return;

    // Update meta description (temporary)
    const desc = post.excerpt || String(post.content).slice(0, 160);
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      if (!meta.getAttribute('data-orig'))
        meta.setAttribute('data-orig', meta.getAttribute('content') || '');
      meta.setAttribute('content', desc);
      meta.setAttribute('data-temp', '1');
    }
    document.title = `${post.title} — Abdulkerim Sesli`;

    // Insert Article JSON-LD (temp, dupe-safe)
    try {
      if (!document.querySelector('script[type="application/ld+json"][data-temp-article]')) {
        const ld = {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://abdulkerimsesli.de/blog/${post.id}`,
          },
          headline: post.title,
          description: post.excerpt,
          datePublished: new Date(post.date).toISOString(),
          dateModified: new Date(post.date).toISOString(),
          author: {
            '@type': 'Person',
            '@id': 'https://abdulkerimsesli.de/#person',
          },
          image: {
            '@type': 'ImageObject',
            url: post.image || 'https://abdulkerimsesli.de/content/assets/img/og/og-home.png',
          },
          publisher: {
            '@type': 'Organization',
            '@id': 'https://abdulkerimsesli.de/#organization',
            name: 'Abdulkerim — Digital Creator Portfolio',
            logo: {
              '@type': 'ImageObject',
              url: 'https://abdulkerimsesli.de/content/assets/img/icons/favicon-512.png',
              contentUrl: 'https://abdulkerimsesli.de/content/assets/img/icons/favicon-512.png',
              creator: { '@type': 'Person', name: 'Abdulkerim Sesli' },
              license: 'https://abdulkerimsesli.de/#image-license',
              creditText: 'Logo: Abdulkerim Sesli',
              copyrightNotice: '© 2025 Abdulkerim Sesli',
              acquireLicensePage: 'https://abdulkerimsesli.de/#image-license',
            },
            address: {
              '@type': 'PostalAddress',
              streetAddress: 'Sterkrader Str. 59',
              postalCode: '13507',
              addressLocality: 'Berlin',
              addressCountry: 'DE',
            },
          },
          articleBody: post.content,
        };
        const s = document.createElement('script');
        s.type = 'application/ld+json';
        s.setAttribute('data-temp-article', '1');
        s.textContent = JSON.stringify(ld);
        document.head.appendChild(s);
      }
    } catch (e) {
      log.warn('Could not insert Article JSON-LD', e);
    }
  }, [currentPostId]);

  return html`
    <div className="container-blog">
      <!-- Header Section -->
      <header>
        <h1 className="blog-headline">Wissen & Einblicke</h1>
        <p className="blog-subline">
          Gedanken zu Web-Entwicklung, Fotografie und digitalem Design. Hier teile ich, was ich
          lerne und erschaffe.
        </p>
      </header>

      <!-- Filter -->
      <div className="filter-bar">
        ${categories.map(
          (cat) => html`
            <button
              key=${cat}
              className=${`filter-btn ${filter === cat ? 'active' : ''}`}
              onClick=${() => setFilter(cat)}
            >
              ${cat}
            </button>
          `
        )}
      </div>

      <!-- Grid or Detail -->
      ${currentPostId
        ? html`
            <div className="blog-detail">
              ${(() => {
                const post = blogPosts.find((p) => p.id === currentPostId);
                if (!post)
                  return html`
                    <div class="not-found">
                      Beitrag nicht gefunden.
                      <button onClick=${() => (location.hash = '#/blog/')} className="btn">
                        Zurück
                      </button>
                    </div>
                  `;
                return html`
                  <article className="blog-article">
                    <header>
                      <h1>${post.title}</h1>
                      <p className="meta">${post.date} — ${post.readTime}</p>
                    </header>
                    <section className="article-body">${post.content}</section>
                    <p>
                      <button className="btn" onClick=${() => (location.hash = '#/blog/')}>
                        Zurück
                      </button>
                    </p>
                  </article>
                `;
              })()}
            </div>
          `
        : html`
            <div className="blog-grid">
              ${filteredPosts.map(
                (post) => html`
                  <article key=${post.id} className="blog-card">
                    <div className="card-footer">
                      <span className="card-category">${post.category}</span>
                      <span className="card-date">${post.date}</span>
                    </div>

                    <h2 className="card-title">${post.title}</h2>
                    <p className="card-excerpt">${post.excerpt}</p>

                    <div className="card-footer">
                      <span className="card-read-time">
                        <${Clock} />
                        ${post.readTime}
                      </span>
                      <button
                        className="btn-read"
                        onClick=${() => (location.hash = `#/blog/${post.id}`)}
                      >
                        Lesen
                        <${ArrowRight} />
                      </button>
                    </div>
                  </article>
                `
              )}
            </div>
          `}
    </div>
  `;
}

// Init
const rootEl = document.getElementById('root');
if (rootEl && window.ReactDOM && window.React) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(html` <${BlogApp} /> `);
} else {
  // Silent fail in production
  log.error('React environment not ready');
}
