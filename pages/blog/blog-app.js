import React from 'https://esm.sh/react@18.2.0?dev=false';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client?dev=false';
import htm from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.module.js';
import { createLogger } from '/content/utils/shared-utilities.js';
import { FAVICON_512 } from '../../content/config/site-config.js';
// Markdown rendering + XSS-safe sanitization
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@5.1.1/lib/marked.esm.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@2.4.0/dist/purify.es.js';

// Silence deprecation warnings from marked v5 (mangle & headerIds are deprecated defaults)
// We prefer explicit, stable behavior: no mangle, no auto header id generation
marked.setOptions({ mangle: false, headerIds: false });

const log = createLogger('BlogApp');
// Posts are loaded dynamically from markdown files (content/posts/*.md) or sitemap; blog-data.js is deprecated

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

  // Posts state (loaded from content/posts/*.md)
  const [posts, setPosts] = React.useState([]);
  const [loadingPosts, setLoadingPosts] = React.useState(true);

  // Extract unique categories
  const categories = [
    'All',
    ...new Set(posts.map((post) => post.category)),
  ];

  const filteredPosts =
    filter === 'All' ? posts : posts.filter((post) => post.category === filter);

  // Load posts: try sitemap -> content/posts/*.md
  React.useEffect(() => {
    let mounted = true;

    function parseFrontmatter(txt) {
      // very small frontmatter parser: extract between first two '---' lines
      const m = txt.match(/^---\s*([\s\S]*?)\s*---\s*/);
      const meta = {};
      let body = txt;
      if (m) {
        const fm = m[1];
        body = txt.slice(m[0].length);
        // parse simple key: "value" and arrays
        const lines = fm.split(/\n/);
        let curKey = null;
        for (let line of lines) {
          if (/^\s*-\s*/.test(line) && curKey) {
            // array item
            line = line.replace(/^\s*-\s*/, '').trim().replace(/^"|"$/g, '');
            meta[curKey] = meta[curKey] || [];
            meta[curKey].push(line);
            continue;
          }
          const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
          if (kv) {
            const k = kv[1];
            let v = kv[2].trim();
            v = v.replace(/^"|"$/g, '');
            if (v === '') {
              curKey = k; // start of array
              meta[curKey] = meta[curKey] || [];
            } else {
              meta[k] = v;
              curKey = null;
            }
          }
        }
      }
      return { meta, body };
    }

    // Parse a generated article HTML page and extract title, date, excerpt, image and article HTML
    function parseArticleHtml(txt, id) {
      try {
        const doc = new DOMParser().parseFromString(txt, 'text/html');
        const article = doc.querySelector('.blog-article') || doc.querySelector('article') || doc.querySelector('.page-article') || doc.querySelector('main') || doc.body;
        const titleEl = article && article.querySelector('h1');
        const metaEl = article && (article.querySelector('.meta') || article.querySelector('.article-meta'));
        const heroImg = article && article.querySelector('.article-hero img');
        // Prefer scoped article body, otherwise fall back to a safe container
        let bodyEl = article && (article.querySelector('.article-body') || article.querySelector('section') || article.querySelector('div'));
        if (!bodyEl) bodyEl = article;

        // Remove site chrome that might have been included in the extracted HTML
        const chromeSelectors = ['header.site-header', 'nav.site-menu', '#footer-container', 'footer', '.site-footer', '.skip-links'];
        chromeSelectors.forEach((sel) => {
          const els = bodyEl.querySelectorAll ? bodyEl.querySelectorAll(sel) : [];
          els.forEach((el) => el.remove());
        });

        // Remove any scripts and inline trackers from the extracted HTML
        if (bodyEl.querySelectorAll) {
          const scripts = bodyEl.querySelectorAll('script');
          scripts.forEach((s) => s.remove());
        }

        const title = titleEl ? titleEl.textContent.trim() : (doc.querySelector('title') ? doc.querySelector('title').textContent.trim() : id);
        const date = metaEl ? metaEl.textContent.trim() : '';
        const excerpt = bodyEl ? (bodyEl.querySelector('p') ? bodyEl.querySelector('p').textContent.trim().slice(0, 200) : '') : '';
        const image = heroImg ? (heroImg.getAttribute('src') || heroImg.getAttribute('data-src') || '') : (doc.querySelector('meta[property="og:image"]') ? doc.querySelector('meta[property="og:image"]').getAttribute('content') : '');

        // Serialize cleaned HTML and strip potential remaining script tags just in case
        let contentHtml = bodyEl ? bodyEl.innerHTML.trim() : (doc.body ? doc.body.innerHTML : '');
        contentHtml = contentHtml.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');

        return {
          id,
          title,
          date,
          dateDisplay: date,
          category: '',
          excerpt,
          image,
          tags: [],
          readTime: '',
          content: '',
          html: contentHtml,
          author: '',
        };
      } catch (e) {
        return null;
      }
    }

    async function loadFromSitemap() {
      try {
        const r = await fetch('/sitemap.xml');
        if (!r.ok) throw new Error('sitemap fetch failed');
        const xml = await r.text();
        const ids = Array.from(xml.matchAll(/<loc>https?:\/\/[^<]*\/blog\/([^\/<>]+)\/?.*?<\/loc>/g)).map((m) => decodeURIComponent(m[1]));
        const uniqueIds = Array.from(new Set(ids));
        const loaded = [];
        await Promise.all(
          uniqueIds.map(async (id) => {
            try {
              // Try the generated HTML page first (avoids 404s for missing markdown)
              const htmlRes = await fetch(`/pages/blog/${id}/index.html`);
              if (htmlRes.ok) {
                const txt = await htmlRes.text();
                const parsedHtml = parseArticleHtml(txt, id);
                if (parsedHtml) {
                  loaded.push(parsedHtml);
                  return;
                }
              } else {
                // try the clean path /blog/:id/ as alternative
                const alt = await fetch(`/blog/${id}/`);
                if (alt.ok) {
                  const altTxt = await alt.text();
                  const parsedAlt = parseArticleHtml(altTxt, id);
                  if (parsedAlt) {
                    loaded.push(parsedAlt);
                    return;
                  }
                }
              }

              // Fallback: try markdown files in /content/posts/*.md
              const mdRes = await fetch(`/content/posts/${id}.md`);
              if (mdRes.ok) {
                const txt = await mdRes.text();
                const parsed = parseFrontmatter(txt);
                const meta = parsed.meta || {};
                loaded.push({
                  id,
                  title: meta.title || id,
                  date: meta.date || '',
                  dateDisplay: meta.dateDisplay || meta.date || '',
                  category: meta.category || '',
                  excerpt: meta.excerpt || '',
                  image: meta.image || '',
                  tags: meta.tags || [],
                  readTime: meta.readTime || '',
                  content: parsed.body || '',
                  author: meta.author || '',
                });
                return;
              }
            } catch (e) {
              /* ignore individual failures */
            }
          }),
        );
        // sort by date desc if available
        loaded.sort((a, b) => (a.date < b.date ? 1 : -1));
        if (mounted) {
          setPosts(loaded);
          setLoadingPosts(false);
        }
      } catch (e) {
        // fallback: attempt to fetch a minimal index (not present)
        if (mounted) {
          setPosts([]);
          setLoadingPosts(false);
        }
      }
    }

    loadFromSitemap();
    return () => (mounted = false);
  }, []);

  // Sync with hash routing + pathname routing (/blog/:id)
  React.useEffect(() => {
    const parseRoute = () => {
      const m = location.hash.match(/^#\/blog\/(.+)$/);
      const p = location.pathname.match(/^\/blog\/([^\/]+)\/?$/);
      const id = m ? decodeURIComponent(m[1]) : p ? decodeURIComponent(p[1]) : null;
      setCurrentPostId(id);
      // If the page was loaded directly at /blog/:id, update the hash so internal navigation still works
      if (p && !location.hash) {
        location.replace(`#/blog/${p[1]}`);
      }
    };
    parseRoute();
    window.addEventListener('hashchange', parseRoute);
    window.addEventListener('popstate', parseRoute);
    return () => {
      window.removeEventListener('hashchange', parseRoute);
      window.removeEventListener('popstate', parseRoute);
    };
  }, []);

  // Update head (meta + JSON-LD) when viewing a single post
  React.useEffect(() => {
    if (!currentPostId) {
      // remove temp article JSON-LD and restore description/title if present
      const t = document.querySelector(
        'script[type="application/ld+json"][data-temp-article]',
      );
      if (t) t.remove();

      // restore standard meta tags we may have overwritten
      const revertMeta = (selector) => {
        const m = document.querySelector(selector);
        if (m) {
          const orig = m.getAttribute('data-orig');
          if (orig) m.setAttribute('content', orig || '');
          m.removeAttribute('data-temp');
        }
      };

      revertMeta('meta[name="description"][data-temp]');
      revertMeta('meta[property="og:title"][data-temp]');
      revertMeta('meta[property="og:description"][data-temp]');
      revertMeta('meta[property="og:image"][data-temp]');
      revertMeta('meta[name="twitter:title"][data-temp]');
      revertMeta('meta[name="twitter:description"][data-temp]');
      revertMeta('meta[name="twitter:image"][data-temp]');

      // remove any temp og/twitter tags that we created from scratch (if present)
      ['meta[property="og:title"][data-temp]', 'meta[property="og:description"][data-temp]', 'meta[property="og:image"][data-temp]', 'meta[name="twitter:title"][data-temp]', 'meta[name="twitter:description"][data-temp]', 'meta[name="twitter:image"][data-temp]']
        .forEach((sel) => {
          const el = document.querySelector(sel);
          if (el && !el.getAttribute('data-orig')) el.remove();
        });

      // FIX: Restore the central title defined in head-complete.js/PAGE_CONFIG
      document.title = 'Tech Blog & Insights | Abdulkerim Sesli';

      // restore canonical link (remove temporary per-post canonical)
      (function restoreCanonical() {
        const link = document.querySelector('link[rel="canonical"]');
        if (link) {
          if (!link.getAttribute('data-orig'))
            link.setAttribute('data-orig', link.getAttribute('href') || '');
          link.setAttribute('href', location.origin + '/blog/');
          link.removeAttribute('data-temp');
        }
      })();

      return;
    }

    const post = posts.find((p) => p.id === currentPostId);
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

    // Helper to set or create meta tags (property or name)
    function setMetaTag(attrName, attrValue, attrType = 'property') {
      const selector = `${attrType}="${attrName}"`;
      let m = document.querySelector(`meta[${selector}]`);
      if (!m) {
        m = document.createElement('meta');
        m.setAttribute(attrType, attrName);
        document.head.appendChild(m);
      }
      if (!m.getAttribute('data-orig')) m.setAttribute('data-orig', m.getAttribute('content') || '');
      m.setAttribute('content', attrValue);
      m.setAttribute('data-temp', '1');
    }

    // Set OG & Twitter tags for better sharing
    setMetaTag('og:title', post.title, 'property');
    setMetaTag('og:description', desc, 'property');
    const ogImage = (typeof ogMeta !== 'undefined' && ogMeta && post.imageKey && ogMeta[post.imageKey]) ? (ogMeta[post.imageKey].fallback || post.image) : (post.image || (post.schema && post.schema.image) || 'https://www.abdulkerimsesli.de/content/assets/img/og/og-home-800.webp');
    setMetaTag('og:image', ogImage, 'property');
    setMetaTag('twitter:image', ogImage, 'name');

    setMetaTag('twitter:title', post.title, 'name');
    setMetaTag('twitter:description', desc, 'name');
    setMetaTag('twitter:image', (post.image && post.image) || post.image || (post.schema && post.schema.image) || 'https://www.abdulkerimsesli.de/content/assets/img/og/og-home-800.webp', 'name');
    // ensure large image card
    setMetaTag('twitter:card', 'summary_large_image', 'name');

    document.title = `${post.title} — Abdulkerim Sesli`;

    // set canonical to the article URL (temporary while viewing)
    (function setCanonical() {
      let link = document.querySelector('link[rel="canonical"]');
      const href = `${location.origin}/blog/${post.id}`;
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      if (!link.getAttribute('data-orig'))
        link.setAttribute('data-orig', link.getAttribute('href') || '');
      link.setAttribute('href', href);
      link.setAttribute('data-temp', '1');
    })();

    // Insert Article JSON-LD (temp, dupe-safe)
    try {
      if (
        !document.querySelector(
          'script[type="application/ld+json"][data-temp-article]',
        )
      ) {
        // Safely parse post.date into an ISO string if valid
        const toIsoDate = (d) => {
          try {
            if (!d) return undefined;
            const ds = String(d).trim();
            if (!ds) return undefined;
            const dt = new Date(ds + 'T00:00:00Z');
            return isNaN(dt.getTime()) ? undefined : dt.toISOString();
          } catch (e) {
            return undefined;
          }
        };
        const iso = toIsoDate(post.date);

        const ld = {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://www.abdulkerimsesli.de/blog/${post.id}`,
          },
          headline: post.title,
          description: post.excerpt,
          author: {
            '@type': 'Person',
            '@id': 'https://www.abdulkerimsesli.de/#person',
          },
          image: (function () {
            try {
              const meta =
                typeof ogMeta !== 'undefined' && ogMeta && ogMeta[post.imageKey]
                  ? ogMeta[post.imageKey]
                  : null;
              if (meta) {
                const w = meta.fallbackWidth || meta.originalWidth || null;
                const h =
                  meta.originalWidth && meta.originalHeight
                    ? Math.round(
                      (meta.originalHeight * (w || meta.originalWidth)) /
                      meta.originalWidth,
                    )
                    : null;
                return {
                  '@type': 'ImageObject',
                  url:
                    meta.fallback ||
                    post.image ||
                    'https://www.abdulkerimsesli.de/content/assets/img/og/og-home-800.webp',
                  width: w || undefined,
                  height: h || undefined,
                };
              }
            } catch (e) {
              /* ignore */
            }
            return {
              '@type': 'ImageObject',
              url:
                post.image ||
                'https://www.abdulkerimsesli.de/content/assets/img/og/og-home-800.webp',
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
              acquireLicensePage:
                'https://www.abdulkerimsesli.de/#image-license',
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
          articleSection: post.category,
          keywords: (post.meta && post.meta.keywords) || (post.schema && post.schema.keywords) || (post.tags && post.tags.join(',')),
        };

        // Add date fields only when we have a valid ISO date
        if (iso) {
          ld.datePublished = iso;
          ld.dateModified = iso;
        }

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

  // Use `marked` + DOMPurify for robust Markdown → HTML conversion and XSS-safe output
  function mdToHtml(md = '') {
    try {
      // Custom renderer to ensure links open safely
      const renderer = {
        link(href, title, text) {
          const safeHref = String(href || '').replace(/"/g, '%22');
          return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        },
      };
      marked.use({ renderer });

      const raw = marked.parse(String(md || ''));
      // Wrap Takeaways blocks (common pattern) into a dedicated visual box
      const withTakeaways = raw.replace(/<p>\s*<strong>\s*Takeaways:\s*<\/strong>\s*<\/p>\s*<ul>/i, '<div class="takeaways"><ul>')
        .replace(/<\/ul>\s*(<p>\s*🔗|<p>\s*👉|<p>\s*<a|<p>\s*<strong>|$)/i, '</ul></div>$1');
      // DOMPurify ensures no malicious HTML/JS remains
      return DOMPurify.sanitize(withTakeaways);
    } catch (e) {
      // Fallback: escape basic HTML and replace newlines
      return String(md || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
  }

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
            const webpSrc = (m.sources.webp || [])
              .map((s) => `${s.url} ${s.width}w`)
              .join(', ');
            const fallback = m.fallback || post.image;
            const w = m.fallbackWidth || m.originalWidth || null;
            const h =
              m.originalWidth && m.originalHeight
                ? Math.round(
                  (m.originalHeight * (w || m.originalWidth)) /
                  m.originalWidth,
                )
                : null;
            return React.createElement(
              'picture',
              null,
              webpSrc &&
              React.createElement('source', {
                type: 'image/webp',
                srcSet: webpSrc,
                sizes: '(max-width:640px) 100vw, 33vw',
              }),
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
          React.createElement(
            'span',
            { className: 'card-category' },
            post.category,
          ),
          React.createElement(
            'span',
            { className: 'card-date' },
            post.dateDisplay,
          ),
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
      React.createElement(
        'h1',
        { className: 'blog-headline' },
        'Wissen & Einblicke',
      ),
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
        const post = posts.find((p) => p.id === currentPostId);
        return React.createElement(
          'div',
          { className: 'blog-detail' },
          post
            ? React.createElement(
              'article',
              { className: 'blog-article' },
              // Hero image (if available)
              post.image
                ? React.createElement(
                  'figure',
                  { className: 'article-hero' },
                  React.createElement('img', {
                    src: post.image,
                    alt: post.imageAlt || post.title,
                    className: 'article-hero-img',
                    loading: 'eager',
                  }),
                )
                : null,
              React.createElement(
                'header',
                null,
                React.createElement('h1', null, post.title),
                React.createElement(
                  'p',
                  { className: 'meta' },
                  `${post.dateDisplay} — ${post.readTime}`,
                ),
              ),
              // Share buttons
              React.createElement(
                'div',
                { className: 'share-row u-row' },
                React.createElement(
                  'a',
                  {
                    className: 'share-btn',
                    href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      post.title,
                    )}&url=${encodeURIComponent(
                      'https://www.abdulkerimsesli.de/blog/' + post.id,
                    )}`,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  },
                  'Twitter',
                ),
                React.createElement(
                  'a',
                  {
                    className: 'share-btn',
                    href: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(
                      'https://www.abdulkerimsesli.de/blog/' + post.id,
                    )}&title=${encodeURIComponent(post.title)}`,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  },
                  'LinkedIn',
                ),
                React.createElement(
                  'a',
                  {
                    className: 'share-btn',
                    href: `https://mastodon.social/share?text=${encodeURIComponent(
                      post.title + ' — https://www.abdulkerimsesli.de/blog/' + post.id,
                    )}`,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  },
                  'Mastodon',
                ),
              ),
              // prefer already-rendered HTML when available (from parsed article pages), otherwise render markdown
              React.createElement('section', {
                className: 'article-body',
                dangerouslySetInnerHTML: { __html: post.html ? post.html : mdToHtml(post.content) },
              }),
              // Resources
              post.resources && post.resources.length
                ? React.createElement(
                  'div',
                  { className: 'resources' },
                  React.createElement('h4', null, 'Resources & Tools'),
                  React.createElement(
                    'ul',
                    null,
                    ...post.resources.map((r) =>
                      React.createElement(
                        'li',
                        { key: r.url },
                        React.createElement(
                          'a',
                          {
                            href: r.url,
                            target: '_blank',
                            rel: 'noopener noreferrer',
                          },
                          r.title,
                        ),
                      ),
                    ),
                  ),
                )
                : null,
              // Related posts
              post.related && post.related.length
                ? React.createElement(
                  'div',
                  { className: 'related' },
                  React.createElement('h4', null, 'Verwandte Beiträge'),
                  React.createElement(
                    'ul',
                    null,
                    ...post.related.map((id) => {
                      const relPost = posts.find((p) => p.id === id);
                      return React.createElement(
                        'li',
                        { key: id },
                        React.createElement(
                          'a',
                          {
                            href: '#/blog/' + id,
                            onClick: () => (location.hash = `#/blog/${id}`),
                          },
                          relPost ? relPost.title : id,
                        ),
                      );
                    }),
                  ),
                )
                : null,
              // CTA
              React.createElement(
                'div',
                { className: 'article-cta' },
                React.createElement(
                  'a',
                  { className: 'btn btn-primary', href: '/#contact' },
                  'Projektanfrage',
                ),
              ),
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
  log.error('React environment not ready', {
    hasRootEl: !!rootEl,
    hasReact: !!React,
    hasReactDOM: !!ReactDOM,
  });
}
