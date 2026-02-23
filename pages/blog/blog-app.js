/**
 * Blog App with 3D Particle System
 * @version 7.0.0 - Final Optimized & Minimal
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import { createLogger } from '/content/core/logger.js';
import { createUseTranslation } from '/content/core/utils.js';
import { AppLoadManager } from '/content/core/load-manager.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@11.1.1/lib/marked.esm.js';
import { sanitizeHTML } from '/content/core/utils.js';
import { Clock, ArrowRight } from '/content/components/icons/icons.js';
import { createErrorBoundary } from '/content/components/ErrorBoundary.js';
import { ParticleSystem } from './utils/ParticleSystem.js';
import { loadPostsData } from './utils/data-loader.js';
import { resetBlogPageMeta, updatePostMeta } from './utils/seo-manager.js';
import {
  ProgressiveImage,
  ScrollToTop,
  ReadingProgress,
} from './components/BlogComponents.js';
import { initThemeColorManager } from '/content/core/theme-color-manager.js';

const log = createLogger('BlogApp');
const html = htm.bind(React.createElement);
const ErrorBoundary = createErrorBoundary(React);
const useTranslation = createUseTranslation();

// Configure Marked
marked.setOptions({
  renderer: new marked.Renderer(),
  mangle: false,
  headerIds: false,
});

const BlogApp = () => {
  const { t } = useTranslation();
  const [posts, setPosts] = React.useState([]);
  const [activePost, setActivePost] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const particleSystemRef = React.useRef(null);

  // Initialize 3D Particle System
  React.useEffect(() => {
    const canvas = document.getElementById('blog-particles-canvas');
    if (!canvas) return;

    try {
      particleSystemRef.current = new ParticleSystem(canvas);
      particleSystemRef.current.start();
    } catch (e) {
      log.warn('ParticleSystem init failed', e);
    }

    return () => particleSystemRef.current?.stop();
  }, []);

  // Load blog posts
  React.useEffect(() => {
    (async () => {
      try {
        const loadedPosts = await loadPostsData();
        setPosts(loadedPosts);

        const hash = window.location.hash.slice(1);
        if (hash) {
          const post = loadedPosts.find((p) => p.id === hash);
          if (post) setActivePost(post);
        }

        AppLoadManager.updateLoader(1.0, t('loader.ready'));
        setTimeout(() => AppLoadManager.hideLoader(), 300);
      } catch (e) {
        log.error('Failed to load posts', e);
        setError(e.message);
        AppLoadManager.hideLoader();
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  // Update SEO meta tags
  React.useEffect(() => {
    document.getElementById('blog-post-ldjson')?.remove();
    activePost ? updatePostMeta(activePost) : resetBlogPageMeta();
  }, [activePost]);

  // Handle post navigation
  const openPost = React.useCallback((post) => {
    setActivePost(post);
    window.history.pushState(null, '', `#${post.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const closePost = React.useCallback(() => {
    setActivePost(null);
    window.history.pushState(null, '', window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Handle browser back/forward
  React.useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.slice(1);
      const post = hash ? posts.find((p) => p.id === hash) : null;
      setActivePost(post || null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [posts]);

  // Render post content
  const renderPostContent = (post) => {
    if (!post.content) return null;
    try {
      return html`<div
        dangerouslySetInnerHTML=${{
          __html: sanitizeHTML(marked.parse(post.content)),
        }}
      />`;
    } catch (e) {
      log.error('Markdown render failed', e);
      return html`<p style=${{ color: 'var(--color-error)' }}>
        ${t('blog.render_error')}
      </p>`;
    }
  };

  if (loading) {
    return html`<div className="blog-loading">
      <p>${t('loader.loading_blog')}</p>
    </div>`;
  }

  if (error) {
    return html`<div className="blog-error">
      <p style=${{ color: 'var(--color-error)' }}>${error}</p>
    </div>`;
  }

  if (activePost) {
    return html`
      <div className="blog-post-view">
        <${ReadingProgress} />
        <button className="btn-back" onClick=${closePost}>
          <${ArrowRight} style=${{ transform: 'rotate(180deg)' }} />
          ${t('blog.back_to_overview')}
        </button>
        <article className="blog-article">
          ${activePost.image &&
          html`<header className="article-hero">
            <${ProgressiveImage}
              src=${activePost.image}
              alt=${activePost.imageAlt || activePost.title}
              className="article-hero-img"
              loading="eager"
              fetchpriority="high"
            />
          </header>`}
          <header>
            <h1>${activePost.title}</h1>
            <div className="meta">
              <span className="card-category">${activePost.category}</span>
              <time className="card-date">${activePost.dateDisplay}</time>
              <span className="card-read-time">
                <${Clock} /> ${activePost.readTime}
              </span>
            </div>
            ${activePost.excerpt &&
            html`<p
              style=${{
                fontSize: '1.2rem',
                color: 'rgba(226, 232, 240, 0.9)',
                marginBottom: '2rem',
              }}
            >
              ${activePost.excerpt}
            </p>`}
          </header>
          <div className="article-body">${renderPostContent(activePost)}</div>
        </article>
        <${ScrollToTop} />
      </div>
    `;
  }

  return html`
    <div className="blog-list-view">
      <header className="blog-header">
        <h1>${t('blog.title')}</h1>
        <p className="blog-subtitle">${t('blog.subtitle')}</p>
      </header>
      <div className="blog-grid">
        ${posts.map(
          (post) => html`
            <article
              key=${post.id}
              className="blog-card"
              onClick=${() => openPost(post)}
            >
              ${post.image &&
              html`<${ProgressiveImage}
                src=${post.image}
                alt=${post.imageAlt || post.title}
                className="blog-card-image"
              />`}
              <div className="card-content-wrapper">
                <div className="card-meta">
                  <span className="card-category">${post.category}</span>
                  <time className="card-date">${post.dateDisplay}</time>
                </div>
                <h2 className="card-title">${post.title}</h2>
                ${post.excerpt &&
                html`<p className="card-excerpt">${post.excerpt}</p>`}
                <div className="card-footer">
                  <span className="card-read-time">
                    <${Clock} /> ${post.readTime}
                  </span>
                  <span className="btn-read">
                    ${t('blog.read_more')} <${ArrowRight} />
                  </span>
                </div>
              </div>
            </article>
          `,
        )}
      </div>
      <${ScrollToTop} />
    </div>
  `;
};

// App Initialization with resilience for SPA DOM injection timing
const waitForRoot = (timeout = 3000) =>
  new Promise((resolve) => {
    const existing = document.getElementById('root');
    if (existing) return resolve(existing);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            const found = node.querySelector && node.querySelector('#root');
            if (found) {
              observer.disconnect();
              return resolve(found);
            }
            if (node.id === 'root') {
              observer.disconnect();
              return resolve(node);
            }
          }
        }
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      resolve(document.getElementById('root'));
    }, timeout);
  });

const initBlogApp = async () => {
  const root = await waitForRoot();
  if (!root) {
    log.error('Root element not found after waiting');
    return;
  }

  createRoot(root).render(html`<${ErrorBoundary}><${BlogApp} /><//>`);
  log.info('Blog app initialized');

  // Ensure browser theme-color meta tags are initialized (transparent bar)
  try {
    initThemeColorManager();
  } catch (e) {
    log.warn('initThemeColorManager failed', e);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBlogApp);
} else {
  initBlogApp();
}
