import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSystemPrompt } from '../functions/api/_ai-prompts.js';
import {
  getSiteContentRagContext,
  syncSiteContentRag,
} from '../functions/api/_content-rag.js';

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function textResponse(value) {
  return new Response(value, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

function buildAssets(files) {
  return {
    async fetch(url) {
      const path = new URL(url).pathname;
      if (!files.has(path)) {
        return new Response('not found', { status: 404 });
      }
      const value = files.get(path);
      return typeof value === 'string'
        ? textResponse(value)
        : jsonResponse(value);
    },
  };
}

function buildEmbedding(text) {
  const normalized = String(text || '');
  let checksum = 0;
  for (const char of normalized) {
    checksum = (checksum + char.charCodeAt(0)) % 997;
  }
  return [normalized.length, checksum, normalized.split(/\s+/).length];
}

function createCorpusFiles({
  blogBody = 'Erste Version des Artikels.',
  includeProject = true,
} = {}) {
  return new Map([
    [
      '/pages/blog/posts/index.json',
      [
        {
          id: 'react-no-build',
          file: '/pages/blog/posts/react-no-build.md',
          title: 'React No Build',
        },
      ],
    ],
    [
      '/pages/blog/posts/react-no-build.md',
      `---
title: React No Build
excerpt: Buildless React
category: frontend
date: 2026-03-10
keywords: react, buildless
---

## These
${blogBody}

## Haltung
Web Components bleiben situativ spannend.`,
    ],
    [
      '/pages/projekte/apps-config.json',
      {
        apps: includeProject
          ? [
              {
                name: 'robot',
                title: 'Robot',
                description: 'Projektbeschreibung',
                tags: ['ai', 'ui'],
                caseStudy: {
                  problem: 'Fragen beantworten',
                  solution: 'RAG',
                  results: 'besser',
                },
              },
            ]
          : [],
      },
    ],
  ]);
}

function createSyncEnv(files) {
  const manifestStore = new Map();
  const vectorStore = new Map();

  return {
    env: {
      ASSETS: buildAssets(files),
      AI: {
        async run(_model, payload) {
          return { data: payload.text.map(buildEmbedding) };
        },
      },
      ROBOT_CONTENT_RAG: {
        async upsert(vectors) {
          for (const vector of vectors) {
            vectorStore.set(vector.id, vector);
          }
        },
        async deleteByIds(ids) {
          for (const id of ids) {
            vectorStore.delete(id);
          }
        },
        async describe() {
          return { vectorCount: vectorStore.size };
        },
      },
      SITEMAP_CACHE_KV: {
        async get(key, type) {
          if (!manifestStore.has(key)) return null;
          const value = manifestStore.get(key);
          return type === 'json' ? JSON.parse(value) : value;
        },
        async put(key, value) {
          manifestStore.set(key, value);
        },
      },
    },
  };
}

test('content RAG prefers blog sources for opinion queries and exposes source links', async () => {
  const queryCalls = [];
  const result = await getSiteContentRagContext(
    'Wie denkt Abdulkerim über Web Components?',
    {
      AI: {
        async run(_model, payload) {
          return { data: payload.text.map(buildEmbedding) };
        },
      },
      ROBOT_CONTENT_RAG: {
        async query(_vector, options) {
          queryCalls.push(options);
          assert.deepEqual(options.filter, { sourceType: 'blog' });

          return {
            matches: [
              {
                id: 'rag-blog-1',
                score: 0.71,
                metadata: {
                  documentId: 'blog-web-components-zukunft',
                  sourceType: 'blog',
                  title: 'Web Components Zukunft',
                  url: '/blog/web-components-zukunft/',
                  section: 'Haltung',
                  content:
                    'Ich nutze Web Components gezielt für langlebige Standards und bleibe sonst pragmatisch bei React.',
                  snippet:
                    'Web Components für Standards, React für Produkt-Apps.',
                  category: 'frontend',
                  tags: 'web components, standards',
                  date: '2026-03-10',
                },
              },
            ],
          };
        },
      },
    },
  );

  assert.equal(queryCalls.length, 1);
  assert.equal(result.retrievalMode, 'metadata-filter:blog');
  assert.deepEqual(result.sources, [
    {
      title: 'Web Components Zukunft',
      url: '/blog/web-components-zukunft/',
      sourceType: 'blog',
      date: '2026-03-10',
    },
  ]);
  assert.match(
    result.prompt,
    /\[Web Components Zukunft\]\(\/blog\/web-components-zukunft\/\)/,
  );

  const systemPrompt = buildSystemPrompt('', '', {
    userRole: 'guest',
    availableTools: [],
    ragSources: result.sources,
  });
  assert.match(systemPrompt, /\*\*QUELLENREGEL FÜR WEBSITE-ANTWORTEN:\*\*/);
  assert.match(
    systemPrompt,
    /\[Web Components Zukunft\]\(\/blog\/web-components-zukunft\/\)/,
  );
});

test('content RAG falls back to unfiltered retrieval when metadata filtering is unavailable', async () => {
  const queryCalls = [];
  const result = await getSiteContentRagContext(
    'Welches Projekt nutzt Web Components?',
    {
      AI: {
        async run(_model, payload) {
          return { data: payload.text.map(buildEmbedding) };
        },
      },
      ROBOT_CONTENT_RAG: {
        async query(_vector, options) {
          queryCalls.push(options);
          if (options.filter?.sourceType === 'project') {
            throw new Error('metadata index missing');
          }

          return {
            matches: [
              {
                id: 'rag-project-1',
                score: 0.77,
                metadata: {
                  documentId: 'project-design-system',
                  sourceType: 'project',
                  title: 'Design System',
                  url: '/projekte/design-system/',
                  section: 'Projektüberblick',
                  content:
                    'Komponentenbibliothek mit Web Components und React-Wrappern.',
                  snippet: 'Komponentenbibliothek mit Web Components.',
                  category: 'frontend',
                  tags: 'web components, react',
                  date: '',
                },
              },
            ],
          };
        },
      },
    },
  );

  assert.equal(queryCalls.length, 2);
  assert.deepEqual(queryCalls[0].filter, { sourceType: 'project' });
  assert.equal(queryCalls[1].filter, undefined);
  assert.equal(result.retrievalMode, 'fallback-unfiltered:project');
  assert.equal(result.sources[0].url, '/projekte/design-system/');
});

test('content RAG force reindex re-embeds unchanged documents', async () => {
  const state = createSyncEnv(createCorpusFiles());
  const request = new Request('https://example.com/');

  const first = await syncSiteContentRag({ env: state.env, request });
  const second = await syncSiteContentRag({ env: state.env, request });
  const forced = await syncSiteContentRag(
    { env: state.env, request },
    { forceReindex: true },
  );

  assert.equal(first.changedDocumentCount, 2);
  assert.equal(second.changedDocumentCount, 0);
  assert.equal(second.upsertedChunkCount, 0);
  assert.equal(forced.changedDocumentCount, 2);
  assert.equal(forced.forceReindex, true);
  assert.ok(forced.upsertedChunkCount > 0);
});
