export async function onRequest(context) {
  const { env } = context;

  if (!env.AI) {
    return new Response(
      JSON.stringify({ error: 'AI binding not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    const ragId = env.RAG_ID || 'wispy-pond-1055';
    const startTime = Date.now();

    // Minimal test call without complex params
    const searchData = await env.AI.autorag(ragId).aiSearch({
      query: 'test',
      max_num_results: 1,
      rewrite_query: false, // Match working chat config
      stream: false,
    });

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify(
        {
          status: 'ok',
          ragId,
          duration_ms: duration,
          results_count: searchData?.data?.length || 0,
          raw_response: searchData,
        },
        null,
        2,
      ),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify(
        {
          status: 'error',
          message: error.message,
          stack: error.stack,
          ragId: env.RAG_ID || 'wispy-pond-1055',
        },
        null,
        2,
      ),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
