/**
 * Search Utilities for Cloudflare Pages Functions
 * Centralizes the communication with the AI Search Worker via RPC
 * @version 2.5.0
 */

/**
 * Performs a search query using the AI_SEARCH binding (RPC)
 * @param {object} env - The environment object containing bindings
 * @param {string} query - The search query
 * @param {object} options - Search options
 * @returns {Promise<object>} - Search results
 */
export async function performSearch(env, query, options = {}) {
  if (!env.AI_SEARCH || typeof env.AI_SEARCH.search !== 'function') {
    console.error('[search-utils] AI_SEARCH binding or search method missing');
    throw new Error('Search service unavailable');
  }

  try {
    // Modern RPC call to the AI Search Worker
    const data = await env.AI_SEARCH.search(query, {
      mode: 'search',
      topK: options.topK || 20,
      ...options,
    });

    // Post-process results if needed
    if (data.results && Array.isArray(data.results)) {
      let results = data.results.map(improveTitle);
      results = deduplicateResults(results);
      data.results = results;
      data.count = results.length;
    }

    return data;
  } catch (error) {
    console.error('[search-utils] Search RPC failed:', error);
    throw error;
  }
}

/**
 * Performs an AI/RAG query using the AI_SEARCH binding (RPC)
 * @param {object} env - The environment object containing bindings
 * @param {string} prompt - The AI prompt
 * @param {object} options - AI options
 * @returns {Promise<object>} - AI response with sources
 */
export async function performAIQuery(env, prompt, options = {}) {
  if (!env.AI_SEARCH || typeof env.AI_SEARCH.search !== 'function') {
    console.error('[search-utils] AI_SEARCH binding or search method missing');
    throw new Error('AI service unavailable');
  }

  try {
    // Modern RPC call to the AI Search Worker with RAG mode
    return await env.AI_SEARCH.search(prompt, {
      mode: 'ai',
      stream: false,
      ...options,
    });
  } catch (error) {
    console.error('[search-utils] AI RPC failed:', error);
    throw error;
  }
}

/**
 * Deduplicates results based on URL
 */
function deduplicateResults(results) {
  const seen = new Set();
  const deduplicated = [];

  for (const result of results) {
    if (!result.url) {
      deduplicated.push(result);
      continue;
    }
    // Normalize URL (remove trailing slash)
    const normalizedUrl = result.url.replace(/\/$/, '');

    if (!seen.has(normalizedUrl)) {
      seen.add(normalizedUrl);
      deduplicated.push(result);
    }
  }

  return deduplicated;
}

/**
 * Improves titles based on URL patterns
 */
function improveTitle(result) {
  const url = result.url;
  if (!url) return result;

  // Extract page name from URL
  if (url.includes('/blog/')) {
    const slug = url.split('/blog/')[1]?.replace(/\/$/, '');
    if (slug) {
      return {
        ...result,
        title: `Blog: ${slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`,
        category: 'Blog',
      };
    }
  }

  if (url.includes('/projekte/')) {
    const slug = url.split('/projekte/')[1]?.replace(/\/$/, '');
    if (slug) {
      return {
        ...result,
        title: `Projekt: ${slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`,
        category: 'Projekt',
      };
    }
    return { ...result, title: 'Projekte Übersicht', category: 'Projekte' };
  }

  if (url.includes('/videos/')) {
    const slug = url.split('/videos/')[1]?.replace(/\/$/, '');
    if (slug) {
      return {
        ...result,
        title: `Video: ${slug.toUpperCase()}`,
        category: 'Video',
      };
    }
    return { ...result, title: 'Videos Übersicht', category: 'Videos' };
  }

  if (url.includes('/gallery/')) {
    return { ...result, title: 'Fotogalerie', category: 'Galerie' };
  }

  if (url.includes('/about/')) {
    return { ...result, title: 'Über mich', category: 'About' };
  }

  if (url.endsWith('/') && url.split('/').length === 4) {
    return { ...result, title: 'Startseite', category: 'Home' };
  }

  return result;
}
