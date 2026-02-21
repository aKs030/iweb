/**
 * Blog Data Loading Logic
 * @version 1.0.0
 */

import { createLogger } from '/content/core/logger.js';
import { AppLoadManager } from '/content/core/load-manager.js';
import { i18n } from '/content/core/i18n.js';
import { parseFrontmatter, normalizePost } from './blog-utils.js';

const log = createLogger('BlogDataLoader');

export const loadPostsData = async (seedPosts = []) => {
  try {
    AppLoadManager.updateLoader(0.2, i18n.t('loader.loading_blog'));

    let fetchedPosts = [];
    try {
      const indexRes = await fetch('/pages/blog/posts/index.json');
      if (indexRes.ok) {
        fetchedPosts = await indexRes.json();
        AppLoadManager.updateLoader(
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
          AppLoadManager.updateLoader(
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

    AppLoadManager.updateLoader(0.85, i18n.t('loader.processing_articles'));

    const map = new Map();
    seedPosts.forEach((p) => map.set(p.id, p));
    populated.filter(Boolean).forEach((p) => {
      map.set(p.id, { ...(map.get(p.id) || {}), ...p });
    });

    const result = Array.from(map.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    );

    AppLoadManager.updateLoader(
      0.95,
      i18n.t('loader.articles_loaded', { count: result.length }),
    );
    return result;
  } catch (e) {
    log.warn('Fatal error loading posts', e);
    return seedPosts;
  }
};
