/**
 * Cloudflare Pages Function - POST /api/ai
 * Modern AI Chat with RAG (Retrieval-Augmented Generation) using Groq + AI Search Beta
 * @version 10.0.0 - Unified Utils
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  calculateRelevanceScore,
  normalizeUrl,
  extractTitle,
  extractContent,
} from './_search-utils.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Search for relevant context using AI Search Beta with improved ranking
 * @returns {Object} { context: string, sources: Array } or null
 */
async function getRelevantContext(query, env) {
  if (!env.AI) {
    return null;
  }

  try {
    // Use AI Search Beta to get relevant context
    const searchData = await env.AI.autorag('wispy-pond-1055').aiSearch({
      query: query,
      max_num_results: 5,
      rewrite_query: false,
      stream: false,
    });

    if (!searchData.data || searchData.data.length === 0) {
      return null;
    }

    // Process and score results
    const scoredResults = searchData.data
      .map((item) => {
        const url = normalizeUrl(item.filename);
        const title = extractTitle(item.filename);

        // Extract FULL content first for scoring
        // 10000 chars limit to avoid memory issues but capture most content
        const fullContent = extractContent(item, 10000);

        // Create a result object compatible with calculateRelevanceScore
        const resultObj = {
          url,
          title,
          description: fullContent, // Score against full text
          category: 'page', // Default
          score: item.score || 0,
        };

        const relevance = calculateRelevanceScore(resultObj, query);

        // Now truncate for context window
        // Use a slightly larger window for AI context (800 chars)
        const displayContent =
          fullContent.length > 800
            ? fullContent.substring(0, 800) + '...'
            : fullContent;

        return {
          item,
          relevance,
          url,
          title,
          content: displayContent,
        };
      })
      // Relaxed filtering: > 0.3 allows weak matches if no strong ones exist
      .filter((result) => result.relevance > 0.3)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3);

    if (scoredResults.length === 0) {
      return null;
    }

    // Format context
    const contextParts = scoredResults.map(
      ({ title, url, content, relevance }) => {
        const displayScore = Math.round(relevance);
        return `[Relevanz: ${displayScore}] ${title}\nURL: ${url}\nInhalt: ${content}`;
      },
    );

    const contextHeader = `GEFUNDENE INFORMATIONEN (${scoredResults.length} relevante Ergebnisse):`;
    const contextText = `${contextHeader}\n\n${contextParts.join('\n\n---\n\n')}`;

    return {
      context: contextText,
      sources: scoredResults.map(({ title, url, relevance }) => ({
        url,
        title,
        relevance: Math.round(relevance),
      })),
    };
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

    // Try to get relevant context from AI Search Beta
    const contextData = await getRelevantContext(prompt, env);

    // Build system message with context if available
    let systemMessage =
      systemInstruction ||
      'Du bist Cyber, ein hilfreicher Roboter-Assistent auf der Portfolio-Website von Abdulkerim Sesli. Antworte freundlich und präzise auf Deutsch.';

    if (contextData) {
      systemMessage += `\n\n${contextData.context}

ANWEISUNGEN:
- Nutze die gefundenen Informationen, um präzise und hilfreiche Antworten zu geben
- Beziehe dich auf die Relevanz-Scores, um die wichtigsten Informationen zu priorisieren
- Wenn du auf Seiten verweist, nutze die angegebenen URLs
- Wenn die Informationen nicht ausreichen, sage das ehrlich und schlage vor, die Suche zu nutzen
- Fasse mehrere Quellen zusammen, wenn sie zum Thema passen`;
    } else {
      systemMessage += `\n\nDu bist auf der Portfolio-Website von Abdulkerim Sesli, einem Webentwickler aus Berlin. Die Website zeigt Projekte, Blog-Artikel, Fotografie und Videos. Wenn du nach spezifischen Inhalten gefragt wirst, empfehle die Suche-Funktion oder gib allgemeine Informationen über die verfügbaren Bereiche.`;
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
        hasContext: !!contextData,
        contextQuality: contextData ? contextData.sources.length : 0,
        sources: contextData ? contextData.sources : [],
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
