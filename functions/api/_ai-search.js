/**
 * Cloudflare AI Search compatibility layer.
 * Supports both legacy and newer AutoRAG method names/response shapes.
 */

function normalizeSearchItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const filename =
    item.filename || item.url || item.path || item.source || item.id || '';

  const scoreCandidates = [
    item.score,
    item.similarity,
    item.relevance,
    item.rank,
  ];
  const score =
    scoreCandidates.find((candidate) => Number.isFinite(candidate)) || 0;

  const content = Array.isArray(item.content)
    ? item.content
    : typeof item.content === 'string'
      ? [{ text: item.content }]
      : Array.isArray(item.chunks)
        ? item.chunks.map((chunk) =>
            typeof chunk === 'string'
              ? { text: chunk }
              : { text: chunk?.text || '' },
          )
        : [];

  return {
    ...item,
    filename,
    score,
    content,
    text: item.text || item.snippet || item.description || '',
  };
}

export async function performAutoRagSearch(env, options) {
  const ragId = options.ragId || env.RAG_ID || 'wispy-pond-1055';

  if (!env.AI || typeof env.AI.autorag !== 'function') {
    throw new Error('AI binding not configured');
  }

  const rag = env.AI.autorag(ragId);
  const payload = {
    query: options.query,
    max_num_results: options.maxResults,
    rewrite_query: options.rewriteQuery,
    stream: options.stream ?? false,
  };

  if (options.systemPrompt) {
    payload.system_prompt = options.systemPrompt;
  }

  const methodNames = ['aiSearch', 'search', 'query'];
  let rawResponse = null;
  let lastError = null;

  for (const methodName of methodNames) {
    const candidate = rag?.[methodName];
    if (typeof candidate !== 'function') {
      continue;
    }

    try {
      rawResponse = await candidate.call(rag, payload);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!rawResponse) {
    if (lastError) {
      throw lastError;
    }
    throw new Error('No compatible AutoRAG search method found');
  }

  const responseData = Array.isArray(rawResponse?.data)
    ? rawResponse.data
    : Array.isArray(rawResponse?.results)
      ? rawResponse.results
      : Array.isArray(rawResponse?.documents)
        ? rawResponse.documents
        : [];

  return {
    summary:
      rawResponse?.response ||
      rawResponse?.summary ||
      rawResponse?.answer ||
      '',
    data: responseData.map(normalizeSearchItem).filter(Boolean),
    rawResponse,
  };
}
