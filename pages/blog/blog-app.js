/**
 * Blog App with Progress Tracking
 * @version 4.1.0
 * @last-modified 2026-02-01
 */

// @ts-nocheck
// External CDN imports - type definitions not available
import React from 'https://esm.sh/react@19.0.0';
import { createRoot } from 'https://esm.sh/react-dom@19.0.0/client';
import htm from 'https://esm.sh/htm@3.1.1';
import { createLogger } from '/content/core/logger.js';
import { i18n } from '/content/core/i18n.js';
import { updateLoader, hideLoader } from '/content/core/global-loader.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@11.1.1/lib/marked.esm.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.es.mjs';
import { Clock, ArrowRight, ArrowUp } from '/content/components/ui/icons.js';
import hljs from 'https://esm.sh/highlight.js@11.9.0/lib/core';
import javascript from 'https://esm.sh/highlight.js@11.9.0/lib/languages/javascript';
import xml from 'https://esm.sh/highlight.js@11.9.0/lib/languages/xml';
import css from 'https://esm.sh/highlight.js@11.9.0/lib/languages/css';
import bash from 'https://esm.sh/highlight.js@11.9.0/lib/languages/bash';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('bash', bash);

// Inject Highlight.js CSS
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href =
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
document.head.appendChild(link);

// Configure Marked
const renderer = new marked.Renderer();
renderer.code = (code, language) => {
  const validLang = hljs.getLanguage(language) ? language : 'plaintext';
  return `<pre><code class="hljs language-${validLang}">${hljs.highlight(code, { language: validLang }).value}</code></pre>`;
};
renderer.heading = (text, level) => {
  const slug = text.toLowerCase().replace(/[^\w]+/g, '-');
  return `<h${level} id="${slug}">${text}</h${level}>`;
};

marked.setOptions({ renderer, mangle: false, headerIds: false });

const log = createLogger('BlogApp');
const html = htm.bind(React.createElement);

// Translation Hook
const useTranslation = () => {
  const [lang, setLang] = React.useState(i18n.currentLang);

  React.useEffect(() => {
    const onLangChange = (e) => setLang(e.detail.lang);
    i18n.addEventListener('language-changed', onLangChange);
    return () => i18n.removeEventListener('language-changed', onLangChange);
  }, []);

  return { t: (key, params) => i18n.t(key, params), lang };
};

// --- Utilities ---
const estimateReadTime = (text = '') =>
  `${Math.max(1, Math.round(text.split(/\s+/).length / 200))} min`;

const parseFrontmatter = (text) => {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { content: text, data: {} };

  const frontmatter = match[1];
  const content = text.slice(match[0].length);
  const data = {};

  frontmatter.split('\n').forEach((line) => {
    const [key, ...val] = line.split(':');
    if (key && val) {
      data[key.trim()] = val.join(':').trim();
    }
  });

  return { content, data };
};

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
    file: raw.file || null,
  };
};

// Fetch Logic with Progress Tracking
const loadPostsData = async (seedPosts = []) => {
  try {
    updateLoader(0.2, 'Lese Index...');

    // Fetch index.json
    let fetchedPosts = [];
    try {
      const indexRes = await fetch('/content/posts/index.json');
      if (indexRes.ok) {
        fetchedPosts = await indexRes.json();
        updateLoader(0.4, `${fetchedPosts.length} Artikel gefunden...`);
      } else {
        throw new Error('Index not found');
      }
    } catch (e) {
      log.warn('Could not load index.json', e);
      return seedPosts;
    }

    // Now fetch content for each post
    let loaded = 0;
    const total = fetchedPosts.length;

    const populated = await Promise.all(
      fetchedPosts.map(async (p) => {
        try {
          let postData = { ...p };

          if (p.file) {
            const res = await fetch(p.file);
            if (res.ok) {
              const text = await res.text();
              const { content, data } = parseFrontmatter(text);
              postData = { ...postData, ...data, content };
            }
          }

          loaded++;
          const progress = 0.4 + (loaded / total) * 0.4;
          updateLoader(progress, `Lade Artikel ${loaded}/${total}...`, {
            silent: true,
          });

          return normalizePost(postData);
        } catch (e) {
          log.warn(`Failed to load ${p.id}`, e);
          return null;
        }
      }),
    );

    updateLoader(0.85, 'Verarbeite Artikel...');

    const map = new Map();
    // Seed Data
    seedPosts.forEach((p) => map.set(p.id, p));
    // Merged Fetched
    populated.filter(Boolean).forEach((p) => {
      map.set(p.id, { ...(map.get(p.id) || {}), ...p });
    });

    const result = Array.from(map.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    );

    updateLoader(0.95, `${result.length} Artikel geladen`);
    return result;
  } catch (e) {
    log.warn('Fatal error loading posts', e);
    return seedPosts;
  }
};

// --- Components ---

// Progressive Image Component
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

