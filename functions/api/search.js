import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  buildAiSearchRequest,
  clampResults,
  resolveAiSearchConfig,
} from './_ai-search-config.js';
import {
  buildFallbackDescription,
  chooseBestTitle,
  detectCategory,
  extractTitle,
  normalizeUrl,
} from './_search-url.js';
import { CLEANUP_PATTERNS, HTML_ENTITIES } from './_cleanup-patterns.js';

// Configuration
const SEARCH_TIMEOUT_MS = 15000;
const SYSTEM_PROMPT = `Du bist der AI-Assistent der Website von Abdulkerim Sesli. Antworte professionell auf Deutsch, präzise und kurz in 2-4 Sätzen. Nutze nur Markdown-Links mit relativen Pfaden (z. B. [Galerie](/gallery/)) direkt im Fließtext. Keine Aufzählungslisten, keine Linkblöcke, keine Wiederholungen.`;
const TECHNICAL_RESULT_PATHS = new Set([
  '/llms.txt',
  '/llms-full.txt',
  '/ai-index.json',
  '/person.jsonld',
  '/robots.txt',
  '/.well-known/openapi.json',
  '/.well-known/ai-plugin.json',
  '/pages/projekte/apps-config.json',
  '/pages/blog/posts/index.json',
]);
const TECHNICAL_RESULT_PREFIXES = ['/.well-known/', '/api/'];
const ALLOWED_RESULT_PREFIXES = [
  '/about',
  '/blog',
  '/projekte',
  '/gallery',
  '/videos',
];
const ALLOW_ROOT_RESULT = true;
const MAX_AI_CHAT_LINKS = 3;
const MAX_APPENDED_LINKS = 2;
const QUERY_STOPWORDS = new Set([
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'einer',
  'und',
  'oder',
  'mit',
  'zu',
  'zum',
  'zur',
  'von',
  'auf',
  'im',
  'in',
  'am',
  'an',
  'ist',
  'sind',
  'ich',
  'du',
  'mir',
  'mich',
  'zeige',
  'such',
  'suche',
  'finden',
  'finde',
  'wo',
  'was',
  'wie',
  'mehr',
  'infos',
  'info',
]);

const SNIPPET_METADATA_LABELS = [
  'title',
  'description',
  'excerpt',
  'seoDescription',
  'image',
  'imageAlt',
  'thumbnail',
  'keywords',
  'category',
  'date',
  'file',
  'url',
  'readTime',
  'relatedHome',
  'relatedGallery',
  'relatedVideos',
];

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms),
    ),
  ]);
}

