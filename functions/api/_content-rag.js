import { loadYouTubeVideos } from './_sitemap-data.js';

const BLOG_INDEX_PATH = '/pages/blog/posts/index.json';
const PROJECTS_INDEX_PATH = '/pages/projekte/apps-config.json';
const ABOUT_PAGE_PATH = '/pages/about/index.html';
const CONTENT_RAG_MANIFEST_KEY = 'robot-content-rag:manifest:v1';
const DEFAULT_CHUNK_MAX_CHARS = 900;
const DEFAULT_CHUNK_MIN_CHARS = 240;
const EMBEDDING_BATCH_SIZE = 20;
const VECTORIZE_BATCH_SIZE = 500;
const VECTORIZE_DELETE_BATCH_SIZE = 1000;
const CONTENT_RAG_MANIFEST_VERSION = 3;
const DEFAULT_RAG_QUERY_TOP_K = 6;

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function trimToLength(value, maxLength) {
  const text = normalizeWhitespace(value);
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

async function hashText(value) {
  const input = normalizeWhitespace(value);
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function removeFrontmatter(text) {
  return String(text || '').replace(/^---\n[\s\S]*?\n---\n?/m, '');
}

function stripMarkdown(text) {
  return removeFrontmatter(text)
    .replace(/```([\s\S]*?)```/g, (_match, code) => `\n${code}\n`)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[|]+/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripHtml(text) {
  const withoutBlocks = ['script', 'style'].reduce((current, tagName) => {
    let output = String(current || '');
    let searchOffset = 0;

    while (searchOffset < output.length) {
      const lower = output.toLowerCase();
      const start = lower.indexOf(`<${tagName}`, searchOffset);
      if (start === -1) break;

      const openEnd = lower.indexOf('>', start);
      if (openEnd === -1) {
        output = `${output.slice(0, start)} ${output.slice(start)}`;
        break;
      }

      const closeStart = lower.indexOf(`</${tagName}`, openEnd + 1);
      if (closeStart === -1) {
        output = `${output.slice(0, start)} ${output.slice(openEnd + 1)}`;
        break;
      }

      const closeEnd = lower.indexOf('>', closeStart);
      if (closeEnd === -1) {
        output = `${output.slice(0, start)} ${output.slice(closeStart)}`;
        break;
      }

      output = `${output.slice(0, start)} ${output.slice(closeEnd + 1)}`;
      searchOffset = start + 1;
    }

    return output;
  }, text);

  return String(withoutBlocks || '')
    .replace(
      /<\/(p|div|section|article|main|header|footer|ul|ol|li|br)>/gi,
      '\n',
    )
    .replace(/<(h[1-6])\b[^>]*>/gi, '\n## ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, ' and ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, ' ')
    .replace(/&gt;/gi, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseFrontmatter(text) {
  const source = String(text ?? '');
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { content: source, data: {} };

  const data = {};
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) data[key] = value;
  }

  return {
    content: source.slice(match[0].length),
    data,
  };
}

function splitSectionParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n+/)
    .map((part) => normalizeWhitespace(stripMarkdown(part)))
    .filter(Boolean);
}

function splitLongSegment(text, maxChars) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const sentences = normalized.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 1) {
    const parts = [];
    let offset = 0;
    while (offset < normalized.length) {
      parts.push(normalized.slice(offset, offset + maxChars).trim());
      offset += maxChars;
    }
    return parts.filter(Boolean);
  }

  const parts = [];
  let current = '';
  for (const sentence of sentences) {
    if (!sentence) continue;
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) parts.push(current);
    if (sentence.length > maxChars) {
      parts.push(...splitLongSegment(sentence, maxChars));
      current = '';
    } else {
      current = sentence;
    }
  }

  if (current) parts.push(current);
  return parts.filter(Boolean);
}

