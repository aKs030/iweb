import {
  getSiteContentRagContext,
  readContentRagManifest,
  syncSiteContentRag,
} from '../_content-rag.js';
import { errorJsonResponse, jsonResponse } from '../_response.js';
import { CACHE_CONTROL_NO_STORE } from '../../_shared/http-headers.js';

const NO_STORE_HEADERS = {
  'Cache-Control': CACHE_CONTROL_NO_STORE,
};

function getRuntimeInfo(env) {
  return {
    branch: String(env?.CF_PAGES_BRANCH || '').trim(),
    commitSha: String(env?.CF_PAGES_COMMIT_SHA || '').trim(),
    pagesUrl: String(env?.CF_PAGES_URL || '').trim(),
  };
}

function parseBooleanFlag(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function authorize(request, env) {
  const expectedToken = String(env?.ADMIN_TOKEN || '').trim();
  if (!expectedToken) {
    return {
      ok: false,
      response: errorJsonResponse(
        {
          error: 'Admin configuration error: ADMIN_TOKEN is missing',
        },
        {
          status: 500,
          headers: NO_STORE_HEADERS,
        },
      ),
    };
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${expectedToken}`) {
    return {
      ok: false,
      response: errorJsonResponse(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: NO_STORE_HEADERS,
        },
      ),
    };
  }

  return { ok: true, response: null };
}

export async function onRequestGet(context) {
  const auth = authorize(context.request, context.env);
  if (!auth.ok) return auth.response;
  const url = new URL(context.request.url);
  const query = String(
    url.searchParams.get('query') || url.searchParams.get('q') || '',
  ).trim();

  if (query) {
    try {
      const retrieval = await getSiteContentRagContext(query, context.env);
      return jsonResponse(
        {
          ok: true,
          query,
          retrieval,
          runtime: getRuntimeInfo(context.env),
          checkedAt: new Date().toISOString(),
        },
        { headers: NO_STORE_HEADERS },
      );
    } catch (error) {
      return errorJsonResponse(
        {
          ok: false,
          query,
          error: error?.message || 'content_rag_query_failed',
        },
        {
          status: 500,
          headers: NO_STORE_HEADERS,
        },
      );
    }
  }

  let indexInfo = null;
  if (context.env?.ROBOT_CONTENT_RAG?.describe) {
    try {
      indexInfo = await context.env.ROBOT_CONTENT_RAG.describe();
    } catch (error) {
      indexInfo = {
        error: error?.message || 'describe_failed',
      };
    }
  }

  const manifest = await readContentRagManifest(context.env);

  return jsonResponse(
    {
      ok: true,
      configured: Boolean(context.env?.AI && context.env?.ROBOT_CONTENT_RAG),
      manifest,
      indexInfo,
      runtime: getRuntimeInfo(context.env),
      checkedAt: new Date().toISOString(),
    },
    { headers: NO_STORE_HEADERS },
  );
}

export async function onRequestPost(context) {
  const auth = authorize(context.request, context.env);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(context.request.url);
    const forceReindex =
      parseBooleanFlag(url.searchParams.get('full')) ||
      parseBooleanFlag(url.searchParams.get('force')) ||
      parseBooleanFlag(url.searchParams.get('reindex'));
    const result = await syncSiteContentRag(context, {
      forceReindex,
    });
    return jsonResponse(
      {
        ...result,
        forceReindex,
        runtime: getRuntimeInfo(context.env),
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return errorJsonResponse(
      {
        ok: false,
        error: error?.message || 'content_rag_sync_failed',
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }
}