function cleanSnippetText(rawText) {
  let text = String(rawText || '');
  if (!text) return '';

  // Decode a small set of common entities first.
  for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
    text = text.replaceAll(entity, replacement);
  }

  // Apply shared snippet cleanup patterns (UI artifacts, JSON-LD, frontmatter).
  text = CLEANUP_PATTERNS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    text,
  );

  // Remove full YAML frontmatter block.
  text = text.replace(/^\s*---\s*\n[\s\S]*?\n---\s*/m, ' ');

  // Remove inline frontmatter separators.
  text = text.replace(/\s+---\s+/g, ' ');

  // Drop metadata URL fields like "image: https://..."
  text = text.replace(
    /\b(?:image|thumbnail|file|url|source|loc)\s*:\s*https?:\/\/\S+/gi,
    ' ',
  );

  // Remove remaining bare URLs.
  text = text.replace(/https?:\/\/\S+/gi, ' ');

  // Remove metadata labels, keep human-readable value.
  const labelPattern = SNIPPET_METADATA_LABELS.join('|');
  text = text.replace(new RegExp(`\\b(?:${labelPattern})\\s*:`, 'gi'), ' ');

  // Strip markdown artifacts and normalize spacing.
  text = text.replace(/[`*_#]+/g, ' ');
  text = text.replace(/\(\s*[^)]{40,}\)/g, ' ');
  text = text.replace(/\(\s*[^)]*$/g, ' ');
  text = text.replace(/\(\s*\)/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/^[-,;:.!?|/\\\s]+/, '').trim();

  return text;
}

function trimSnippetLength(raw, maxLength = 180) {
  if (!raw) return '';
  if (raw.length <= maxLength) return raw;

  const truncated = raw.slice(0, maxLength);
  const lastSentenceBreak = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?'),
  );

  if (lastSentenceBreak > maxLength * 0.7) {
    return truncated.slice(0, lastSentenceBreak + 1).trim();
  }

  return `${truncated.trim()}...`;
}

function extractSnippet(item, maxLength = 180) {
  const mergedContent = Array.isArray(item?.content)
    ? item.content
        .map((chunk) =>
          typeof chunk?.text === 'string' ? chunk.text.trim() : '',
        )
        .filter(Boolean)
        .join(' ')
    : '';

  const fallbackText =
    typeof item?.text === 'string'
      ? item.text
      : typeof item?.description === 'string'
        ? item.description
        : '';

  const raw = cleanSnippetText(mergedContent || fallbackText || '');
  return trimSnippetLength(raw, maxLength);
}

function extractAiResult(item) {
  const rawPath =
    typeof item?.filename === 'string'
      ? item.filename
      : typeof item?.metadata?.filename === 'string'
        ? item.metadata.filename
        : typeof item?.url === 'string'
          ? item.url
          : '';

  const attrs =
    item?.attributes && typeof item.attributes === 'object'
      ? item.attributes
      : {};

  const url = normalizeUrl(rawPath);
  const fallbackTitle = extractTitle(rawPath, url);
  const title = chooseBestTitle(
    { title: attrs.title || item?.title },
    fallbackTitle,
    url,
  );
  const category =
    typeof attrs.category === 'string' && attrs.category.trim()
      ? attrs.category.trim()
      : detectCategory(url);
  const attrsDescription = trimSnippetLength(
    cleanSnippetText(
      typeof attrs.description === 'string' ? attrs.description : '',
    ),
    180,
  );
  const description =
    attrsDescription ||
    extractSnippet(item) ||
    buildFallbackDescription(url, title, category);
  const score = Number.isFinite(item?.score) ? Number(item.score) : 0;

  return {
    title,
    url,
    description,
    category,
    score,
  };
}

function isTechnicalResult(url) {
  const normalized = normalizeUrl(url).toLowerCase();
  if (TECHNICAL_RESULT_PATHS.has(normalized)) {
    return true;
  }

  return TECHNICAL_RESULT_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
}

function isAllowlistedResult(url) {
  const normalized = normalizeUrl(url).toLowerCase();
  if (ALLOW_ROOT_RESULT && normalized === '/') {
    return true;
  }

  return ALLOWED_RESULT_PREFIXES.some(
    (prefix) =>
      normalized === prefix ||
      normalized.startsWith(`${prefix}/`) ||
      normalized.startsWith(`${prefix}?`),
  );
}

function normalizeResultPathForDedup(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return '';
  if (normalized === '/') return normalized;
  return normalized.replace(/\/+$/, '');
}

function formatAiLinkTitle(title) {
  const cleaned = String(title || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (cleaned.length <= 56) return cleaned;
  return `${cleaned.slice(0, 53).trim()}...`;
}

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenizeQuery(query) {
  return normalizeForMatch(query)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 2 && !QUERY_STOPWORDS.has(token));
}

function hasAnyToken(tokens, variants = []) {
  return variants.some((variant) => tokens.includes(variant));
}

function buildQuerySignals(tokens) {
  return {
    gallery: hasAnyToken(tokens, [
      'galerie',
      'gallery',
      'foto',
      'fotos',
      'photo',
      'photography',
      'bilder',
      'street',
    ]),
    videos: hasAnyToken(tokens, [
      'video',
      'videos',
      'reel',
      'reels',
      'film',
      'filme',
    ]),
    blog: hasAnyToken(tokens, [
      'blog',
      'artikel',
      'post',
      'posts',
      'beitrag',
      'beitraege',
    ]),
    projects: hasAnyToken(tokens, [
      'projekt',
      'projekte',
      'project',
      'projects',
      'app',
      'apps',
    ]),
    about: hasAnyToken(tokens, [
      'about',
      'ueber',
      'uber',
      'profil',
      'bio',
      'kontakt',
      'contact',
    ]),
    home: hasAnyToken(tokens, ['start', 'home', 'hauptseite']),
  };
}

function scoreResultForQuery(item, index, queryTokens, querySignals) {
  const path = normalizeUrl(item?.url || '');
  const text = normalizeForMatch(
    `${item?.title || ''} ${item?.category || ''} ${item?.url || ''} ${
      item?.description || ''
    }`,
  );

  let score = Number.isFinite(item?.score) ? item.score * 10 : 0;
  score += Math.max(0, 8 - index);

  for (const token of queryTokens) {
    if (text.includes(token)) score += 2;
  }

  if (querySignals.gallery && path === '/gallery') score += 28;
  else if (querySignals.gallery && path.startsWith('/gallery')) score += 18;
  if (querySignals.videos && path === '/videos') score += 28;
  else if (querySignals.videos && path.startsWith('/videos')) score += 18;
  if (querySignals.blog && path === '/blog') score += 18;
  else if (querySignals.blog && path.startsWith('/blog')) score += 10;
  if (querySignals.projects && path === '/projekte') score += 20;
  else if (querySignals.projects && path.startsWith('/projekte')) score += 12;
  if (querySignals.about && path.startsWith('/about')) score += 10;
  if (querySignals.home && path === '/') score += 8;

  if (path === '/' && !querySignals.home) score -= 6;
  if (path.startsWith('/blog') && querySignals.gallery) score -= 10;
  if (path.startsWith('/blog') && querySignals.videos) score -= 10;

  return score;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractMarkdownLinks(text) {
  return String(text || '').match(/\[[^\]]+]\([^)]+\)/g) || [];
}

function protectMarkdownLinks(text) {
  const links = [];
  const protectedText = String(text || '').replace(
    /\[[^\]]+]\([^)]+\)/g,
    (match) => {
      const token = `__MD_LINK_${links.length}__`;
      links.push(match);
      return token;
    },
  );

  return {
    text: protectedText,
    links,
  };
}

function restoreMarkdownLinks(text, links = []) {
  let output = String(text || '');
  links.forEach((link, index) => {
    output = output.replace(`__MD_LINK_${index}__`, link);
  });
  return output;
}

function normalizeAiSummaryText(summary) {
  const raw = String(summary || '').trim();
  if (!raw) return '';

  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return '';

  const allLinesAreListItems = lines.every((line) =>
    /^(?:[-*]|\d+[.)])\s+/i.test(line),
  );
  const cleanedLines = lines.map((line) =>
    line.replace(/^(?:[-*]|\d+[.)])\s+/i, ''),
  );
  const delimiter = allLinesAreListItems ? ', ' : ' ';

  return cleanedLines.join(delimiter).replace(/\s+/g, ' ').trim();
}

function normalizeSentenceEnding(text) {
  const value = String(text || '').trim();
  if (!value) return value;
  if (/[.!?]$/.test(value)) return value;
  return `${value}.`;
}

function injectInlineLinks(summary, links = []) {
  const source = String(summary || '').trim();
  if (!source || !Array.isArray(links) || links.length === 0) {
    return source;
  }

  const protectedLinks = protectMarkdownLinks(source);
  let text = protectedLinks.text;

  for (const link of links) {
    const title = String(link?.title || '').trim();
    const rel = String(link?.url || '').trim();
    if (!title || !rel) continue;

    const abs = `https://www.abdulkerimsesli.de${rel}`;
    const relWithSlash = rel.endsWith('/') ? rel : `${rel}/`;
    const patterns = [abs, `${abs}/`, rel, relWithSlash];

    for (const variant of patterns) {
      const escaped = escapeRegExp(variant);

      // Quoted variants: "/videos/" or '/videos/'
      text = text.replace(
        new RegExp(`(["'])${escaped}\\1`, 'g'),
        `[${title}](${rel})`,
      );

      // Bare URL/path variants surrounded by boundaries.
      text = text.replace(
        new RegExp(`(^|[\\s(,:;])${escaped}(?=$|[\\s).,;:!?])`, 'g'),
        `$1[${title}](${rel})`,
      );
    }
  }

  return restoreMarkdownLinks(text, protectedLinks.links);
}

