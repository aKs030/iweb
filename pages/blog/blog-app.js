/**
 * Blog App with 3D Particle System
 * @version 5.0.0 - 3D DESIGN SYSTEM
 * @last-modified 2026-02-01
 */

// @ts-nocheck
import React from 'https://esm.sh/react@19.2.3';
import { createRoot } from 'https://esm.sh/react-dom@19.2.3/client';
import htm from 'https://esm.sh/htm@3.1.1';
import { createLogger } from '/content/core/logger.js';
import { createUseTranslation } from '/content/core/react-utils.js';
import { updateLoader, hideLoader } from '/content/core/global-loader.js';
import { i18n } from '/content/core/i18n.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@11.1.1/lib/marked.esm.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.3.1/dist/purify.es.mjs';
import { Clock, ArrowRight, ArrowUp } from '/content/components/ui/icons.js';
import { createErrorBoundary } from '/content/components/ui/ErrorBoundary.js';

const log = createLogger('BlogApp3D');
const html = htm.bind(React.createElement);
const ErrorBoundary = createErrorBoundary(React);

// Configure Marked
const renderer = new marked.Renderer();
renderer.heading = (text, level) => {
  const slug = text.toLowerCase().replace(/[^\w]+/g, '-');
  return `<h${level} id="${slug}">${text}</h${level}>`;
};
marked.setOptions({ renderer, mangle: false, headerIds: false });

// Translation Hook
const useTranslation = createUseTranslation(React);

