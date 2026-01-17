import React from 'https://esm.sh/react@18.2.0?dev=false';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client?dev=false';
import htm from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.module.js';
import { createLogger } from '/content/utils/shared-utilities.js';
import { FAVICON_512 } from '../../content/config/site-config.js';

const log = createLogger('BlogApp');
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
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
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
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
`;

function BlogApp() {
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('All');
  const [currentPostId, setCurrentPostId] = React.useState(null);
  const [ogMeta, setOgMeta] = React.useState(null);

  // Load OG Meta for responsive images
  React.useEffect(() => {
    fetch('/content/assets/img/og/og-images-meta.json')
      .then((r) => r.json())
      .then(setOgMeta)
      .catch(() => {});
  }, []);

  // Load Blog Index
  React.useEffect(() => {
    fetch('/content/blog/blog-index.json')
      .then((r) => r.json())
      .then((data) => {
        setPosts(data);
        setLoading(false);
      })
      .catch((err) => {
        log.error('Failed to load blog index', err);
        setLoading(false);
      });
  }, []);

  // Routing Logic
  React.useEffect(() => {
    const parseRoute = () => {
      // Support Clean URLs (/blog/id/) and Hash fallback (#/blog/id)
      const p = location.pathname.match(/^\/blog\/([^\/]+)\/?$/);
      const h = location.hash.match(/^#\/blog\/(.+)$/);
      const id = p ? decodeURIComponent(p[1]) : h ? decodeURIComponent(h[1]) : null;

      setCurrentPostId(id);

      // If we are on a clean URL but the app was loaded via some other means that might rely on hash, ensure sync
      // Actually, if we are at /blog/id, we are good.
      // If we are at /blog/ and use hash navigation, update URL if possible?
      // For now, we just respect the current state.
    };
    parseRoute();
    window.addEventListener('popstate', parseRoute);
    window.addEventListener('hashchange', parseRoute);
    return () => {
      window.removeEventListener('popstate', parseRoute);
      window.removeEventListener('hashchange', parseRoute);
    };
  }, []);

  // Head Management (Meta Tags & JSON-LD)
  React.useEffect(() => {
    if (!currentPostId) {
      document.title = 'Blog — Abdulkerim Sesli';
      // Cleanup logic if needed...
      return;
    }

    const post = posts.find(p => p.id === currentPostId);
    if (!post) return;

    document.title = `${post.title} — Abdulkerim Sesli`;

    // Update Meta Description
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.setAttribute('content', post.excerpt);

    // Dynamic JSON-LD injection could go here if client-side navigation happens
    // But since we generate static HTML for direct hits, this is secondary enhancement.
  }, [currentPostId, posts]);


  const categories = React.useMemo(() => {
    const set = new Set(['All']);
    posts.forEach(p => set.add(p.category));
    return Array.from(set);
  }, [posts]);

  const filteredPosts = filter === 'All' ? posts : posts.filter(p => p.category === filter);

  // Navigation Helper
  const navigateTo = (id) => {
    // Push State to URL bar without reload
    const url = `/blog/${id}/`;
    window.history.pushState(null, '', url);
    // Manually trigger local state update since pushState doesn't fire popstate
    setCurrentPostId(id);
    window.scrollTo(0, 0);
  };

  const navigateBack = () => {
    window.history.pushState(null, '', '/blog/');
    setCurrentPostId(null);
    window.scrollTo(0, 0);
  };


  if (currentPostId) {
    const post = posts.find(p => p.id === currentPostId);
    if (!post && !loading) {
      return html`
        <div class="container-blog">
          <div class="not-found">
            <h2>Beitrag nicht gefunden</h2>
            <button class="btn" onClick=${navigateBack}>Zurück zur Übersicht</button>
          </div>
        </div>
      `;
    }
    if (!post) return html`<div class="container-blog"><div class="blog-grid"><div class="skeleton-card"></div></div></div>`;

    return html`
      <div class="container-blog">
        <div class="blog-detail">
          <article class="blog-article">
            ${post.image ? html`
              <figure class="article-hero">
                <img src="${post.image}" alt="${post.title}" class="article-hero-img" />
              </figure>
            ` : null}

            <header class="article-header">
              <h1>${post.title}</h1>
              <p class="meta">${post.dateDisplay} — ${post.readTime}</p>
            </header>

            <div class="article-body" dangerouslySetInnerHTML=${{ __html: post.html }}></div>

            <div class="article-cta">
              <a class="btn btn-primary" href="/#contact">Projektanfrage</a>
            </div>

            <p><button class="btn btn-ghost" onClick=${navigateBack}>&larr; Zurück zum Blog</button></p>
          </article>
        </div>
      </div>
    `;
  }

  return html`
    <div class="container-blog">
      <div class="blog-sticky-header">
        <header>
          <h1 class="blog-headline">Wissen & Einblicke</h1>
          <p class="blog-subline">Gedanken zu Web-Entwicklung, Fotografie und digitalem Design.</p>
        </header>
        <div class="filter-bar u-row u-wrap">
          ${categories.map(cat => html`
            <button
              key=${cat}
              class="filter-btn ${filter === cat ? 'active' : ''}"
              onClick=${() => setFilter(cat)}
            >
              ${cat}
            </button>
          `)}
        </div>
      </div>

      <div class="blog-grid">
        ${loading
          ? html`<p>Lade Beiträge...</p>`
          : filteredPosts.map((post, index) => html`
            <article key=${post.id} class="blog-card u-stack">
              ${post.image ? html`
                <img
                  src="${post.image}"
                  alt="${post.title}"
                  class="blog-card-image"
                  loading="lazy"
                  decoding="async"
                />
              ` : null}

              <div class="card-footer u-row u-between">
                <span class="card-category">${post.category}</span>
                <span class="card-date">${post.dateDisplay}</span>
              </div>

              <h2 class="card-title">${post.title}</h2>
              <p class="card-excerpt">${post.excerpt}</p>

              <div class="card-footer u-row u-between">
                <span class="card-read-time u-inline-center">
                  <Clock /> ${post.readTime}
                </span>
                <button class="btn-read" onClick=${() => navigateTo(post.id)}>
                  Lesen <ArrowRight />
                </button>
              </div>
            </article>
          `)}
      </div>
    </div>
  `;
}

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(html`<${BlogApp} />`);
}
