import React from 'https://esm.sh/react@18.2.0?dev=false';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client?dev=false';
import htm from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.module.js';
// import { createLogger } from '/content/utils/shared-utilities.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@5.1.1/lib/marked.esm.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@2.4.0/dist/purify.es.js';

marked.setOptions({ mangle: false, headerIds: false });

// const _log = createLogger('BlogApp');
const html = htm.bind(React.createElement);

// --- Icons ---
const Icons = {
  Clock: () =>
    html`<svg
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
    </svg>`,
  ArrowRight: () =>
    html`<svg
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
    </svg>`,
  Search: () =>
    html`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>`,
  ArrowUp: () =>
    html`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="19" x2="12" y2="5"></line>
      <polyline points="5 12 12 5 19 12"></polyline>
    </svg>`,
  Share: () =>
    html`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3"></circle>
      <circle cx="6" cy="12" r="3"></circle>
      <circle cx="18" cy="19" r="3"></circle>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
    </svg>`,
  Check: () =>
    html`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`,
  List: () =>
    html`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>`,
};

// --- Utilities ---
const estimateReadTime = (text = '') =>
  `${Math.max(1, Math.round(text.split(/\s+/).length / 200))} min`;

const CATEGORY_OVERRIDES = {
  'threejs-performance': 'Performance',
  'react-no-build': 'Webdesign',
  'modern-ui-design': 'Webdesign',
  'visual-storytelling': 'Online-Marketing',
};

function normalizePost(raw = {}) {
  const id = raw.id || raw.slug;
  if (!id) return null;
  // Ensure we get the specific category, defaulting to 'Artikel' only if no match found
  const category = CATEGORY_OVERRIDES[id] || raw.category || 'Artikel';

  return {
    ...raw,
    id,
    category,
    dateDisplay: raw.dateDisplay || raw.date || '',
    readTime: raw.readTime || estimateReadTime(raw.content || raw.html || ''),
  };
}

// Fetch Logic
async function loadPostsData(seedPosts = []) {
  try {
    const res = await fetch('/pages/blog/blog-index.json');
    if (!res.ok) throw new Error('No blog index');
    const indexData = await res.json();
    return indexData.map(normalizePost);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Fallback to seed data', e);
    return seedPosts;
  }
}

async function fetchPostContent(id) {
  try {
    const res = await fetch(`/pages/blog/${id}/index.html`);
    if (res.ok) return parseArticleHtml(await res.text(), id);
  } catch {
    return null;
  }
  return null;
}

function parseArticleHtml(htmlText, id) {
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
}

// --- Components ---

