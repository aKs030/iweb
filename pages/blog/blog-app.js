import React from 'https://esm.sh/react@19.0.0';
import { createRoot } from 'https://esm.sh/react-dom@19.0.0/client';
import htm from 'https://esm.sh/htm@3.1.1';
import { createLogger } from '/content/core/logger.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@11.1.1/lib/marked.esm.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.es.mjs';
import { Clock, ArrowRight, ArrowUp } from '/content/components/ui/icons.js';

marked.setOptions({ mangle: false, headerIds: false });

const log = createLogger('BlogApp');
const html = htm.bind(React.createElement);

// --- Utilities ---
const estimateReadTime = (text = '') =>
  `${Math.max(1, Math.round(text.split(/\s+/).length / 200))} min`;

const CATEGORY_OVERRIDES = {
  'threejs-performance': 'Performance',
  'react-no-build': 'Webdesign',
  'modern-ui-design': 'Webdesign',
  'visual-storytelling': 'Online-Marketing',
};

const normalizePost = (raw = {}) => {
  const id = raw.id || raw.slug;
  if (!id) return null;
  // Ensure we get the specific category, defaulting to 'Artikel' only if no match found
  const category = CATEGORY_OVERRIDES[id] || raw.category || 'Artikel';
  const dateStr = raw.date || '';

  return {
    ...raw,
    id,
    category,
    timestamp: dateStr ? new Date(dateStr).getTime() : 0, // Pre-calc for sorting
    dateDisplay: raw.dateDisplay || dateStr,
    readTime: raw.readTime || estimateReadTime(raw.content || raw.html || ''),
  };
};

// Fetch Logic
const loadPostsData = async (seedPosts = []) => {
  try {
    const r = await fetch('/sitemap.xml');
    if (!r.ok) throw new Error('No sitemap');
    const xml = await r.text();
    const ids = Array.from(
      xml.matchAll(new RegExp('<loc>.*?/blog/([^/<>]+)/?.*?</loc>', 'g')),
    ).map((m) => m[1]);
    const uniqueIds = Array.from(new Set(ids));

    const fetched = await Promise.all(
      uniqueIds.map(async (id) => {
        try {
          const res = await fetch(`/pages/blog/${id}/index.html`);
          if (res.ok) return parseArticleHtml(await res.text(), id);
        } catch {
          return null;
        }
      }),
    );

    const map = new Map();
    // Seed Data Map
    seedPosts.forEach((p) => map.set(p.id, p));

    // Merge Fetched Data
    fetched.filter(Boolean).forEach((p) => {
      const existing = map.get(p.id) || {};
      // Re-normalize to ensure category overrides apply to merged data
      const merged = normalizePost({ ...existing, ...p });
      map.set(p.id, merged);
    });

    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    log.warn('Fallback to seed data', e);
    return seedPosts;
  }
};

const parseArticleHtml = (htmlText, id) => {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  const title = doc.querySelector('h1')?.textContent || id;
  const bodyEl =
    doc.querySelector('.article-body') || doc.querySelector('article');
  if (bodyEl)
    bodyEl
      .querySelectorAll('script, style, .skip-links')
      .forEach((e) => e.remove());

  const heroImg = doc.querySelector('.article-hero img')?.getAttribute('src');
  const metaImg = doc
    .querySelector('meta[property="og:image"]')
    ?.getAttribute('content');

  return normalizePost({
    id,
    title,
    date: doc.querySelector('.meta')?.textContent || '',
    image: heroImg || metaImg || null,
    excerpt:
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      '',
    html: bodyEl ? bodyEl.innerHTML : '',
    // Category will be resolved by normalizePost via CATEGORY_OVERRIDES
  });
};

// --- Components ---

// Progressive Image Component mit Blur-up Effekt
const ProgressiveImage = React.memo(function ProgressiveImage({
  src,
  alt,
  className,
  loading = 'lazy',
  fetchpriority,
  width,
  height,
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  const imgRef = React.useRef(null);

  React.useEffect(() => {
    if (!imgRef.current) return;

    // Wenn Bild bereits im Cache ist, sofort anzeigen
    if (imgRef.current.complete && imgRef.current.naturalHeight !== 0) {
      setLoaded(true);
    }
  }, [src]);

  const handleLoad = () => setLoaded(true);
  const handleError = () => setError(true);

  if (error) return null;

  return html`
    <div className="progressive-image-wrapper ${loaded ? 'loaded' : ''}">
      <img
        ref=${imgRef}
        src=${src}
        alt=${alt}
        className=${className}
        loading=${loading}
        fetchpriority=${fetchpriority}
        width=${width}
        height=${height}
        decoding="async"
        onLoad=${handleLoad}
        onError=${handleError}
      />
    </div>
  `;
});

const ScrollToTop = () => {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const toggle = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', toggle);
    return () => window.removeEventListener('scroll', toggle);
  }, []);
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return html`
    <button
      className=${`scroll-to-top-btn ${visible ? 'visible' : ''}`}
      onClick=${scrollToTop}
      aria-label="Nach oben scrollen"
    >
      <${ArrowUp} />
    </button>
  `;
};

