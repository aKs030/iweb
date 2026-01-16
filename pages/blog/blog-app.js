import React from 'https://esm.sh/react@18.2.0?dev=false';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client?dev=false';
import htm from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.module.js';
import { createLogger } from '/content/utils/shared-utilities.js';
import { FAVICON_512 } from '../../content/config/site-config.js';

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
  const [filter, setFilter] = React.useState('All');
  const [currentPostId, setCurrentPostId] = React.useState(null);
  const [ogMeta, setOgMeta] = React.useState(null);

  // fetch the generated OG images metadata for responsive sources
  React.useEffect(() => {
    let mounted = true;
    fetch('/content/assets/img/og/og-images-meta.json')
      .then((r) => r.json())
      .then((j) => mounted && setOgMeta(j))
      .catch(() => {
        /* ignore */
      });
    return () => (mounted = false);
  }, []);

  // Extract unique categories
  const categories = [
    'All',
    ...new Set(blogPosts.map((post) => post.category)),
  ];

  const filteredPosts =
    filter === 'All'
      ? blogPosts
      : blogPosts.filter((post) => post.category === filter);

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
      const t = document.querySelector(
        'script[type="application/ld+json"][data-temp-article]',
      );
      if (t) t.remove();
      const meta = document.querySelector(
        'meta[name="description"][data-temp]',
      );
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
      if (
        !document.querySelector(
          'script[type="application/ld+json"][data-temp-article]',
        )
      ) {
        const ld = {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://www.abdulkerimsesli.de/blog/${post.id}`,
          },
          headline: post.title,
          description: post.excerpt,
          datePublished: new Date(post.date + 'T00:00:00Z').toISOString(),
          dateModified: new Date(post.date + 'T00:00:00Z').toISOString(),
          author: {
            '@type': 'Person',
            '@id': 'https://www.abdulkerimsesli.de/#person',
          },
          image: (function(){
            try {
              const meta = (typeof ogMeta !== 'undefined' && ogMeta && ogMeta[post.imageKey]) ? ogMeta[post.imageKey] : null;
              if (meta) {
                const w = meta.fallbackWidth || meta.originalWidth || null;
                const h = meta.originalWidth && meta.originalHeight ? Math.round((meta.originalHeight * (w || meta.originalWidth)) / meta.originalWidth) : null;
                return {
                  '@type': 'ImageObject',
                  url: meta.fallback || post.image || 'https://www.abdulkerimsesli.de/content/assets/img/og/og-home-800.webp',
                  width: w || undefined,
                  height: h || undefined,
                };
              }
            } catch (e) {
              /* ignore */
            }
            return {
              '@type': 'ImageObject',
              url: post.image || 'https://www.abdulkerimsesli.de/content/assets/img/og/og-home-800.webp'
            };
          })(),
          publisher: {
            '@type': 'Organization',
            '@id': 'https://www.abdulkerimsesli.de/#organization',
            name: 'Abdulkerim — Digital Creator Portfolio',
            logo: {
              '@type': 'ImageObject',
              url: FAVICON_512,
              contentUrl: FAVICON_512,
              creator: { '@type': 'Person', name: 'Abdulkerim Sesli' },
              license: 'https://www.abdulkerimsesli.de/#image-license',
              creditText: 'Logo: Abdulkerim Sesli',
              copyrightNotice: '© 2025 Abdulkerim Sesli',
              acquireLicensePage: 'https://www.abdulkerimsesli.de/#image-license',
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

  const renderFilterButtons = () =>
    categories.map((cat) =>
      React.createElement(
        'button',
        {
          key: cat,
          className: `filter-btn ${filter === cat ? 'active' : ''}`,
          onClick: () => setFilter(cat),
        },
        cat,
      ),
    );

  const renderBlogGrid = () =>
    filteredPosts.map((post, index) =>
      React.createElement(
        'article',
        {
          key: post.id,
          className: 'blog-card u-stack',
        },
        // Responsive picture using generated og-images-meta.json when available
        ogMeta && post.imageKey && ogMeta[post.imageKey]
          ? (() => {
              const m = ogMeta[post.imageKey];
              const webpSrc = (m.sources.webp || []).map((s) => `${s.url} ${s.width}w`).join(', ');
              const fallback = m.fallback || post.image;
              const w = m.fallbackWidth || m.originalWidth || null;
              const h = m.originalWidth && m.originalHeight ? Math.round((m.originalHeight * (w || m.originalWidth)) / m.originalWidth) : null;
              return React.createElement(
                'picture',
                null,
                webpSrc && React.createElement('source', { type: 'image/webp', srcSet: webpSrc, sizes: '(max-width:640px) 100vw, 33vw' }),
                React.createElement('img', {
                  src: fallback,
                  alt: post.title,
                  fetchpriority: index < 2 ? 'high' : 'low',
                  loading: 'lazy',
                  decoding: 'async',
                  className: 'blog-card-image',
                  width: w || undefined,
                  height: h || undefined,
                }),
              );
            })()
          : post.image
          ? React.createElement('img', {
              src: post.image,
              alt: post.title,
              fetchpriority: index < 2 ? 'high' : 'low',
              loading: 'lazy',
              decoding: 'async',
              className: 'blog-card-image',
            })
          : null,
        React.createElement(
          'div',
          { className: 'card-footer u-row u-between' },
          React.createElement('span', { className: 'card-category' }, post.category),
          React.createElement('span', { className: 'card-date' }, post.dateDisplay),
        ),
        React.createElement('h2', { className: 'card-title' }, post.title),
        React.createElement('p', { className: 'card-excerpt' }, post.excerpt),
        React.createElement(
          'div',
          { className: 'card-footer u-row u-between' },
          React.createElement(
            'span',
            { className: 'card-read-time u-inline-center' },
            React.createElement(Clock),
            post.readTime,
          ),
          React.createElement(
            'button',
            {
              className: 'btn-read',
              onClick: () => (location.hash = `#/blog/${post.id}`),
            },
            'Lesen ',
            React.createElement(ArrowRight),
          ),
        ),
      ),
    );

  return React.createElement(
    'div',
    { className: 'container-blog' },
    React.createElement(
      'header',
      null,
      React.createElement('h1', { className: 'blog-headline' }, 'Wissen & Einblicke'),
      React.createElement(
        'p',
        { className: 'blog-subline' },
        'Gedanken zu Web-Entwicklung, Fotografie und digitalem Design. Hier teile ich, was ich lerne und erschaffe.',
      ),
    ),
    React.createElement(
      'div',
      { className: 'filter-bar u-row u-wrap' },
      ...renderFilterButtons(),
    ),
    currentPostId
      ? (() => {
        const post = blogPosts.find((p) => p.id === currentPostId);
        return React.createElement(
          'div',
          { className: 'blog-detail' },
          post
            ? React.createElement(
              'article',
              { className: 'blog-article' },
              React.createElement('header', null,
                React.createElement('h1', null, post.title),
                React.createElement('p', { className: 'meta' }, `${post.dateDisplay} — ${post.readTime}`),
              ),
              React.createElement('section', { className: 'article-body', dangerouslySetInnerHTML: { __html: post.content } }),
              React.createElement(
                'p',
                null,
                React.createElement(
                  'button',
                  {
                    className: 'btn',
                    onClick: () => (location.hash = '#/blog/'),
                  },
                  'Zurück',
                ),
              ),
            )
            : React.createElement(
              'div',
              { className: 'not-found' },
              'Beitrag nicht gefunden.',
              React.createElement(
                'button',
                {
                  onClick: () => (location.hash = '#/blog/'),
                  className: 'btn',
                },
                'Zurück',
              ),
            ),
        );
      })()
      : React.createElement(
        'div',
        { className: 'blog-grid' },
        ...renderBlogGrid(),
      ),
  );
}

// Init
const rootEl = document.getElementById('root');
if (rootEl && React && ReactDOM) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(React.createElement(BlogApp));
} else {
  // Silent fail in production
  log.error('React environment not ready', { hasRootEl: !!rootEl, hasReact: !!React, hasReactDOM: !!ReactDOM });
}
