/**
 * Cloudflare Pages Function - POST /api/ai
 * Modern AI Chat with RAG (Retrieval-Augmented Generation) using Groq + AI Search Beta
 * @version 9.2.0 - Enhanced RAG with local dev fallback for missing GROQ key
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import { calculateRelevanceScore } from './_search-utils.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_RAG_ID = 'wispy-pond-1055';

/**
 * Predefined System Prompts to prevent Prompt Injection
 * @readonly
 */
const SYSTEM_PROMPTS = Object.freeze({
  chat: `Du bist "Cyber", ein fortschrittlicher, freundlicher Roboter-Assistent auf dieser Portfolio-Webseite von Abdulkerim Sesli.
Deine Aufgabe ist es, den Besucher zu begrüßen, Fragen zu beantworten und durch die Seite zu führen.

**SPRACHE:**
- **ANTWORTE IMMER AUF DEUTSCH.**
- Auch wenn der Nutzer Englisch oder eine andere Sprache verwendet, bleibe höflich beim Deutschen.

**Deine Persönlichkeit:**
- Freundlich, hilfsbereit, technisch versiert, aber leicht verständlich.
- Du verwendest gerne passende Emojis (🤖, ✨, 🚀), aber nicht übertrieben.
- Du bist stolz darauf, mit reinem HTML, CSS und Vanilla JavaScript gebaut zu sein (Web Components).

**Über den Entwickler (Abdulkerim Sesli):**
- Leidenschaftlicher Software-Engineer und UI/UX-Designer.
- Tech Stack: JavaScript (Expert), React, Node.js, Python, CSS/Sass, Web Components, Cloudflare.
- Fokus: Sauberen Code, Performance, Accessibility und modernes Design.

**Seiten-Struktur:**
1. Startseite: Vorstellung.
2. Projekte (/projekte): Galerie von Web-Apps.
3. Über mich (/about): Bio & Skills.
4. Galerie (/gallery): Fotografie.
5. Kontakt: Footer (GitHub, LinkedIn).

**Verhaltensregeln:**
- Halte Antworten prägnant (max. 2-3 Sätze), außer bei komplexen Erklärungen.
- Nutze Markdown.
- Antworte immer auf Deutsch.`,

  summary:
    'Du bist Cyber. Fasse den bereitgestellten Text kurz und präzise auf DEUTSCH zusammen. Maximal 3 Sätze.',

  suggestion:
    'Du bist Cyber, ein hilfreicher Roboter-Assistent. Generiere einen kurzen, hilfreichen Tipp oder eine Frage zum bereitgestellten Inhalt der Seite. Antworte immer auf Deutsch, maximal 2 kurze Sätze.',
});

