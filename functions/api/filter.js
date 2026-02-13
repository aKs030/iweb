import { getCorsHeaders, handleOptions } from './_cors.js';

/**
 * Filter API Endpoint
 * Uses RAG_ID from wrangler.toml and Vectorize to filter specific categories.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json().catch(() => ({}));
    const { query, category, limit } = body;
    const ragId = env.RAG_ID; // Used for context/logging or metadata filter if applicable

    if (!category) {
      return new Response(
        JSON.stringify({ error: 'Category is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!env.VECTOR_INDEX) {
      return new Response(
        JSON.stringify({ error: 'VECTOR_INDEX not configured' }),
        { status: 503, headers: corsHeaders }
      );
    }

    if (!env.AI) {
      return new Response(
        JSON.stringify({ error: 'AI binding not configured for embeddings' }),
        { status: 503, headers: corsHeaders }
      );
    }

    // 1. Generate Embedding for the query (or a default vector if no query)
    // Using a standard model consistent with common RAG setups
    const model = '@cf/baai/bge-base-en-v1.5';
    let vector;

    if (query) {
      const embeddings = await env.AI.run(model, { text: query });
      vector = embeddings.data[0];
    } else {
      // If no query, we can't easily "list all" in vector DB without a vector.
      // We'll use a neutral query to find "relevant" items in that category,
      // or if the vector DB supports it, a zero vector (though cosine sim might fail).
      // Best approach: Query for the category name itself to find semantically related items.
      const embeddings = await env.AI.run(model, { text: category });
      vector = embeddings.data[0];
    }

    // 2. Prepare Metadata Filter
    // We filter strictly by the requested category.
    // We also verify against RAG_ID if the index relies on it for tenancy.
    // Since we don't know the exact schema, we'll start with just category,
    // but log the RAG_ID usage.
    const filter = { category: category };

    // Optimistic filter: if the index has rag_id in metadata, we could add:
    if (ragId) filter.rag_id = ragId;

    // 3. Query Vector Index
    const matches = await env.VECTOR_INDEX.query(vector, {
      topK: limit || 10,
      filter: filter,
      returnMetadata: true
    });

    // 4. Format Results
    const results = matches.matches.map(match => ({
      score: match.score,
      title: match.metadata?.title || 'Unknown',
      url: match.metadata?.url || '',
      description: match.metadata?.description || '',
      category: match.metadata?.category || category,
      ragId: ragId // Echo back the used RAG_ID
    }));

    return new Response(JSON.stringify({
      results,
      count: results.length,
      filter: { category, ragId }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Filter API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export const onRequestOptions = handleOptions;
