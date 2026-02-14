/**
 * Cloudflare Pages Function - POST /api/ai
 * Modern AI Chat using Service Binding - Optimized & Reduced
 * @version 6.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';

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

    // Use Cloudflare AI directly
    if (!env.AI) {
      throw new Error('AI binding not configured');
    }

    const messages = [
      {
        role: 'system',
        content:
          systemInstruction ||
          'Du bist ein hilfreicher Assistent. Antworte auf Deutsch.',
      },
      { role: 'user', content: prompt },
    ];

    const serviceResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages,
    });

    // Extract response text from Cloudflare AI
    const responseText =
      serviceResponse?.response || serviceResponse?.result?.response || '';

    if (!responseText) {
      throw new Error('Empty response from AI model');
    }

    return new Response(
      JSON.stringify({
        text: responseText,
        model: '@cf/meta/llama-3.1-8b-instruct',
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