function buildInlineLinksSentence(links = [], prefix = 'Mehr dazu in') {
  if (!Array.isArray(links) || links.length === 0) return '';

  const markdownLinks = links.map((link) => `[${link.title}](${link.url})`);
  if (markdownLinks.length === 1) {
    return `${prefix} ${markdownLinks[0]}.`;
  }

  if (markdownLinks.length === 2) {
    return `${prefix} ${markdownLinks[0]} und ${markdownLinks[1]}.`;
  }

  const head = markdownLinks.slice(0, -1).join(', ');
  const tail = markdownLinks[markdownLinks.length - 1];
  return `${prefix} ${head} und ${tail}.`;
}

function buildAiChatLinks(results, query, maxLinks = MAX_AI_CHAT_LINKS) {
  if (!Array.isArray(results) || results.length === 0) return [];

  const queryTokens = tokenizeQuery(query);
  const querySignals = buildQuerySignals(queryTokens);
  const links = [];
  const seen = new Set();

  for (const [index, item] of results.entries()) {
    if (!item?.url) continue;

    const dedupeUrl = normalizeResultPathForDedup(item.url).toLowerCase();
    if (!dedupeUrl || seen.has(dedupeUrl)) continue;

    const title = formatAiLinkTitle(item.title);
    if (!title) continue;

    seen.add(dedupeUrl);
    links.push({
      title,
      url: normalizeUrl(item.url),
      priority: scoreResultForQuery(item, index, queryTokens, querySignals),
      rawScore: Number.isFinite(item.score) ? item.score : 0,
    });
  }

  links.sort((a, b) => b.priority - a.priority || b.rawScore - a.rawScore);
  return links.slice(0, maxLinks).map(({ title, url }) => ({ title, url }));
}

