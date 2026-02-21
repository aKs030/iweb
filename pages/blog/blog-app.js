/**
 * Blog App with 3D Particle System
 * @version 6.0.0 - REFACTORED & MODULAR
 * @last-modified 2026-02-21
 */

// @ts-nocheck
import React from 'https://esm.sh/react@19.2.3';
import { createRoot } from 'https://esm.sh/react-dom@19.2.3/client';
import htm from 'https://esm.sh/htm@3.1.1';
import { createLogger } from '/content/core/logger.js';
import { createUseTranslation } from '/content/core/react-utils.js';
import { AppLoadManager } from '/content/core/load-manager.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@11.1.1/lib/marked.esm.js';
import { sanitizeHTML } from '/content/core/html-sanitizer.js';
import { Clock, ArrowRight } from '/content/components/icons/icons.js';
import { createErrorBoundary } from '/content/components/ErrorBoundary.js';

// Blog-specific modules
import { ParticleSystem } from './utils/ParticleSystem.js';
import { loadPostsData } from './utils/data-loader.js';
import { resetBlogPageMeta, updatePostMeta } from './utils/seo-manager.js';
import {
  ProgressiveImage,
  ScrollToTop,
  ReadingProgress,
} from './components/BlogComponents.js';

const log = createLogger('BlogApp');
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

// --- Main Blog App Component ---
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
      log.warn('Failed to initialize ParticleSystem', e);
    }

    return () => {
      if (particleSystemRef.current) {
        particleSystemRef.current.stop();
      }
    };
  }, []);

  // Load blog posts
  React.useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const loadedPosts = await loadPostsData([]);
        setPosts(loadedPosts);

        // Check URL for post ID
        const hash = window.location.hash.slice(1);
        if (hash) {
          const post = loadedPosts.find((p) => p.id === hash);
          if (post) {
            setActivePost(post);
          }
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
    };

    loadData();
  }, [t]);

  // Update SEO meta tags
  React.useEffect(() => {
    // Remove old JSON-LD script
    const oldScript = document.getElementById('blog-post-ldjson');
    if (oldScript) oldScript.remove();

    if (activePost) {
      updatePostMeta(activePost);
    } else {
      resetBlogPageMeta();
    }
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
      if (hash) {
        const post = posts.find((p) => p.id === hash);
        if (post) {
          setActivePost(post);
        }
      } else {
        setActivePost(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [posts]);

  // Render post content
  const renderPostContent = (post) => {
    if (!post.content) return null;

    try {
      const rawHtml = marked.parse(post.content);
      const cleanHtml = sanitizeHTML(rawHtml);
      return html`<div
        className="blog-post-content"
        dangerouslySetInnerHTML=${{ __html: cleanHtml }}
      />`;
    } catch (e) {
      log.error('Failed to render markdown', e);
      return html`<p style=${{ color: 'var(--color-error)' }}>
        ${t('blog.render_error')}
      </p>`;
    }
  };

  // Loading state
  if (loading) {
    return html`<div className="blog-loading">
      <p>${t('loader.loading_blog')}</p>
    </div>`;
  }

  // Error state
  if (error) {
    return html`<div className="blog-error">
      <p style=${{ color: 'var(--color-error)' }}>${error}</p>
    </div>`;
  }

  // Single post view
  if (activePost) {
    return html`
      <div className="blog-post-view">
        <${ReadingProgress} />

        <button className="blog-back-btn" onClick=${closePost}>
          <${ArrowRight} style=${{ transform: 'rotate(180deg)' }} />
          ${t('blog.back_to_overview')}
        </button>

        <article className="blog-post-detail">
          <header className="blog-post-header">
            ${activePost.image &&
            html`<${ProgressiveImage}
              src=${activePost.image}
              alt=${activePost.imageAlt || activePost.title}
              className="blog-post-hero-image"
              loading="eager"
              fetchpriority="high"
            />`}

            <div className="blog-post-meta">
              <span className="blog-post-category">${activePost.category}</span>
              <time className="blog-post-date">${activePost.dateDisplay}</time>
              <span className="blog-post-read-time">
                <${Clock} /> ${activePost.readTime}
              </span>
            </div>

            <h1 className="blog-post-title">${activePost.title}</h1>

            ${activePost.excerpt &&
            html`<p className="blog-post-excerpt">${activePost.excerpt}</p>`}
          </header>

          ${renderPostContent(activePost)}
        </article>

        <${ScrollToTop} />
      </div>
    `;
  }

  // Post list view
  return html`
    <div className="blog-list-view">
      <header className="blog-header">
        <h1>${t('blog.title')}</h1>
        <p className="blog-subtitle">${t('blog.subtitle')}</p>
      </header>

      <div className="blog-posts-grid">
        ${posts.map(
          (post) => html`
            <article
              key=${post.id}
              className="blog-post-card"
              onClick=${() => openPost(post)}
            >
              ${post.image &&
              html`<${ProgressiveImage}
                src=${post.image}
                alt=${post.imageAlt || post.title}
                className="blog-post-card-image"
              />`}

              <div className="blog-post-card-content">
                <div className="blog-post-card-meta">
                  <span className="blog-post-category">${post.category}</span>
                  <time className="blog-post-date">${post.dateDisplay}</time>
                </div>

                <h2 className="blog-post-card-title">${post.title}</h2>

                ${post.excerpt &&
                html`<p className="blog-post-card-excerpt">${post.excerpt}</p>`}

                <div className="blog-post-card-footer">
                  <span className="blog-post-read-time">
                    <${Clock} /> ${post.readTime}
                  </span>
                  <span className="blog-post-read-more">
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

// --- App Initialization ---
const initBlogApp = () => {
  try {
    const root = document.getElementById('root');
    if (!root) {
      log.error('Root element not found');
      return;
    }

    const reactRoot = createRoot(root);
    reactRoot.render(
      html`<${ErrorBoundary}>
        <${BlogApp} />
      <//>`,
    );

    log.info('Blog app initialized successfully');
  } catch (e) {
    log.error('Failed to initialize blog app', e);
    AppLoadManager.hideLoader();
  }
};

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBlogApp);
} else {
  initBlogApp();
}
