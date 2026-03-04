/**
 * Cloudflare Pages Function – POST /api/ai
 * Lightweight AI Chat with RAG (non-streaming, no tools).
 * @version 11.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import { normalizeUrl, extractTitle } from './_search-url.js';
import {
  buildAiSearchRequest,
  resolveAiSearchConfig,
} from './_ai-search-config.js';

const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DEFAULT_RAG_ID = 'wispy-pond-1055';
const MAX_CONTEXT_SOURCES = 3;

/** Predefined system prompts — prevents prompt injection */
const SYSTEM_PROMPTS = Object.freeze({
  chat: `Du bist "Cyber", ein freundlicher Roboter-Assistent auf der Portfolio-Webseite von Abdulkerim Sesli.

**SPRACHE:** Antworte IMMER auf Deutsch.

**Persönlichkeit:** Freundlich, technisch versiert, nutze passende Emojis (🤖, ✨, 🚀) sparsam.

**Entwickler:** Software-Engineer & UI/UX-Designer aus Berlin.
Tech Stack: JavaScript, React, Node.js, Python, CSS, Web Components, Cloudflare.

**Seiten:** Startseite, Projekte (/projekte), Über mich (/about), Galerie (/gallery), Blog (/blog), Videos (/videos), Kontakt (Footer).

**Regeln:** Prägnant (2-3 Sätze), Markdown nutzen, immer Deutsch.`,

  summary:
    'Fasse den Text kurz und präzise auf DEUTSCH zusammen. Maximal 3 Sätze. Nutze Formatierungen wie Aufzählungszeichen, wenn sinnvoll.',

  suggestion:
    'Generiere einen kurzen, hilfreichen Tipp zum Seiteninhalt. Deutsch, maximal 2 Sätze. Sei kreativ und lösungsorientiert.',
});

/** Extract and truncate content from a search result item */
function extractContent(item, maxLength = 600) {
  const raw = Array.isArray(item.content)
    ? item.content.map((c) => c.text || '').join(' ')
    : item.text || item.description || '';

  if (!raw) return '';

  const clean = raw.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;

  const truncated = clean.substring(0, maxLength);
  const breakAt = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?'),
  );

  return breakAt > maxLength * 0.7
    ? clean.substring(0, breakAt + 1)
    : `${truncated}…`;
}

/** Retrieve relevant RAG context via AI Search */
async function getRelevantContext(query, env) {
  if (!env.AI) return null;

  try {
    const ragId = env.RAG_ID || DEFAULT_RAG_ID;
    const config = resolveAiSearchConfig(env);

    const searchData = await env.AI.autorag(ragId).aiSearch(
      buildAiSearchRequest({
        query,
        maxResults: config.contextMaxResults,
        config,
        stream: false,
      }),
    );

    const items = searchData?.data;
    if (!items?.length) return null;

    const top = items
      .map((item) => ({ item, score: item.score || 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CONTEXT_SOURCES);

    if (!top.length) return null;

    const contextParts = top.map(({ item, score }) => {
      const url = normalizeUrl(item.filename);
      return `[${Math.round(score * 100)}%] ${extractTitle(item.filename, url)}\nURL: ${url}\n${extractContent(item)}`;
    });

    return {
      context: `KONTEXT (${top.length} Quellen):\n\n${contextParts.join('\n---\n')}`,
      sources: top.map(({ item, score }) => {
        const url = normalizeUrl(item.filename);
        return {
          url,
          title: extractTitle(item.filename, url),
          relevance: Math.round(score * 100),
        };
      }),
    };
  } catch {
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
        { text: 'Kein Prompt empfangen.', error: 'Empty prompt' },
        { status: 400, headers: corsHeaders },
      );
    }

    const contextData = await getRelevantContext(prompt, env);

    if (!env.AI) {
      return Response.json(
        {
          text: 'KI-Dienst nicht verfügbar.',
          error: 'AI binding not configured',
          sources: contextData?.sources || [],
        },
        { status: 503, headers: corsHeaders },
      );
    }

    let systemMessage = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.chat;

    if (contextData) {
      systemMessage += `\n\n${contextData.context}\n\nNutze die oben genannten Informationen (inklusive Metadaten und Relevanz-Scores) als Grundlage für deine Antwort. Formuliere flüssig und binde Links als Markdown (z.B. [Name](URL)) in den Text ein. Erwähne nicht explizit "Relevanz-Score" oder "Quelle".`;
    } else {
      systemMessage +=
        '\n\nWenn nach spezifischen Inhalten gefragt wird, empfehle die Suchfunktion oder das Menü. Gib ansonsten allgemeine und hilfsbereite Antworten aus deinem eigenen Wissen.';
    }

    const aiResult = await env.AI.run(CHAT_MODEL, {
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const text = aiResult?.response || '';
    if (!text) throw new Error('Empty AI response');

    return Response.json(
      {
        text,
        model: CHAT_MODEL,
        hasContext: !!contextData,
        sources: contextData?.sources || [],
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('AI API error:', error);
    return Response.json(
      {
        error: 'AI request failed',
        text: 'Verbindung zum KI-Dienst fehlgeschlagen.',
      },
      { status: 500, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
