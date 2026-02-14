export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route: /api/search
      if (url.pathname === '/api/search' && request.method === 'POST') {
        const body = await request.json();
        const { query, limit = 10, topK = 10 } = body;

        if (!query) {
          return new Response(JSON.stringify({ results: [], count: 0 }), {
            headers: corsHeaders,
          });
        }

        // 1. Generate embedding for query
        const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: query,
        });

        // 2. Query vector index
        const matches = await env.VECTOR_INDEX.query(embedding.data[0], {
          topK: Math.min(topK, 20),
          returnMetadata: true,
        });

        // 3. Format results
        const results = matches.matches.map((match) => ({
          url: match.metadata?.url || '',
          title: match.metadata?.title || 'Seite',
          description: match.metadata?.description || '',
          category: match.metadata?.category || 'Seite',
          score: match.score,
        }));

        return new Response(
          JSON.stringify({ results, count: results.length }),
          { headers: corsHeaders },
        );
      }

      // Route: /api/ai
      if (url.pathname === '/api/ai' && request.method === 'POST') {
        const body = await request.json();
        const {
          prompt,
          message,
          systemInstruction,
          ragId,
          maxResults = 5,
        } = body;

        const userMessage = message || prompt;

        if (!userMessage) {
          return new Response(
            JSON.stringify({ text: 'Keine Nachricht erhalten.' }),
            { headers: corsHeaders },
          );
        }

        // 1. Generate embedding for RAG context
        const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: userMessage,
        });

        // 2. Get relevant context from vector index
        const matches = await env.VECTOR_INDEX.query(embedding.data[0], {
          topK: maxResults,
          returnMetadata: true,
          filter: ragId ? { rag_id: ragId } : undefined,
        });

        // 3. Build context from matches
        const context = matches.matches
          .map(
            (m) =>
              `${m.metadata?.title || ''}: ${m.metadata?.description || ''}`,
          )
          .join('\n');

        // 4. Generate AI response with context
        const messages = [
          {
            role: 'system',
            content: systemInstruction || 'Du bist ein hilfreicher Assistent.',
          },
          {
            role: 'system',
            content: `Kontext aus dem Portfolio:\n${context}`,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ];

        const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages,
          max_tokens: 256,
        });

        return new Response(
          JSON.stringify({ text: aiResponse.response || '' }),
          { headers: corsHeaders },
        );
      }

      // Route: /api/embed (für Indexierung)
      if (url.pathname === '/api/embed' && request.method === 'POST') {
        const body = await request.json();
        const { text } = body;

        const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text,
        });

        return new Response(JSON.stringify({ embedding: embedding.data[0] }), {
          headers: corsHeaders,
        });
      }

      // Route: /api/insert (für Indexierung)
      if (url.pathname === '/api/insert' && request.method === 'POST') {
        const body = await request.json();
        const { id, values, metadata } = body;

        await env.VECTOR_INDEX.insert([
          {
            id,
            values,
            metadata,
          },
        ]);

        return new Response(JSON.stringify({ success: true, id }), {
          headers: corsHeaders,
        });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: corsHeaders,
      });
    } catch (error) {
      console.error('Worker Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