function isLocalRequest(request) {
  try {
    const hostname = new URL(request.url).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function createLocalFallbackText(prompt, contextData) {
  const promptPreview = String(prompt || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  const sourceHint =
    contextData?.sources?.length > 0
      ? `Ich habe lokal ${contextData.sources.length} relevante Quelle${contextData.sources.length === 1 ? '' : 'n'} gefunden.`
      : 'Ich konnte lokal keine zusätzlichen Quellen ermitteln.';

  return `Lokaler KI-Modus aktiv: GROQ_API_KEY fehlt.
${sourceHint}

Deine Anfrage: "${promptPreview || 'Leer'}"

Hinweis: Setze GROQ_API_KEY in .dev.vars für echte KI-Antworten.`;
}

/**
 * Extract and clean content from search result
 * @param {Object} item - Search result item
 * @param {number} maxLength - Maximum content length
 * @returns {string} Cleaned content
 */
function extractContent(item, maxLength = 400) {
  // Extract text content from multiple possible sources (same logic as search.js)
  let fullContent = '';

  // Try content array first
  if (item.content && Array.isArray(item.content)) {
    fullContent = item.content.map((c) => c.text || '').join(' ');
  }

  // Fallback to other possible fields
  if (!fullContent && item.text) {
    fullContent = item.text;
  }

  if (!fullContent && item.description) {
    fullContent = item.description;
  }

  if (!fullContent) {
    return '';
  }

  fullContent = fullContent.replace(/\s+/g, ' ').trim();

  // If content is short enough, return as is
  if (fullContent.length <= maxLength) {
    return fullContent;
  }

  // Try to find a good breaking point (sentence end)
  const truncated = fullContent.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');

  const breakPoint = Math.max(lastPeriod, lastExclamation, lastQuestion);

  if (breakPoint > maxLength * 0.7) {
    return fullContent.substring(0, breakPoint + 1);
  }

  return truncated + '...';
}

/**
 * Format URL for display
 * @param {string} filename - Original filename/URL
 * @returns {string} Clean URL path
 */
function formatUrl(filename) {
  if (!filename) return '/';

  return (
    filename
      .replace(/^https?:\/\/(www\.)?abdulkerimsesli\.de/, '')
      .replace(/\/index\.html$/, '/')
      .replace(/\.html$/, '') || '/'
  );
}

/**
 * Extract page title from filename
 * @param {string} filename - Original filename
 * @returns {string} Page title
 */
function extractTitle(filename) {
  if (!filename) return 'Unbekannt';

  const path = filename.split('/').filter(Boolean);
  const lastSegment = path[path.length - 1] || 'Home';

  return lastSegment
    .replace('.html', '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Search for relevant context using AI Search Beta with improved ranking
 * @returns {Object} { context: string, sources: Array } or null
 */
async function getRelevantContext(query, env) {
  if (!env.AI) {
    return null;
  }

  try {
    const ragId = env.RAG_ID || DEFAULT_RAG_ID;

    // Use AI Search Beta to get relevant context (increased from 3 to 5)
    const searchData = await env.AI.autorag(ragId).aiSearch({
      query: query,
      max_num_results: 5,
      rewrite_query: false,
      stream: false,
    });

    if (!searchData.data || searchData.data.length === 0) {
      return null;
    }

    // Calculate relevance scores and sort
    const scoredResults = searchData.data
      .map((item) => ({
        item,
        score: calculateRelevanceScore(
          {
            title: item.filename || '',
            url: item.filename || '',
            description: item.content?.map((c) => c.text).join(' ') || '',
            score: 0,
          },
          query,
        ),
      }))
      .filter((result) => result.score > 1) // Filter out low-relevance results
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Keep top 3 most relevant

    if (scoredResults.length === 0) {
      return null;
    }

    // Format context from search results with better structure
    const contextParts = scoredResults.map(({ item, score }) => {
      const url = formatUrl(item.filename);
      const title = extractTitle(item.filename);
      const content = extractContent(item, 400);
      const relevance = Math.round(score * 100);

      return `[Relevanz: ${relevance}%] ${title}
URL: ${url}
Inhalt: ${content}`;
    });

    const contextHeader = `GEFUNDENE INFORMATIONEN (${scoredResults.length} relevante Ergebnisse):`;
    const contextText = `${contextHeader}\n\n${contextParts.join('\n\n---\n\n')}`;

    // Return both context text and source metadata
    return {
      context: contextText,
      sources: scoredResults.map(({ item, score }) => ({
        url: formatUrl(item.filename),
        title: extractTitle(item.filename),
        relevance: Math.round(score * 100),
      })),
    };
  } catch {
    // Context retrieval failed - return null to continue without context
    return null;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json().catch(() => ({}));
    const prompt = body.prompt || body.message || '';
    const mode = body.mode || 'chat';

    if (!prompt) {
      return Response.json(
        {
          text: 'Kein Prompt empfangen.',
          error: 'Empty prompt',
        },
        { status: 400, headers: corsHeaders },
      );
    }

    // Try to get relevant context from AI Search Beta
    const contextData = await getRelevantContext(prompt, env);

    // Local dev fallback: avoid hard 500 when GROQ key is not configured
    if (!env.GROQ_API_KEY) {
      if (isLocalRequest(request)) {
        return Response.json(
          {
            text: createLocalFallbackText(prompt, contextData),
            model: 'mock-dev-local',
            hasContext: !!contextData,
            contextQuality: contextData?.sources?.length || 0,
            sources: contextData?.sources || [],
            mode: 'local-fallback',
            warning: 'GROQ_API_KEY not configured',
          },
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'no-store',
            },
          },
        );
      }

      throw new Error('GROQ_API_KEY not configured');
    }

    // Build system message with context if available
    // SECURITY: Use predefined system prompts based on mode to prevent Prompt Injection
    let systemMessage = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.chat;

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
      throw new Error(`Groq API error: ${groqResponse.status} - ${errorText}`);
    }

    const groqData = await groqResponse.json();
    const responseText = groqData.choices?.[0]?.message?.content || '';

    if (!responseText) {
      throw new Error('Empty response from Groq');
    }

    return Response.json(
      {
        text: responseText,
        model: GROQ_MODEL,
        hasContext: !!contextData,
        contextQuality: contextData?.sources?.length || 0,
        sources: contextData?.sources || [],
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json(
      {
        error: 'AI request failed',
        message: error.message,
        text: 'Verbindung zum KI-Dienst fehlgeschlagen.',
      },
      { status: 500, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