function ScrollToTop() {
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
      <${Icons.ArrowUp} />
    </button>
  `;
}

function ReadingProgress() {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const onScroll = () => {
      const h = document.body.scrollHeight - window.innerHeight;
      if (h > 0) setWidth((window.scrollY / h) * 100);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return html`<div class="reading-progress-container">
    <div class="reading-progress-bar" style=${{ width: width + '%' }}></div>
  </div>`;
}

function ShareButton({ title, text, url }) {
  const [copied, setCopied] = React.useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (e) {
        console.warn('Share aborted', e);
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Clipboard failed', err);
      }
    }
  };

  return html`
    <button class="btn-share" onClick=${handleShare} title="Teilen">
      ${copied ? html`<${Icons.Check} />` : html`<${Icons.Share} />`}
      ${copied ? ' Kopiert!' : ' Teilen'}
    </button>
  `;
}

function TableOfContents({ htmlContent }) {
  const [toc, setToc] = React.useState([]);

  React.useEffect(() => {
    if (!htmlContent) return;
    const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
    const headers = Array.from(doc.querySelectorAll('h2, h3'));

    const items = headers.map((h, _i) => {
      // Ensure ID exists
      if (!h.id) {
        const id = h.textContent
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        h.id = id;
      }
      return { id: h.id, text: h.textContent, level: h.tagName.toLowerCase() };
    });
    setToc(items);
  }, [htmlContent]);

  if (toc.length === 0) return null;

  return html`
    <nav class="article-toc">
      <h3 class="toc-title"><${Icons.List} /> Inhalt</h3>
      <ul>
        ${toc.map(
          (item) => html`
            <li class="toc-item-${item.level}">
              <a
                href="#${item.id}"
                onClick=${(e) => {
                  e.preventDefault();
                  document
                    .getElementById(item.id)
                    ?.scrollIntoView({ behavior: 'smooth' });
                  // Update URL hash without scroll jump
                  history.pushState(null, null, '#' + item.id);
                }}
                >${item.text}</a
              >
            </li>
          `,
        )}
      </ul>
    </nav>
  `;
}

function RelatedPosts({ currentPost, allPosts, onNavigate }) {
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
            <article class="blog-card" onClick=${() => onNavigate(post.id)}>
              <h4 class="card-title" style=${{ fontSize: '1.1rem' }}>
                ${post.title}
              </h4>
              <p
                class="card-excerpt"
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
}

// Main App
function BlogApp() {
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('All');
  const [search, setSearch] = React.useState('');
  const [currentPostId, setCurrentPostId] = React.useState(null);
  const [currentPostContent, setCurrentPostContent] = React.useState(null);
  const [ogMeta, setOgMeta] = React.useState(null);

  React.useEffect(() => {
    // Initial data load
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

    // Handle initial route
    handlePopState();

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handlePopState = () => {
    const path = window.location.pathname;
    // Check if we are at /blog/ID/
    const match = path.match(/^\/blog\/([^/]+)\/?$/);
    if (match) {
      const id = match[1];
      if (id !== 'index.html') {
        setCurrentPostId(id);
        window.scrollTo(0, 0);
        return;
      }
    }
    // Fallback to list
    setCurrentPostId(null);
  };

  const navigateToPost = (id) => {
    history.pushState(null, '', `/blog/${id}/`);
    setCurrentPostId(id);
    window.scrollTo(0, 0);
  };

  const navigateToList = () => {
    history.pushState(null, '', '/blog/');
    setCurrentPostId(null);
  };

  // Fetch full content when currentPostId changes
  React.useEffect(() => {
    if (!currentPostId) {
      setCurrentPostContent(null);
      return;
    }

    const cached = posts.find((p) => p.id === currentPostId);
    if (cached && cached.html) {
      setCurrentPostContent(cached);
      return;
    }

    setLoading(true);
    fetchPostContent(currentPostId).then((fullPost) => {
      if (fullPost) {
        setCurrentPostContent(fullPost);
        // Merge into posts state to cache it
        setPosts((prev) =>
          prev.map((p) => (p.id === fullPost.id ? { ...p, ...fullPost } : p)),
        );
      }
      setLoading(false);
    });
  }, [currentPostId]);

  const categories = React.useMemo(
    () => ['All', ...new Set(posts.map((p) => p.category).filter(Boolean))],
    [posts],
  );
  const visiblePosts = posts.filter((p) => {
    const matchCat = filter === 'All' || p.category === filter;
    const matchSearch =
      !search || p.title.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const getOg = (id) => (ogMeta ? ogMeta[id] : null);

  // --- Views ---

  if (currentPostId) {
    const post =
      currentPostContent || posts.find((p) => p.id === currentPostId);

    if (!post && !loading)
      return html`
        <div class="container-blog pt-24 fade-in">
          <p>Artikel nicht gefunden.</p>
          <button class="btn-back" onClick=${navigateToList}>← Zurück</button>
        </div>
      `;

    if (!post || loading)
      return html`
        <div class="container-blog pt-24 fade-in">
          <button class="btn-back" onClick=${navigateToList}>← Zurück</button>
          <div class="skeleton-loader" style="margin-top:2rem">
            <div
              style="height:40px; background:#222; margin-bottom:1rem; border-radius:4px; width:60%"
            ></div>
            <div style="height:200px; background:#222; border-radius:8px"></div>
          </div>
        </div>
      `;

    const cleanHtml = DOMPurify.sanitize(
      post.html || (post.content ? marked.parse(post.content) : ''),
    );
    const og = getOg(post.id);
    const heroSrc = post.image || (og ? og.fallback || og.url : null);
    const postUrl = `https://www.abdulkerimsesli.de/blog/${post.id}/`;

    return html`
      <${React.Fragment}>
        <${ReadingProgress} />
        <${ScrollToTop} />
        
        <div class="container-blog pt-24 fade-in">
          <div class="blog-post-nav">
             <button class="btn-back" onClick=${navigateToList}>← Übersicht</button>
             <${ShareButton} title=${post.title} text=${
      post.excerpt
    } url=${postUrl} />
          </div>
          
          <article class="blog-article">
            <header>
              <div class="card-meta">
                <span class="card-category">${post.category}</span>
                <span class="card-read-time"><${Icons.Clock}/> ${
      post.readTime
    }</span>
              </div>
              <h1>${post.title}</h1>
              <div class="meta">${post.dateDisplay}</div>
            </header>

            ${
              heroSrc &&
              html`
                <figure class="article-hero">
                  <img
                    src="${heroSrc}"
                    alt="${post.title}"
                    class="article-hero-img"
                  />
                </figure>
              `
            }
            
            <div class="article-content-wrapper">
                <${TableOfContents} htmlContent=${cleanHtml} />
                <div class="article-body" dangerouslySetInnerHTML=${{
                  __html: cleanHtml,
                }}></div>
            </div>

            <${RelatedPosts} currentPost=${post} allPosts=${posts} onNavigate=${navigateToPost} />

            <div class="article-cta">
              <h3>Unterstützung bei deinem Projekt?</h3>
              <p style=${{
                color: '#ccc',
                marginBottom: '1.5rem',
                maxWidth: '600px',
                margin: '0 auto 1.5rem',
              }}>
                Benötigst du Hilfe bei Webdesign, Performance-Optimierung oder SEO? Lass uns unverbindlich darüber sprechen.
              </p>
              <a href="/#contact" class="btn-primary">Jetzt Kontakt aufnehmen</a>
            </div>
          </article>
        </div>
      </${React.Fragment}>
    `;
  }

  // List View
  return html`
    <div class="container-blog fade-in" style=${{ paddingTop: '6rem' }}>
      <${ScrollToTop} />

      <!-- Static Header -->
      <header style=${{ marginBottom: '2rem' }}>
        <h1 class="blog-headline">Wissen & Einblicke</h1>
        <p class="blog-subline">
          In unserem Blog teilen wir praxisnahe Tipps zu Webdesign, SEO,
          Performance und Online-Marketing – verständlich erklärt und direkt
          umsetzbar.
        </p>
      </header>

      <!-- Sticky Controls: Optimized Top Position -->
      <div
        class="blog-sticky-header"
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
        <div class="blog-header-content">
          <div class="blog-controls">
            <div class="search-wrapper">
              <span class="search-icon"><${Icons.Search} /></span>
              <input
                type="text"
                class="search-input"
                placeholder="Suchen..."
                value=${search}
                onInput=${(e) => setSearch(e.target.value)}
              />
            </div>
            <div class="filter-bar">
              ${categories.map(
                (cat) => html`
                  <button
                    class="filter-btn ${filter === cat ? 'active' : ''}"
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

      <div class="blog-grid">
        ${visiblePosts.map((post) => {
          const og = getOg(post.id);
          const fallbackImg = post.image || (og ? og.fallback || og.url : null);

          return html`
            <article class="blog-card" onClick=${() => navigateToPost(post.id)}>
              ${og && og.sources && og.sources.webp
                ? html`
                    <picture>
                      <source
                        type="image/webp"
                        srcset="
                          ${og.sources.webp
                            .map((s) => `${s.url} ${s.width}w`)
                            .join(', ')}
                        "
                        sizes="(max-width: 600px) 100vw, 340px"
                      />
                      <img
                        src="${fallbackImg}"
                        alt="${post.title}"
                        class="blog-card-image"
                        loading="lazy"
                        width="${og.width || ''}"
                        height="${og.height || ''}"
                      />
                    </picture>
                  `
                : fallbackImg
                ? html`<img
                    src="${fallbackImg}"
                    alt="${post.title}"
                    class="blog-card-image"
                    loading="lazy"
                  />`
                : ''}

              <div class="card-meta">
                <span class="card-category">${post.category}</span>
                <span class="card-date">${post.dateDisplay}</span>
              </div>

              <h2 class="card-title">${post.title}</h2>
              <p class="card-excerpt">${post.excerpt}</p>

              <div class="card-footer">
                <span class="card-read-time"
                  ><${Icons.Clock} /> ${post.readTime}</span
                >
                <button class="btn-read">
                  Weiterlesen <${Icons.ArrowRight} />
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
}

const rootEl = document.getElementById('root');
if (rootEl) ReactDOM.createRoot(rootEl).render(React.createElement(BlogApp));