function isLowQualityAiSummary(summary) {
  const text = normalizeAiSummaryText(summary);
  if (!text || text.length < 32) return true;

  const markdownLinkCount = extractMarkdownLinks(text).length;
  if (text.length > 480) return true;
  if (markdownLinkCount > 4) return true;
  if (/website von/i.test(text)) return true;
  if (/abdulkerim sesli/i.test(text)) return true;
  if (/^sie können\b/i.test(text)) return true;
  if (/\bbesuch(?:e|en)\b/i.test(text)) return true;
  if (/\bkönnen sie\b/i.test(text)) return true;
  if (/eine vielzahl von funktionen/i.test(text)) return true;
  if (/^[-*]\s+/m.test(text)) return true;

  return false;
}

function buildResultBackedSummary(query, results = [], links = []) {
  if (!Array.isArray(results) || results.length === 0) {
    return '';
  }

  const rankedLinks = Array.isArray(links) ? links.slice(0, 2) : [];
  const selectedLinks =
    rankedLinks.length > 0
      ? rankedLinks
      : [
          {
            title: formatAiLinkTitle(results[0]?.title),
            url: normalizeUrl(results[0]?.url),
          },
        ].filter((entry) => entry.title && entry.url);
  if (selectedLinks.length === 0) return '';

  const linkParts = selectedLinks.map((link) => `[${link.title}](${link.url})`);
  const queryLabel = String(query || '').trim();
  let lead;
  if (linkParts.length === 1) {
    lead = queryLabel
      ? `Zu "${queryLabel}" passt besonders ${linkParts[0]}`
      : `Besonders passend ist ${linkParts[0]}`;
  } else {
    lead = queryLabel
      ? `Zu "${queryLabel}" sind ${linkParts[0]} und ${linkParts[1]} besonders relevant`
      : `${linkParts[0]} und ${linkParts[1]} sind besonders relevant`;
  }

  const primaryPath = normalizeResultPathForDedup(
    selectedLinks[0].url,
  ).toLowerCase();
  const primaryResult = results.find(
    (item) =>
      normalizeResultPathForDedup(item?.url).toLowerCase() === primaryPath,
  );
  const description = trimSnippetLength(
    cleanSnippetText(primaryResult?.description || ''),
    110,
  );
  if (!description) {
    return normalizeSentenceEnding(lead);
  }

  return `${normalizeSentenceEnding(lead)} ${normalizeSentenceEnding(description)}`.trim();
}

