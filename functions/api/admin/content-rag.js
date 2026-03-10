import { readContentRagManifest, syncSiteContentRag } from '../_content-rag.js';

function getJsonHeaders() {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
}

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
      response: new Response(
        JSON.stringify({
          error: 'Admin configuration error: ADMIN_TOKEN is missing',
        }),
        {
          status: 500,
          headers: getJsonHeaders(),
        },
      ),
    };
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${expectedToken}`) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: getJsonHeaders(),
      }),
    };
  }

  return { ok: true, response: null };
}

export async function onRequestGet(context) {
  const auth = authorize(context.request, context.env);
  if (!auth.ok) return auth.response;

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

  return new Response(
    JSON.stringify({
      ok: true,
      configured: Boolean(context.env?.AI && context.env?.ROBOT_CONTENT_RAG),
      manifest,
      indexInfo,
      runtime: getRuntimeInfo(context.env),
      checkedAt: new Date().toISOString(),
    }),
    {
      headers: getJsonHeaders(),
    },
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
    return new Response(
      JSON.stringify({
        ...result,
        forceReindex,
        runtime: getRuntimeInfo(context.env),
      }),
      {
        headers: getJsonHeaders(),
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || 'content_rag_sync_failed',
      }),
      {
        status: 500,
        headers: getJsonHeaders(),
      },
    );
  }
}
