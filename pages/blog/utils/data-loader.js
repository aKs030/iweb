/**
 * Blog Data Loading Logic
 * @version 2.0.0 - Optimized & Minimal
 */

import { createLogger } from "../../content/core/logger.js";
import { AppLoadManager } from "../../content/core/load-manager.js";
import { fetchJSON, fetchText } from "../../content/core/utils/fetch.js";
import { i18n } from "../../content/core/i18n.js";
import { parseFrontmatter, normalizePost } from "./blog-utils.js";

const log = createLogger("BlogDataLoader");

export const loadPostsData = async () => {
  try {
    AppLoadManager.updateLoader(0.2, i18n.t("loader.loading_blog"));

    const fetchedPosts = await fetchJSON("/pages/blog/posts/index.json", {
      retries: 1,
    });
    AppLoadManager.updateLoader(
      0.4,
      i18n.t("loader.articles_found", { count: fetchedPosts.length })
    );

    let loaded = 0;
    const total = fetchedPosts.length;

    const posts = await Promise.all(
      fetchedPosts.map(async p => {
        try {
          let postData = { ...p };

          if (p.file) {
            const text = await fetchText(p.file, { retries: 1 });
            const { content, data } = parseFrontmatter(text);
            postData = { ...postData, ...data, content };
          }

          loaded++;
          AppLoadManager.updateLoader(
            0.4 + (loaded / total) * 0.4,
            i18n.t("loader.loading_article", { current: loaded, total }),
            { silent: true }
          );

          return normalizePost(postData);
        } catch (e) {
          log.warn(`Failed to load ${p.id}`, e);
          return null;
        }
      })
    );

    AppLoadManager.updateLoader(0.85, i18n.t("loader.processing_articles"));

    const result = posts.filter(Boolean).sort((a, b) => b.timestamp - a.timestamp);

    AppLoadManager.updateLoader(0.95, i18n.t("loader.articles_loaded", { count: result.length }));

    return result;
  } catch (e) {
    log.error("Fatal error loading posts", e);
    return [];
  }
};