function buildAiChatMessage(summary, links = [], query = '', results = []) {
  let normalizedSummary = injectInlineLinks(
    normalizeAiSummaryText(summary),
    links,
  );
  if (isLowQualityAiSummary(normalizedSummary)) {
    normalizedSummary = buildResultBackedSummary(query, results, links);
  }

  if (!Array.isArray(links) || links.length === 0) {
    return normalizedSummary;
  }

  const markdownLinks = extractMarkdownLinks(normalizedSummary);
  const summaryLower = normalizedSummary.toLowerCase();
  const missingLinks = links.filter((link) => {
    const rel = String(link.url || '').toLowerCase();
    if (!rel) return false;
    if (!normalizedSummary) return true;
    if (
      markdownLinks.some((entry) => entry.toLowerCase().includes(`](${rel})`))
    ) {
      return false;
    }
    const abs = `https://www.abdulkerimsesli.de${rel}`.toLowerCase();
    return !summaryLower.includes(abs);
  });

  if (missingLinks.length === 0) {
    return normalizedSummary;
  }

  const currentLinkCount = markdownLinks.length;
  const neededLinks = Math.max(0, MAX_APPENDED_LINKS - currentLinkCount);
  if (neededLinks === 0) {
    return normalizedSummary;
  }

  const linksToAppend = missingLinks.slice(0, neededLinks);
  const linkSentence = buildInlineLinksSentence(
    linksToAppend,
    linksToAppend.length === 1 ? 'Direkt relevant ist' : 'Direkt relevant sind',
  );
  if (!normalizedSummary) {
    return linkSentence;
  }

  return `${normalizeSentenceEnding(normalizedSummary)} ${linkSentence}`.trim();
}

function buildFallbackAiMessage(resultsCount, links = []) {
  if (resultsCount <= 0) {
    return 'Keine passenden Inhalte gefunden.';
  }

  const linkSentence = buildInlineLinksSentence(
    links.slice(0, 2),
    'Direkt passend sind',
  );
  if (!linkSentence) {
    return `Ich habe ${resultsCount} passende Seiten gefunden.`;
  }

  return `Ich habe ${resultsCount} passende Seiten gefunden. ${linkSentence}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json().catch(() => ({}));
    const query = String(body?.query || '').trim();

    if (!query) {
      return Response.json({ results: [], count: 0 }, { headers: corsHeaders });
    }

    const aiSearchConfig = resolveAiSearchConfig(env);
    const topK = clampResults(
      body?.topK,
      aiSearchConfig.maxResults,
      aiSearchConfig.maxResults,
    );

    if (!env.AI || !env.RAG_ID) {
      console.warn('AI or RAG_ID not configured');
      return Response.json(
        { error: 'AI Search is not configured', results: [] },
        { status: 503, headers: corsHeaders },
      );
    }

    // Run AI Search
    const aiSearchRequest = buildAiSearchRequest({
      query,
      maxResults: topK,
      config: aiSearchConfig,
      systemPrompt: SYSTEM_PROMPT,
      stream: false,
      hybrid: true,
    });

    const searchResponse = await withTimeout(
      env.AI.autorag(env.RAG_ID).aiSearch(aiSearchRequest),
      SEARCH_TIMEOUT_MS,
    );

    let results = [];
    if (searchResponse?.data && Array.isArray(searchResponse.data)) {
      results = searchResponse.data.map(extractAiResult);
    }

    // Deduplicate results based on URL
    const uniqueResultsMap = new Map();
    for (const res of results) {
      if (isTechnicalResult(res.url) || !isAllowlistedResult(res.url)) {
        continue;
      }

      if (!uniqueResultsMap.has(res.url)) {
        uniqueResultsMap.set(res.url, res);
      } else {
        const existing = uniqueResultsMap.get(res.url);
        if (res.score > existing.score) {
          uniqueResultsMap.set(res.url, res);
        }
      }
    }
    const uniqueResults = Array.from(uniqueResultsMap.values()).sort(
      (a, b) => b.score - a.score,
    );

    const aiSummary = searchResponse?.response || '';
    const aiChatLinks = buildAiChatLinks(uniqueResults, query);
    const aiMessage = buildAiChatMessage(
      aiSummary,
      aiChatLinks,
      query,
      uniqueResults,
    );

    return Response.json(
      {
        results: uniqueResults,
        count: uniqueResults.length,
        summary: aiSummary,
        aiChat: {
          message:
            aiMessage ||
            buildFallbackAiMessage(uniqueResults.length, aiChatLinks),
          suggestions: [],
        },
      },
      {
        headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=300' },
      },
    );
  } catch (error) {
    console.error('Search error:', error);
    return Response.json(
      { error: 'Search failed', results: [] },
      { status: 500, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
