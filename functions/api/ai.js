/**
 * Cloudflare Pages Function - POST /api/ai
 * Modern AI Chat with RAG (Retrieval-Augmented Generation) using Groq
 * @version 8.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Search for relevant context using Vectorize
 */
async function getRelevantContext(query, env) {
  if (!env.VECTOR_INDEX || !env.AI) {
    return null;
  }

  try {
    // Generate embedding for the query
    // Using bge-large for 1024 dimensions (Cloudflare Managed AI Search)
    const embeddingResponse = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
      text: query,
    });

    const queryVector = embeddingResponse.data[0];

    // Search in Vectorize (top 3 most relevant results)
    const vectorResults = await env.VECTOR_INDEX.query(queryVector, {
      topK: 3,
      returnMetadata: true,
    });

    if (!vectorResults.matches || vectorResults.matches.length === 0) {
      return null;
    }

    // Format context from search results
    const contextParts = vectorResults.matches.map((match) => {
      const meta = match.metadata || {};
      return `Seite: ${meta.title || 'Unbekannt'}
URL: ${meta.url || '/'}
Kategorie: ${meta.category || 'Allgemein'}
Beschreibung: ${meta.description || 'Keine Beschreibung verfügbar'}`;
    });

    return contextParts.join('\n\n---\n\n');
  } catch (error) {
    console.error('Context retrieval error:', error.message);
    return null;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json().catch(() => ({}));
    const prompt = body.prompt || body.message || '';
    const systemInstruction = body.systemInstruction || '';

    if (!prompt) {
      return new Response(
        JSON.stringify({
          text: 'Kein Prompt empfangen.',
          error: 'Empty prompt',
        }),
        { status: 400, headers: corsHeaders },
      );
    }

    // Check for Groq API key
    if (!env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured');
    }

    // Try to get relevant context from Vectorize
    const context = await getRelevantContext(prompt, env);

    // Build system message with context if available
    let systemMessage =
      systemInstruction ||
      'Du bist Cyber, ein hilfreicher Roboter-Assistent auf der Portfolio-Website von Abdulkerim Sesli. Antworte freundlich und präzise auf Deutsch.';

    if (context) {
      systemMessage += `\n\nRELEVANTE INFORMATIONEN VON DER WEBSITE:\n${context}\n\nNutze diese Informationen, um präzise und hilfreiche Antworten zu geben. Wenn die Frage sich auf die Website bezieht, verweise auf die relevanten Seiten.`;
    } else {
      systemMessage += `\n\nDu bist auf der Portfolio-Website von Abdulkerim Sesli, einem Webentwickler aus Berlin. Die Website zeigt Projekte, Blog-Artikel, Fotografie und Videos. Wenn du nach spezifischen Inhalten gefragt wirst, empfehle die Suche-Funktion.`;
    }

    const messages = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt },
    ];

    // Call Groq API
    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', errorText);
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    const groqData = await groqResponse.json();
    const responseText = groqData.choices?.[0]?.message?.content || '';

    if (!responseText) {
      throw new Error('Empty response from Groq');
    }

    return new Response(
      JSON.stringify({
        text: responseText,
        model: GROQ_MODEL,
        hasContext: !!context,
      }),
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('AI API Error:', error);
    return new Response(
      JSON.stringify({
        error: 'AI request failed',
        message: error.message,
        text: 'Verbindung zum KI-Dienst fehlgeschlagen.',
      }),
      { status: 500, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