const ReadingProgress = () => {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const onScroll = () => {
      const h = document.body.scrollHeight - window.innerHeight;
      if (h > 0) setWidth((window.scrollY / h) * 100);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return html`<div className="reading-progress-container">
    <div className="reading-progress-bar" style=${{ width: width + '%' }}></div>
  </div>`;
};

const RelatedPosts = ({ currentPost, allPosts }) => {
  const related = React.useMemo(() => {
    if (!currentPost || !allPosts.length) return [];
    return allPosts
      .filter(
        (p) => p.id !== currentPost.id && p.category === currentPost.category,
      )
      .slice(0, 2);
  }, [currentPost, allPosts]);

  if (related.length === 0) return null;

  return html`
    <div className="related-posts-section">
      <h3 className="related-posts-title">
        Das könnte dich auch interessieren
      </h3>
      <div className="blog-grid">
        ${related.map(
          (post) => html`
            <article
              key=${post.id}
              className="blog-card"
              onClick=${() => (window.location.hash = `/blog/${post.id}`)}
            >
              <h4 className="card-title" style=${{ fontSize: '1.1rem' }}>
                ${post.title}
              </h4>
              <p
                className="card-excerpt"
                style=${{ fontSize: '0.9rem', marginBottom: '0' }}
              >
                ${post.excerpt.slice(0, 80)}...
              </p>
            </article>
          `,
        )}
      </div>
    </div>
  `;
};

// Main App
const BlogApp = () => {
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('All');
  const [currentPostId, setCurrentPostId] = React.useState(null);
  const [ogMeta, setOgMeta] = React.useState(null);

  React.useEffect(() => {
    const seedEl = document.getElementById('blog-list-json');
    const seed = seedEl
      ? JSON.parse(seedEl.textContent || '[]').map(normalizePost)
      : [];
    setPosts(seed);

    loadPostsData(seed).then((final) => {
      setPosts(final);
      setLoading(false);
    });

    fetch('/content/assets/img/og/og-images-meta.json')
      .then((r) => r.json())
      .then(setOgMeta)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    const handleRoute = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/blog/')) {
        setCurrentPostId(hash.replace('#/blog/', ''));
        window.scrollTo(0, 0);
      } else {
        setCurrentPostId(null);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape' && currentPostId) window.location.hash = '#/blog/';
    };
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('keydown', handleKey);
    if (window.location.hash) handleRoute();
    return () => {
      window.removeEventListener('hashchange', handleRoute);
      window.removeEventListener('keydown', handleKey);
    };
  }, [currentPostId]);

  const categories = React.useMemo(
    () => ['All', ...new Set(posts.map((p) => p.category).filter(Boolean))],
    [posts],
  );

  const visiblePosts = React.useMemo(
    () =>
      posts.filter((p) => {
        const matchCat = filter === 'All' || p.category === filter;
        return matchCat;
      }),
    [posts, filter],
  );

  const getOg = (id) => (ogMeta ? ogMeta[id] : null);

  const activePost = React.useMemo(
    () => (currentPostId ? posts.find((p) => p.id === currentPostId) : null),
    [posts, currentPostId],
  );

  const activePostHtml = React.useMemo(
    () =>
      activePost
        ? DOMPurify.sanitize(
            activePost.html ||
              (activePost.content ? marked.parse(activePost.content) : ''),
          )
        : '',
    [activePost],
  );

  // --- Views ---

  if (currentPostId) {
    const post = activePost;

    if (!post && !loading)
      return html`
        <div className="container-blog pt-24 fade-in">
          <p>Artikel nicht gefunden.</p>
          <button
            className="btn-back"
            onClick=${() => (window.location.hash = '')}
          >
            ← Zurück
          </button>
        </div>
      `;

    if (!post)
      return html`<div className="container-blog pt-24">
        <div style="color:#666">Lade Artikel...</div>
      </div>`;

    const cleanHtml = activePostHtml;
    const og = getOg(post.id);
    const heroSrc = post.image || (og ? og.fallback || og.url : null);

    return html`
      <${React.Fragment}>
        <${ReadingProgress} />
        <${ScrollToTop} />
        
        <div className="container-blog pt-24 fade-in">
          <button className="btn-back" onClick=${() =>
            (window.location.hash = '')}>← Übersicht (ESC)</button>
          
          <article className="blog-article">
            <header>
              <div className="card-meta">
                <span className="card-category">${post.category}</span>
                <span className="card-read-time"><${Clock}/> ${
                  post.readTime
                }</span>
              </div>
              <h1>${post.title}</h1>
              <time className="meta" datetime=${post.date}>${post.dateDisplay}</time>
            </header>

            ${
              heroSrc &&
              html`
                <figure className="article-hero">
                  <${ProgressiveImage}
                    src=${heroSrc}
                    alt=${post.title}
                    className="article-hero-img"
                    loading="eager"
                    fetchpriority="high"
                    width=${og?.width || 800}
                    height=${og?.height || 420}
                  />
                </figure>
              `
            }

            <div className="article-body" dangerouslySetInnerHTML=${{
              __html: cleanHtml,
            }}></div>
            
            <${RelatedPosts} currentPost=${post} allPosts=${posts} />

            <div className="article-cta">
              <h3>Unterstützung bei deinem Projekt?</h3>
              <p style=${{
                color: '#ccc',
                marginBottom: '1.5rem',
                maxWidth: '600px',
                margin: '0 auto 1.5rem',
              }}>
                Benötigst du Hilfe bei Webdesign, Performance-Optimierung oder SEO? Lass uns unverbindlich darüber sprechen.
              </p>
              <a href="/#contact" className="btn-primary">Jetzt Kontakt aufnehmen</a>
            </div>
          </article>
        </div>
      </${React.Fragment}>
    `;
  }

  // List View
  return html`
    <div className="container-blog fade-in" style=${{ paddingTop: '6rem' }}>
      <${ScrollToTop} />

      <!-- Static Header -->
      <header style=${{ marginBottom: '2rem' }}>
        <h1 className="blog-headline">Wissen & Einblicke</h1>
        <p className="blog-subline">
          In unserem Blog teilen wir praxisnahe Tipps zu Webdesign, SEO,
          Performance und Online-Marketing – verständlich erklärt und direkt
          umsetzbar.
        </p>
      </header>

      <!-- Sticky Controls: Optimized Top Position -->
      <div
        className="blog-sticky-header"
        style=${{
          position: 'sticky',
          top: '72px' /* Matches Site Header Height + Spacing */,
          zIndex: 40,
          background: 'rgba(3, 3, 3, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--blog-border)',
          margin: '0 -2rem 2.5rem -2rem',
          padding: '1rem 2rem',
        }}
      >
        <div className="blog-header-content">
          <div className="blog-controls">
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
                `,
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="blog-grid">
        ${visiblePosts.map((post, idx) => {
          const og = getOg(post.id);
          const fallbackImg = post.image || (og ? og.fallback || og.url : null);
          // Eager loading für erste 2 Bilder (Above the Fold)
          const loadingStrategy = idx < 2 ? 'eager' : 'lazy';
          const fetchPriority = idx === 0 ? 'high' : undefined;

          return html`
            <article
              key=${post.id}
              className="blog-card"
              onClick=${() => (window.location.hash = `/blog/${post.id}`)}
            >
              ${fallbackImg
                ? html`<${ProgressiveImage}
                    src=${fallbackImg}
                    alt=${post.title}
                    className="blog-card-image"
                    loading=${loadingStrategy}
                    fetchpriority=${fetchPriority}
                    width=${og?.width || 800}
                    height=${og?.height || 420}
                  />`
                : ''}

              <div className="card-meta">
                <span className="card-category">${post.category}</span>
                <time className="card-date" datetime=${post.date}
                  >${post.dateDisplay}</time
                >
              </div>

              <h2 className="card-title">${post.title}</h2>
              <p className="card-excerpt">${post.excerpt}</p>

              <div className="card-footer">
                <span className="card-read-time"
                  ><${Clock} /> ${post.readTime}</span
                >
                <button className="btn-read">
                  Weiterlesen <${ArrowRight} />
                </button>
              </div>
            </article>
          `;
        })}
        ${visiblePosts.length === 0 && !loading
          ? html`<p style="color:#666">Keine Artikel gefunden.</p>`
          : ''}
      </div>
    </div>
  `;
};

const rootEl = document.getElementById('root');
if (rootEl) createRoot(rootEl).render(React.createElement(BlogApp));