// --- 3D Particle System ---
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: 0, y: 0 };
    this.animationId = null;
    this.resize();
    this.init();
    this.setupEvents();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  init() {
    const particleCount = window.innerWidth < 768 ? 50 : 100;
    this.particles = [];

    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        z: Math.random() * 1000,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        vz: (Math.random() - 0.5) * 2,
        size: Math.random() * 2 + 1,
        color: this.getRandomColor(),
        alpha: Math.random() * 0.5 + 0.3,
      });
    }
  }

  getRandomColor() {
    const colors = [
      'rgba(59, 130, 246, ',
      'rgba(139, 92, 246, ',
      'rgba(236, 72, 153, ',
      'rgba(16, 185, 129, ',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  setupEvents() {
    this._onMouseMove = (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    };

    this._onResize = () => {
      this.resize();
      this.init();
    };

    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('resize', this._onResize);
  }

  update() {
    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 150) {
        const force = (150 - dist) / 150;
        p.vx -= (dx / dist) * force * 0.1;
        p.vy -= (dy / dist) * force * 0.1;
      }

      if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;
      if (p.z < 0 || p.z > 1000) p.vz *= -1;

      p.vx *= 0.99;
      p.vy *= 0.99;
      p.vz *= 0.99;
    });
  }

  draw() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
    this.ctx.lineWidth = 1;

    // Grid-based spatial partitioning for O(n) neighbor lookup
    const CONNECT_DIST = 150;
    const cellSize = CONNECT_DIST;
    const grid = new Map();

    for (const p of this.particles) {
      const cx = Math.floor(p.x / cellSize);
      const cy = Math.floor(p.y / cellSize);
      const key = `${cx},${cy}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(p);
    }

    for (const [key, cell] of grid) {
      const [cx, cy] = key.split(',').map(Number);
      // Check this cell and neighboring cells
      for (let dx = 0; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy < 0) continue; // avoid duplicate checks
          const neighborKey = `${cx + dx},${cy + dy}`;
          const neighbor = grid.get(neighborKey);
          if (!neighbor) continue;

          const isSameCell = dx === 0 && dy === 0;
          for (let i = 0; i < cell.length; i++) {
            const jStart = isSameCell ? i + 1 : 0;
            for (let j = jStart; j < neighbor.length; j++) {
              const ddx = cell[i].x - neighbor[j].x;
              const ddy = cell[i].y - neighbor[j].y;
              const dist = Math.sqrt(ddx * ddx + ddy * ddy);

              if (dist < CONNECT_DIST) {
                this.ctx.beginPath();
                this.ctx.moveTo(cell[i].x, cell[i].y);
                this.ctx.lineTo(neighbor[j].x, neighbor[j].y);
                this.ctx.globalAlpha =
                  ((CONNECT_DIST - dist) / CONNECT_DIST) * 0.3;
                this.ctx.stroke();
              }
            }
          }
        }
      }
    }

    this.particles.forEach((p) => {
      const scale = 1000 / (1000 + p.z);
      const size = p.size * scale;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color + p.alpha + ')';
      this.ctx.globalAlpha = p.alpha * scale;
      this.ctx.fill();

      const gradient = this.ctx.createRadialGradient(
        p.x,
        p.y,
        0,
        p.x,
        p.y,
        size * 3,
      );
      gradient.addColorStop(0, p.color + p.alpha * 0.5 + ')');
      gradient.addColorStop(1, p.color + '0)');
      this.ctx.fillStyle = gradient;
      this.ctx.fill();
    });

    this.ctx.globalAlpha = 1;
  }

  animate() {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  start() {
    this.animate();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this._onMouseMove) {
      window.removeEventListener('mousemove', this._onMouseMove);
      this._onMouseMove = null;
    }
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this._onResize = null;
    }
  }
}

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
  const category = CATEGORY_OVERRIDES[id] || raw.category || 'Artikel';
  const dateStr = raw.date || '';

  return {
    ...raw,
    id,
    category,
    timestamp: dateStr ? new Date(dateStr).getTime() : 0,
    dateDisplay: raw.dateDisplay || dateStr,
    readTime: raw.readTime || estimateReadTime(raw.content || raw.html || ''),
    file: raw.file || null,
  };
};

// Fetch Logic
const loadPostsData = async (seedPosts = []) => {
  try {
    updateLoader(0.2, i18n.t('loader.loading_blog'));

    let fetchedPosts = [];
    try {
      const indexRes = await fetch('/pages/blog/posts/index.json');
      if (indexRes.ok) {
        fetchedPosts = await indexRes.json();
        updateLoader(
          0.4,
          i18n.t('loader.articles_found', { count: fetchedPosts.length }),
        );
      }
    } catch (e) {
      log.warn('Could not load index.json', e);
      return seedPosts;
    }

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
          updateLoader(
            progress,
            i18n.t('loader.loading_article', { current: loaded, total }),
            {
              silent: true,
            },
          );

          return normalizePost(postData);
        } catch (e) {
          log.warn(`Failed to load ${p.id}`, e);
          return null;
        }
      }),
    );

    updateLoader(0.85, i18n.t('loader.processing_articles'));

    const map = new Map();
    seedPosts.forEach((p) => map.set(p.id, p));
    populated.filter(Boolean).forEach((p) => {
      map.set(p.id, { ...(map.get(p.id) || {}), ...p });
    });

    const result = Array.from(map.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    );

    updateLoader(
      0.95,
      i18n.t('loader.articles_loaded', { count: result.length }),
    );
    return result;
  } catch (e) {
    log.warn('Fatal error loading posts', e);
    return seedPosts;
  }
};

// --- Components ---

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

// Main App
const BlogApp = () => {
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('All');
  const [currentPostId, setCurrentPostId] = React.useState(null);
  const [particleSystem, setParticleSystem] = React.useState(null);
  const { t } = useTranslation();

  // Initialize Particle System
  React.useEffect(() => {
    // Add blog-page class to body
    document.body.classList.add('blog-page');

    const canvas = document.getElementById('blog-particles-canvas');
    if (canvas && !particleSystem) {
      const ps = new ParticleSystem(canvas);
      ps.start();
      setParticleSystem(ps);

      return () => {
        ps.stop();
        document.body.classList.remove('blog-page');
      };
    }

    return () => {
      document.body.classList.remove('blog-page');
    };
  }, []);

  React.useEffect(() => {
    const seedEl = document.getElementById('blog-list-json');
    const seed = seedEl
      ? JSON.parse(seedEl.textContent || '[]').map(normalizePost)
      : [];
    setPosts(seed);

    (async () => {
      try {
        updateLoader(0.1, i18n.t('loader.init_3d_system'));

        const final = await loadPostsData(seed);

        setPosts(final);
        setLoading(false);

        setTimeout(() => {
          updateLoader(1, i18n.t('loader.blog_ready'));
          hideLoader(100);
        }, 100);

        log.info(`Successfully loaded ${final.length} blog posts`);
      } catch (error) {
        log.error('Error loading blog posts:', error);
        setLoading(false);
        updateLoader(1, i18n.t('loader.failed'));
        hideLoader(500);
      }
    })();
  }, []);

  // SEO & Routing Logic
  React.useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;

      // Handle clean URLs: /blog/post-id/
      if (path.startsWith('/blog/') && path.length > 6) {
        const id = path.replace(/\/$/, '').split('/').pop();
        if (id && id !== 'index.html') {
          setCurrentPostId(id);
          return;
        }
      }

      // Handle legacy hash URLs
      if (hash.startsWith('#/blog/')) {
        setCurrentPostId(hash.replace('#/blog/', ''));
      } else if (
        !path.startsWith('/blog/') ||
        path === '/blog/' ||
        path === '/blog/index.html'
      ) {
        setCurrentPostId(null);
      }
    };

    const handleKey = (e) => {
      if (e.key === 'Escape' && currentPostId) {
        handleBack();
      }
    };

    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);
    window.addEventListener('keydown', handleKey);

    // Initial check
    checkRoute();

    return () => {
      window.removeEventListener('popstate', checkRoute);
      window.removeEventListener('hashchange', checkRoute);
      window.removeEventListener('keydown', handleKey);
    };
  }, [currentPostId]);

  const handleBack = () => {
    window.history.pushState(null, '', '/blog/');
    setCurrentPostId(null);
    window.scrollTo(0, 0);
  };

  const handlePostClick = (e, postId) => {
    e.preventDefault();
    window.history.pushState(null, '', `/blog/${postId}/`);
    setCurrentPostId(postId);
    window.scrollTo(0, 0);
  };

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

  // Inject JSON-LD for SEO
  React.useEffect(() => {
    if (activePost) {
      document.title = `${activePost.title} — Abdulkerim Sesli`;
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: activePost.title,
        image: activePost.image
          ? [`https://www.abdulkerimsesli.de${activePost.image}`]
          : [],
        datePublished: activePost.date,
        dateModified: activePost.date,
        author: [
          {
            '@type': 'Person',
            name: 'Abdulkerim Sesli',
            url: 'https://www.abdulkerimsesli.de/',
          },
        ],
      });
      document.head.appendChild(script);
      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
        document.title = 'Blog — Abdulkerim Sesli';
      };
    }
  }, [activePost]);

  // Check if we should show filters in menu (mobile)
  const [showFiltersInMenu, setShowFiltersInMenu] = React.useState(false);

  React.useEffect(() => {
    const checkScreenSize = () => {
      setShowFiltersInMenu(window.innerWidth <= 900);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Add filters to menu when in mobile mode
  React.useEffect(() => {
    if (showFiltersInMenu) {
      const siteHeader = document.querySelector('.site-header');
      if (siteHeader) {
        // Remove existing filter container
        const existingFilters = siteHeader.querySelector('.blog-menu-filters');
        if (existingFilters) {
          existingFilters.remove();
        }

        // Create new filter container
        const filterContainer = document.createElement('div');
        filterContainer.className = 'blog-menu-filters';
        filterContainer.style.cssText = `
          display: flex;
          align-items: center;
          gap: 0.3rem;
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 10001;
          pointer-events: auto;
        `;

        // Add filter buttons
        categories.forEach((cat) => {
          const btn = document.createElement('button');
          btn.textContent = cat;
          btn.className = `filter-btn ${filter === cat ? 'active' : ''}`;
          btn.style.cssText = `
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.85);
            padding: 0.35rem 0.6rem;
            border-radius: 15px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 510;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            letter-spacing: -0.03em;
            white-space: nowrap;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: auto;
          `;

          if (filter === cat) {
            btn.style.background = 'rgba(0, 122, 255, 0.2)';
            btn.style.color = '#007aff';
            btn.style.fontWeight = '600';
          }

          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setFilter(cat);
          });

          btn.addEventListener('mouseenter', () => {
            if (filter !== cat) {
              btn.style.color = '#ffffff';
              btn.style.background = 'rgba(255, 255, 255, 0.08)';
            }
          });

          btn.addEventListener('mouseleave', () => {
            if (filter !== cat) {
              btn.style.color = 'rgba(255, 255, 255, 0.85)';
              btn.style.background = 'transparent';
            }
          });

          filterContainer.appendChild(btn);
        });

        siteHeader.appendChild(filterContainer);
      }
    } else {
      // Remove filters from menu when not in mobile mode
      const siteHeader = document.querySelector('.site-header');
      if (siteHeader) {
        const existingFilters = siteHeader.querySelector('.blog-menu-filters');
        if (existingFilters) {
          existingFilters.remove();
        }
      }
    }

    return () => {
      const siteHeader = document.querySelector('.site-header');
      if (siteHeader) {
        const existingFilters = siteHeader.querySelector('.blog-menu-filters');
        if (existingFilters) {
          existingFilters.remove();
        }
      }
    };
  }, [showFiltersInMenu, categories, filter]);

  // --- Article Detail View ---
  if (currentPostId) {
    const post = activePost;

    if (!post && !loading)
      return html`
        <div className="container-blog pt-24 fade-in">
          <p>${t('blog.not_found')}</p>
          <button className="btn-back" onClick=${handleBack}>
            ← ${t('blog.back')}
          </button>
        </div>
      `;

    if (!post)
      return html`<div className="container-blog pt-24">
        <div style="color:#666">${t('common.loading')}</div>
      </div>`;

    const cleanHtml = activePostHtml;

    return html`
      <${React.Fragment}>
        <${ReadingProgress} />
        <${ScrollToTop} />
        
        <div className="container-blog pt-24 fade-in">
          <button className="btn-back" onClick=${handleBack}>← ${t(
            'blog.back',
          )} (ESC)</button>
          
          <article className="blog-article">
            <header>
              <div className="card-meta">
                <span className="card-category">${post.category}</span>
                <span className="card-read-time"><${Clock}/> ${
                  post.readTime
                }</span>
              </div>
              <h1>${post.title}</h1>
              <time className="meta" datetime=${post.date}>${
                post.dateDisplay
              }</time>
            </header>

            ${
              post.image &&
              html`
                <figure className="article-hero">
                  <${ProgressiveImage}
                    src=${post.image}
                    alt=${post.title}
                    className="article-hero-img"
                    loading="eager"
                    fetchpriority="high"
                  />
                </figure>
              `
            }

            <div className="article-body" dangerouslySetInnerHTML=${{
              __html: cleanHtml,
            }}></div>
          </article>
        </div>
      </${React.Fragment}>
    `;
  }

  // --- List View ---
  return html`
    <${React.Fragment}>
      ${
        !showFiltersInMenu
          ? html`
              <div className="blog-sticky-filter">
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
            `
          : ''
      }

      <div className="container-blog fade-in" style=${{ paddingTop: '2rem' }}>
        <${ScrollToTop} />

        <div className="blog-header-section">
          <h1 className="blog-headline">${t('blog.headline')}</h1>
          <p className="blog-subline">${t('blog.subline')}</p>
        </div>

        <div className="blog-grid">
          ${visiblePosts.map((post, idx) => {
            const loadingStrategy = idx < 2 ? 'eager' : 'lazy';
            const fetchPriority = idx === 0 ? 'high' : undefined;

            return html`
              <article
                key=${post.id}
                className="blog-card"
                onClick=${(e) => handlePostClick(e, post.id)}
              >
                ${post.image
                  ? html`<${ProgressiveImage}
                      src=${post.image}
                      alt=${post.title}
                      className="blog-card-image"
                      loading=${loadingStrategy}
                      fetchpriority=${fetchPriority}
                    />`
                  : ''}

                <div className="card-content-wrapper">
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
                </div>
              </article>
            `;
          })}
        ${
          visiblePosts.length === 0 && !loading
            ? html`<p style="color:#666">${t('blog.not_found')}</p>`
            : ''
        }
        </div>
      </div>
    </${React.Fragment}>
  `;
};

const rootEl = document.getElementById('root');
if (rootEl)
  createRoot(rootEl).render(
    React.createElement(ErrorBoundary, null, React.createElement(BlogApp)),
  );