function splitMarkdownSections(markdown) {
  const content = removeFrontmatter(markdown).replace(/\r/g, '').trim();
  if (!content) return [];

  const sections = [];
  let currentTitle = 'Einleitung';
  let buffer = [];

  const pushSection = () => {
    const value = buffer.join('\n').trim();
    if (!value) return;
    sections.push({
      title: currentTitle,
      text: value,
    });
    buffer = [];
  };

  for (const line of content.split('\n')) {
    const headingMatch = line.match(/^#{2,4}\s+(.+)$/);
    if (headingMatch) {
      pushSection();
      currentTitle = normalizeWhitespace(stripMarkdown(headingMatch[1]));
      continue;
    }
    buffer.push(line);
  }

  pushSection();
  return sections;
}

function slugifyId(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function buildVectorId(documentId, chunkIndex) {
  const suffix = `-${chunkIndex}`;
  const base = `rag-${documentId}`;
  const trimmedBase = base.slice(0, Math.max(1, 64 - suffix.length));
  return `${trimmedBase}${suffix}`;
}

function buildChunkText(document, sectionTitle, chunkText) {
  return [
    `${document.sourceLabel}: ${document.title}`,
    document.category ? `Kategorie: ${document.category}` : '',
    document.date ? `Datum: ${document.date}` : '',
    document.tagsText ? `Tags: ${document.tagsText}` : '',
    sectionTitle ? `Abschnitt: ${sectionTitle}` : '',
    document.summary ? `Kurzfassung: ${document.summary}` : '',
    chunkText,
  ]
    .filter(Boolean)
    .join('\n');
}

function chunkDocument(document, rawText, options = {}) {
  const maxChars = options.maxChars || DEFAULT_CHUNK_MAX_CHARS;
  const minChars = options.minChars || DEFAULT_CHUNK_MIN_CHARS;
  const sections = splitMarkdownSections(rawText);
  const chunks = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const sectionTitle = normalizeWhitespace(section.title || 'Inhalt');
    const paragraphSegments = splitSectionParagraphs(section.text).flatMap(
      (paragraph) => splitLongSegment(paragraph, maxChars),
    );

    let currentParts = [];
    let currentLength = 0;
    const flushChunk = () => {
      const chunkText = normalizeWhitespace(currentParts.join(' '));
      if (!chunkText) return;
      chunks.push({
        id: buildVectorId(document.documentId, chunkIndex),
        documentId: document.documentId,
        sourceType: document.sourceType,
        title: document.title,
        url: document.url,
        section: sectionTitle,
        snippet: trimToLength(chunkText, 240),
        content: chunkText,
        tagsText: document.tagsText,
        date: document.date,
        category: document.category,
        embeddingText: buildChunkText(document, sectionTitle, chunkText),
      });
      chunkIndex += 1;
      currentParts = [];
      currentLength = 0;
    };

    for (const segment of paragraphSegments) {
      const candidateLength = currentLength + segment.length + 1;
      if (
        currentParts.length > 0 &&
        candidateLength > maxChars &&
        currentLength >= minChars
      ) {
        flushChunk();
      }

      currentParts.push(segment);
      currentLength += segment.length + 1;
    }

    flushChunk();
  }

  return chunks;
}

function buildProjectMarkdown(project) {
  const caseStudy = project.caseStudy || {};
  const sections = [
    '## Projektüberblick',
    project.description || '',
    Array.isArray(project.tags) && project.tags.length > 0
      ? `Tags: ${project.tags.join(', ')}`
      : '',
    caseStudy.problem ? `## Problem\n${caseStudy.problem}` : '',
    caseStudy.solution ? `## Lösung\n${caseStudy.solution}` : '',
    Array.isArray(caseStudy.techStack) && caseStudy.techStack.length > 0
      ? `## Tech-Stack\n${caseStudy.techStack.join(', ')}`
      : '',
    caseStudy.results ? `## Ergebnis\n${caseStudy.results}` : '',
  ];

  return sections.filter(Boolean).join('\n\n');
}

async function loadJsonFile(env, requestUrl, path) {
  if (!env?.ASSETS) return null;
  const response = await env.ASSETS.fetch(new URL(path, requestUrl));
  if (!response.ok) return null;
  return await response.json();
}

async function loadTextFile(env, requestUrl, path) {
  if (!env?.ASSETS) return '';
  const response = await env.ASSETS.fetch(new URL(path, requestUrl));
  if (!response.ok) return '';
  return await response.text();
}

function buildVideoMarkdown(video) {
  return [
    '## Video',
    video.description || '',
    video.channelTitle ? `Kanal: ${video.channelTitle}` : '',
    video.publishedAt ? `Veröffentlicht: ${video.publishedAt}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function loadAboutDocuments(context) {
  const html = await loadTextFile(
    context.env,
    context.request.url,
    ABOUT_PAGE_PATH,
  );
  if (!html) return [];

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const descriptionMatch = html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
  );
  const dateMatch = html.match(
    /<meta\s+name=["']dateCreated["']\s+content=["']([^"']+)["']/i,
  );
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const rawText = stripHtml(mainMatch?.[1] || html);
  if (!rawText) return [];

  return [
    {
      documentId: 'about-profile',
      sourceType: 'about',
      sourceLabel: 'Profil',
      title: normalizeWhitespace(titleMatch?.[1] || 'Über Abdulkerim Sesli'),
      url: '/about/',
      summary: normalizeWhitespace(descriptionMatch?.[1]),
      category: 'profil',
      date: normalizeWhitespace(dateMatch?.[1]),
      tagsText: 'about, profil, tech stack, projects, career, berlin',
      rawText,
    },
  ];
}

async function loadBlogDocuments(context) {
  const entries = await loadJsonFile(
    context.env,
    context.request.url,
    BLOG_INDEX_PATH,
  );
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const posts = await Promise.all(
    entries.map(async (entry) => {
      if (!entry?.id || !entry?.file) return null;

      const markdown = await loadTextFile(
        context.env,
        context.request.url,
        entry.file,
      );
      if (!markdown) return null;

      const { content, data } = parseFrontmatter(markdown);
      const title =
        normalizeWhitespace(data.title || entry.title || entry.id) || entry.id;
      const excerpt = normalizeWhitespace(
        data.excerpt || entry.excerpt || data.seoDescription,
      );
      const category = normalizeWhitespace(data.category || entry.category);
      const tagsText = normalizeWhitespace(data.keywords || entry.keywords);

      return {
        documentId: `blog-${slugifyId(entry.id)}`,
        sourceType: 'blog',
        sourceLabel: 'Blogpost',
        title,
        url: `/blog/${encodeURIComponent(entry.id)}/`,
        summary: excerpt,
        category,
        date: normalizeWhitespace(data.date || entry.date),
        tagsText,
        rawText: content,
      };
    }),
  );

  return posts.filter(Boolean);
}

async function loadProjectDocuments(context) {
  const projectConfig = await loadJsonFile(
    context.env,
    context.request.url,
    PROJECTS_INDEX_PATH,
  );
  const apps = Array.isArray(projectConfig?.apps) ? projectConfig.apps : [];
  if (!apps.length) return [];

  return apps
    .map((project) => {
      const slug = slugifyId(project.name || project.title);
      if (!slug) return null;

      return {
        documentId: `project-${slug}`,
        sourceType: 'project',
        sourceLabel: 'Projekt',
        title: normalizeWhitespace(project.title || project.name || slug),
        url: `/projekte/${encodeURIComponent(project.name || slug)}/`,
        summary: normalizeWhitespace(project.description),
        category: normalizeWhitespace(project.category),
        date: '',
        tagsText: Array.isArray(project.tags)
          ? project.tags.map((tag) => normalizeWhitespace(tag)).join(', ')
          : '',
        rawText: buildProjectMarkdown(project),
      };
    })
    .filter(Boolean);
}

async function loadVideoDocuments(context) {
  const videos = await loadYouTubeVideos(context.env, 24).catch(() => []);
  if (!Array.isArray(videos) || videos.length === 0) return [];

  return videos
    .map((video) => {
      const videoId = normalizeWhitespace(video.videoId);
      if (!videoId) return null;

      return {
        documentId: `video-${slugifyId(videoId)}`,
        sourceType: 'video',
        sourceLabel: 'Video',
        title: normalizeWhitespace(video.title || `Video ${videoId}`),
        url: normalizeWhitespace(
          video.path || `/videos/${encodeURIComponent(videoId)}/`,
        ),
        summary: trimToLength(video.description, 220),
        category: 'youtube',
        date: normalizeWhitespace(video.publishedAt),
        tagsText: normalizeWhitespace(
          ['video', 'youtube', video.channelTitle].filter(Boolean).join(', '),
        ),
        rawText: buildVideoMarkdown(video),
      };
    })
    .filter(Boolean);
}

export async function buildSiteContentCorpus(context) {
  const [blogDocuments, projectDocuments, aboutDocuments, videoDocuments] =
    await Promise.all([
      loadBlogDocuments(context),
      loadProjectDocuments(context),
      loadAboutDocuments(context),
      loadVideoDocuments(context),
    ]);

  const documents = [
    ...blogDocuments,
    ...projectDocuments,
    ...aboutDocuments,
    ...videoDocuments,
  ];
  const chunks = documents.flatMap((document) =>
    chunkDocument(document, document.rawText),
  );

  const sourceBreakdown = documents.reduce(
    (acc, document) => {
      acc.documents[document.sourceType] =
        (acc.documents[document.sourceType] || 0) + 1;
      return acc;
    },
    { documents: {}, chunks: {} },
  );

  for (const chunk of chunks) {
    sourceBreakdown.chunks[chunk.sourceType] =
      (sourceBreakdown.chunks[chunk.sourceType] || 0) + 1;
  }

  return {
    documents,
    chunks,
    sourceBreakdown,
  };
}

async function buildDocumentHashes(documents) {
  const pairs = await Promise.all(
    documents.map(async (document) => {
      const hash = await hashText(
        JSON.stringify({
          sourceType: document.sourceType,
          title: document.title,
          url: document.url,
          summary: document.summary,
          category: document.category,
          date: document.date,
          tagsText: document.tagsText,
          rawText: document.rawText,
        }),
      );

      return [document.documentId, hash];
    }),
  );

  return new Map(pairs);
}

export async function readContentRagManifest(env) {
  if (!env?.SITEMAP_CACHE_KV) return null;
  try {
    return await env.SITEMAP_CACHE_KV.get(CONTENT_RAG_MANIFEST_KEY, 'json');
  } catch {
    return null;
  }
}

async function writeContentRagManifest(env, manifest) {
  if (!env?.SITEMAP_CACHE_KV) return false;
  await env.SITEMAP_CACHE_KV.put(
    CONTENT_RAG_MANIFEST_KEY,
    JSON.stringify(manifest),
  );
  return true;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function indexChunksByDocument(chunks) {
  const byDocument = new Map();

  for (const chunk of chunks) {
    const existing = byDocument.get(chunk.documentId);
    if (existing) {
      existing.push(chunk);
      continue;
    }
    byDocument.set(chunk.documentId, [chunk]);
  }

  return byDocument;
}

function buildManifestDocuments(
  documents,
  chunksByDocument,
  documentHashes,
  previousManifest,
  syncedAt,
) {
  const entries = {};
  const previousDocuments =
    previousManifest?.documents &&
    typeof previousManifest.documents === 'object'
      ? previousManifest.documents
      : {};

  for (const document of documents) {
    const documentChunks = chunksByDocument.get(document.documentId) || [];
    const previousEntry = previousDocuments[document.documentId];
    const currentHash = documentHashes.get(document.documentId) || '';
    entries[document.documentId] = {
      hash: currentHash,
      sourceType: document.sourceType,
      title: document.title,
      url: document.url,
      chunkIds: documentChunks.map((chunk) => chunk.id),
      chunkCount: documentChunks.length,
      updatedAt:
        previousEntry?.hash === currentHash && previousEntry?.updatedAt
          ? previousEntry.updatedAt
          : syncedAt,
    };
  }

  return entries;
}

function getChangedDocumentIds(documents, documentHashes, previousManifest) {
  const previousDocuments =
    previousManifest?.documents &&
    typeof previousManifest.documents === 'object'
      ? previousManifest.documents
      : {};

  return documents
    .filter((document) => {
      const previousEntry = previousDocuments[document.documentId];
      const currentHash = documentHashes.get(document.documentId) || '';
      return previousEntry?.hash !== currentHash;
    })
    .map((document) => document.documentId);
}

async function embedCorpusChunks(env, chunks, embeddingModel) {
  const vectors = [];

  for (const batch of chunkArray(chunks, EMBEDDING_BATCH_SIZE)) {
    const response = await env.AI.run(embeddingModel, {
      text: batch.map((item) => item.embeddingText),
    });
    const embeddings = Array.isArray(response?.data) ? response.data : [];

    if (embeddings.length !== batch.length) {
      throw new Error('Embedding result count mismatch');
    }

    for (const [index, item] of batch.entries()) {
      const values = embeddings[index];
      if (!Array.isArray(values) || values.length === 0) {
        throw new Error(`Invalid embedding for ${item.id}`);
      }

      vectors.push({
        id: item.id,
        values,
        metadata: {
          documentId: item.documentId,
          sourceType: item.sourceType,
          title: item.title,
          url: item.url,
          section: item.section,
          snippet: item.snippet,
          content: item.content,
          category: item.category || '',
          tags: item.tagsText || '',
          date: item.date || '',
        },
      });
    }
  }

  return vectors;
}

async function deleteStaleVectors(index, ids) {
  let deleted = 0;
  for (const batch of chunkArray(ids, VECTORIZE_DELETE_BATCH_SIZE)) {
    await index.deleteByIds(batch);
    deleted += batch.length;
  }
  return deleted;
}

export async function getSiteContentRagContext(query, env, options = {}) {
  const normalizedQuery = normalizeWhitespace(query);
  if (!normalizedQuery) {
    return {
      query: '',
      count: 0,
      matches: [],
    };
  }

  if (!env?.AI) {
    throw new Error('AI binding is missing');
  }
  if (
    !env?.ROBOT_CONTENT_RAG ||
    typeof env.ROBOT_CONTENT_RAG.query !== 'function'
  ) {
    throw new Error('ROBOT_CONTENT_RAG query is unavailable');
  }

  const embeddingModel =
    env.ROBOT_EMBEDDING_MODEL || '@cf/baai/bge-base-en-v1.5';
  const embeddingResult = await env.AI.run(embeddingModel, {
    text: [normalizedQuery],
  });
  const vector = Array.isArray(embeddingResult?.data)
    ? embeddingResult.data[0]
    : null;

  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error('Failed to create query embedding');
  }

  const topK = Math.max(
    1,
    Math.min(20, Number(options.topK || DEFAULT_RAG_QUERY_TOP_K)),
  );
  const queryResult = await env.ROBOT_CONTENT_RAG.query(vector, {
    topK,
    returnMetadata: 'all',
  });
  const rawMatches = Array.isArray(queryResult?.matches)
    ? queryResult.matches
    : [];

  return {
    query: normalizedQuery,
    count: rawMatches.length,
    matches: rawMatches.map((match) => ({
      id: String(match?.id || ''),
      score: Number(match?.score || 0),
      metadata:
        match?.metadata && typeof match.metadata === 'object'
          ? match.metadata
          : {},
    })),
  };
}

export async function syncSiteContentRag(context, options = {}) {
  const { env } = context;
  if (!env?.AI) {
    throw new Error('AI binding is missing');
  }
  if (!env?.ROBOT_CONTENT_RAG) {
    throw new Error('ROBOT_CONTENT_RAG binding is missing');
  }

  const corpus = await buildSiteContentCorpus(context);
  if (!corpus.chunks.length) {
    throw new Error('No website content found for RAG sync');
  }

  const previousManifest = await readContentRagManifest(env);
  const documentHashes = await buildDocumentHashes(corpus.documents);
  const forceReindex = Boolean(options.forceReindex);
  const changedDocumentIds = forceReindex
    ? corpus.documents.map((document) => document.documentId)
    : getChangedDocumentIds(corpus.documents, documentHashes, previousManifest);
  const changedDocumentSet = new Set(changedDocumentIds);
  const chunksByDocument = indexChunksByDocument(corpus.chunks);
  const changedChunks = corpus.chunks.filter((chunk) =>
    changedDocumentSet.has(chunk.documentId),
  );

  const embeddingModel =
    env.ROBOT_EMBEDDING_MODEL || '@cf/baai/bge-base-en-v1.5';
  const vectors =
    changedChunks.length > 0
      ? await embedCorpusChunks(env, changedChunks, embeddingModel)
      : [];

  if (vectors.length > 0) {
    for (const batch of chunkArray(vectors, VECTORIZE_BATCH_SIZE)) {
      await env.ROBOT_CONTENT_RAG.upsert(batch);
    }
  }

  const currentIds = corpus.chunks.map((chunk) => chunk.id);
  const staleIds = Array.isArray(previousManifest?.ids)
    ? previousManifest.ids.filter((id) => !currentIds.includes(id))
    : [];

  const deletedCount =
    staleIds.length > 0
      ? await deleteStaleVectors(env.ROBOT_CONTENT_RAG, staleIds)
      : 0;

  const previousDocumentIds =
    previousManifest?.documents &&
    typeof previousManifest.documents === 'object'
      ? Object.keys(previousManifest.documents)
      : [];
  const currentDocumentIdSet = new Set(
    corpus.documents.map((document) => document.documentId),
  );
  const deletedDocumentCount = previousDocumentIds.filter(
    (documentId) => !currentDocumentIdSet.has(documentId),
  ).length;
  const syncedAt = new Date().toISOString();
  const manifestDocuments = buildManifestDocuments(
    corpus.documents,
    chunksByDocument,
    documentHashes,
    previousManifest,
    syncedAt,
  );

  const manifest = {
    version: CONTENT_RAG_MANIFEST_VERSION,
    syncedAt,
    embeddingModel,
    documentCount: corpus.documents.length,
    chunkCount: corpus.chunks.length,
    ids: currentIds,
    documents: manifestDocuments,
    sourceBreakdown: corpus.sourceBreakdown,
    deletedCount,
    forceReindex,
    changedDocumentCount: changedDocumentIds.length,
    unchangedDocumentCount: corpus.documents.length - changedDocumentIds.length,
    deletedDocumentCount,
    upsertedChunkCount: vectors.length,
    reusedChunkCount: corpus.chunks.length - changedChunks.length,
  };

  await writeContentRagManifest(env, manifest);

  const indexInfo = await env.ROBOT_CONTENT_RAG.describe().catch(() => null);

  return {
    ok: true,
    ...manifest,
    indexInfo,
  };
}