const TableOfContents = ({ htmlContent }) => {
  const [headings, setHeadings] = React.useState([]);
  const [activeId, setActiveId] = React.useState('');

  React.useEffect(() => {
    // Simple regex to find headers since we don't want to parse HTML string fully if possible,
    // but DOMParser is safer.
    const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
    const elements = Array.from(doc.querySelectorAll('h2, h3'));

    const items = elements
      .map((el) => ({
        id: el.id,
        text: el.textContent,
        level: Number(el.tagName.substring(1)),
      }))
      .filter((h) => h.id); // Only those with IDs (generated by marked)

    setHeadings(items);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -66%' },
    );

    items.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [htmlContent]);

  if (headings.length === 0) return null;

  return html`
    <nav className="toc-nav fade-in">
      <h4 className="toc-title">Inhalt</h4>
      <ul>
        ${headings.map(
          (h) => html`
            <li
              key=${h.id}
              className=${`toc-item level-${h.level} ${activeId === h.id ? 'active' : ''}`}
            >
              <a
                href="#${h.id}"
                onClick=${(e) => {
                  e.preventDefault();
                  document
                    .getElementById(h.id)
                    ?.scrollIntoView({ behavior: 'smooth' });
                  setActiveId(h.id);
                }}
              >
                ${h.text}
              </a>
            </li>
          `,
        )}
      </ul>
    </nav>
  `;
};

const RelatedPosts = ({ currentPost, allPosts }) => {
  const { t } = useTranslation();
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
      <h3 className="related-posts-title">${t('blog.related_title')}</h3>
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
  const { t } = useTranslation();

  React.useEffect(() => {
    const seedEl = document.getElementById('blog-list-json');
    const seed = seedEl
      ? JSON.parse(seedEl.textContent || '[]').map(normalizePost)
      : [];
    setPosts(seed);

    (async () => {
      try {
        updateLoader(0.1, 'Lade Blog...');

        const [final, ogData] = await Promise.all([
          loadPostsData(seed),
          (async () => {
            updateLoader(0.15, 'Lade Metadaten...', { silent: true });
            try {
              const response = await fetch(
                '/content/assets/img/og/og-images-meta.json',
              );
              return response.ok ? response.json() : {};
            } catch {
              return {};
            }
          })(),
        ]);

        setPosts(final);
        setLoading(false);
        setOgMeta(ogData);

        setTimeout(() => {
          updateLoader(1, 'Blog bereit!');
          hideLoader(100);
        }, 100);

        log.info(`Successfully loaded ${final.length} blog posts`);
      } catch (error) {
        setLoading(false);
        updateLoader(1, 'Fehler beim Laden');
        hideLoader(500);

        if (import.meta.env?.DEV) {
          console.warn('Failed to load blog data:', error);
        }
      }
    })();
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
            { ADD_ATTR: ['id', 'class'] },
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
          <p>${t('blog.not_found')}</p>
          <button
            className="btn-back"
            onClick=${() => (window.location.hash = '')}
          >
            ← ${t('blog.back')}
          </button>
        </div>
      `;

    if (!post)
      return html`<div className="container-blog pt-24">
        <div style="color:#666">${t('common.loading')}</div>
      </div>`;

    const cleanHtml = activePostHtml;
    const og = getOg(post.id);
    const heroSrc = post.image || (og ? og.fallback || og.url : null);

    // Apply layout wrapper for TOC
    return html`
      <${React.Fragment}>
        <${ReadingProgress} />
        <${ScrollToTop} />
        
        <div className="container-blog pt-24 fade-in">
          <button className="btn-back" onClick=${() =>
            (window.location.hash = '')}>← ${t('blog.back')} (ESC)</button>
          
          <div className="blog-layout-wrapper">
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
                <h3>${t('blog.cta_title')}</h3>
                <p style=${{
                  color: '#ccc',
                  marginBottom: '1.5rem',
                  maxWidth: '600px',
                  margin: '0 auto 1.5rem',
                }}>
                    ${t('blog.cta_text')}
                </p>
                <a href="/#contact" className="btn-primary">${t('blog.cta_btn')}</a>
                </div>
            </article>

            <aside className="blog-sidebar">
                <${TableOfContents} htmlContent=${cleanHtml} />
            </aside>
          </div>
        </div>
      </${React.Fragment}>
    `;
  }

  // List View (unchanged logic)
  return html`
    <div className="container-blog fade-in" style=${{ paddingTop: '6rem' }}>
      <${ScrollToTop} />

      <header style=${{ marginBottom: '2rem' }}>
        <h1 className="blog-headline">${t('blog.headline')}</h1>
        <p className="blog-subline">${t('blog.subline')}</p>
      </header>

      <div
        className="blog-sticky-header"
        style=${{
          position: 'sticky',
          top: '72px',
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
                  ${t('blog.read_more')} <${ArrowRight} />
                </button>
              </div>
            </article>
          `;
        })}
        ${visiblePosts.length === 0 && !loading
          ? html`<p style="color:#666">${t('blog.not_found')}</p>`
          : ''}
      </div>
    </div>
  `;
};

const rootEl = document.getElementById('root');
if (rootEl) createRoot(rootEl).render(React.createElement(BlogApp));
