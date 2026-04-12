/**
 * Cloudflare Pages Function – POST /api/ai-agent
 * Agentic AI: SSE streaming, tool-calling, image analysis and memory.
 * @version 5.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import { parseInteger } from '../_shared/number-utils.js';
import {
  inferClientToolCallsFromPrompt,
  promptNeedsTools,
  sanitizeAssistantText,
} from './_ai-agent-intent.js';
import { createUserId } from '../../content/core/user-id.js';
import { buildAgentResponsePayload } from '../../content/core/ai-agent-contracts.js';
import { normalizeUserId } from './_user-identity.js';
import {
  buildAgentMessagePayload,
  hasMeaningfulAgentText,
  sseEvent,
  streamToSSE,
} from './_ai-agent-sse.js';
import { jsonResponse } from './_response.js';
import { createLogger } from '../../content/core/logger.js';
import {
  CACHE_CONTROL_NO_STORE,
  mergeHeaders,
} from '../_shared/http-headers.js';

// Extracted modules
import { analyzeImage } from './_ai-agent-image.js';
import { buildSystemPrompt } from './_ai-agent-prompt.js';
import {
  persistPromptMemories,
  resolveMemoryContext,
  mergeMemoryEntries,
  storeMemory
} from './_ai-agent-memory.js';
import { TOOLS, classifyToolCalls } from './_ai-agent-tools.js';

const log = createLogger('ai-agent');

const DEFAULT_CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DEFAULT_EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const DEFAULT_IMAGE_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
const DEFAULT_MAX_MEMORY_RESULTS = 5;
const DEFAULT_MEMORY_SCORE_THRESHOLD = 0.65;
const DEFAULT_MAX_HISTORY_TURNS = 10;
const DEFAULT_MAX_TOKENS = 2048;
const USER_ID_HEADER = 'X-Jules-User-Id';

function parseDecimal(
  value,
  fallback,
  { min = 0, max = 1, precision = 2 } = {},
) {
  const parsed = Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.min(max, Math.max(min, parsed));
  const factor = 10 ** precision;
  return Math.round(clamped * factor) / factor;
}

function getAgentConfig(env) {
  return {
    chatModel: env.ROBOT_CHAT_MODEL || DEFAULT_CHAT_MODEL,
    embeddingModel: env.ROBOT_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
    imageModel: env.ROBOT_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
    maxMemoryResults: parseInteger(
      env.ROBOT_MEMORY_TOP_K,
      DEFAULT_MAX_MEMORY_RESULTS,
      {
        min: 1,
        max: 25,
      },
    ),
    memoryScoreThreshold: parseDecimal(
      env.ROBOT_MEMORY_SCORE_THRESHOLD,
      DEFAULT_MEMORY_SCORE_THRESHOLD,
    ),
    maxHistoryTurns: parseInteger(
      env.ROBOT_MAX_HISTORY_TURNS,
      DEFAULT_MAX_HISTORY_TURNS,
      {
        min: 1,
        max: 40,
      },
    ),
    maxTokens: parseInteger(env.ROBOT_MAX_TOKENS, DEFAULT_MAX_TOKENS, {
      min: 128,
      max: 8192,
    }),
  };
}

function resolveUserIdentity(request, requestedUserId = '') {
  let nameId = normalizeUserId(requestedUserId);
  if (!nameId) {
    try {
      const url = new URL(request.url);
      nameId = normalizeUserId(url.searchParams.get('name') || '');
    } catch {
      nameId = '';
    }
  }
  if (nameId) {
    const hasPrefix = /^(?:name_|jwt_|u_|anon_)/.test(nameId);
    return {
      userId: hasPrefix ? nameId : `name_${nameId}`,
    };
  }

  return { userId: createUserId('anon') };
}

function appendExposeHeader(headers, name) {
  if (!name) return;
  const current = headers.get('Access-Control-Expose-Headers') || '';
  const values = current
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!values.includes(name)) {
    values.push(name);
    headers.set('Access-Control-Expose-Headers', values.join(', '));
  }
}

function withUserIdentityHeader(headers, userId) {
  const out = new Headers(headers);
  if (userId) {
    out.set(USER_ID_HEADER, userId);
    appendExposeHeader(out, USER_ID_HEADER);
  }
  return out;
}

function buildAiRunParams(
  messages,
  config,
  { useTools = false, maxTokens = config.maxTokens, stream = false } = {},
) {
  const params = {
    messages,
    temperature: 0.7,
    max_tokens: maxTokens,
  };
  if (useTools) params.tools = TOOLS;
  if (stream) params.stream = true;
  return params;
}

function buildServerToolFollowUpMessages(messages, serverToolResults) {
  return [
    ...messages,
    {
      role: 'assistant',
      content: `Tools: ${serverToolResults.map((r) => r.name).join(', ')}`,
    },
    {
      role: 'user',
      content: `Ergebnisse:\n${serverToolResults.map((r) => `[${r.name}]: ${r.result}`).join('\n')}\n\nAntworte dem Nutzer.`,
    },
  ];
}

function buildClientToolConfirmationMessages(messages, clientToolCalls) {
  return [
    ...messages,
    {
      role: 'assistant',
      content: `Aktionen: ${clientToolCalls.map((t) => t.name).join(', ')}`,
    },
    {
      role: 'user',
      content: 'Bestätige kurz auf Deutsch (1-2 Sätze).',
    },
  ];
}

async function requestClientToolConfirmationText(
  env,
  messages,
  clientToolCalls,
  config,
) {
  const result = await env.AI.run(
    config.chatModel,
    buildAiRunParams(
      buildClientToolConfirmationMessages(messages, clientToolCalls),
      config,
      { maxTokens: 256 },
    ),
  );
  return sanitizeAssistantText(result?.response || '');
}

async function writeTokenizedText(write, text) {
  for (const chunk of text.match(/\S+\s*/g) || [text]) {
    await write('token', { text: chunk });
  }
}

function getFallbackAgentText(existingText, clientToolCalls, serverToolResults) {
  if (hasMeaningfulAgentText(existingText)) return existingText;
  if (clientToolCalls.length > 0) return 'Aktion wird ausgeführt…';
  if (serverToolResults.length > 0) {
    return 'Ich habe deine Infos geprüft. Frag mich gern noch einmal.';
  }
  return 'Keine Antwort erhalten.';
}

// ─── Main Handler ───────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;
  const config = getAgentConfig(env);
  const corsHeaders = getCorsHeaders(request, env);

  const sseHeaders = mergeHeaders(corsHeaders, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });

  try {
    const contentType = request.headers.get('content-type') || '';
    let body;
    let imageAnalysis = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const imageFile = formData.get('image');

      if (imageFile instanceof File) {
        const arrayBuffer = await imageFile.arrayBuffer();
        imageAnalysis = await analyzeImage(
          env,
          [...new Uint8Array(arrayBuffer)],
          String(formData.get('prompt') || ''),
          config,
        );
      }

      body = {
        prompt:
          String(formData.get('prompt') || '') || 'Analysiere dieses Bild.',
        userId: String(formData.get('userId') || 'anonymous'),
        imageAnalysis,
        mode: 'agent',
      };
    } else {
      body = await request.json().catch(() => ({}));
    }

    const {
      prompt = '',
      userId: requestedUserId = 'anonymous',
      conversationHistory = [],
      stream = true,
    } = body;
    imageAnalysis = body.imageAnalysis || imageAnalysis;

    const identity = resolveUserIdentity(request, requestedUserId);
    const userId = identity.userId;
    log.debug('request', { userId, prompt, requestedUserId });
    
    if (userId && userId.startsWith('name_')) {
      const nameVal = userId.slice(5);
      storeMemory(env, userId, 'name', nameVal, config).catch(() => {});
    }
    
    const jsonHeaders = withUserIdentityHeader(
      mergeHeaders(corsHeaders, {
        'Cache-Control': CACHE_CONTROL_NO_STORE,
      }),
      userId,
    );
    const sseResponseHeaders = withUserIdentityHeader(sseHeaders, userId);

    if (!prompt && !imageAnalysis) {
      return jsonResponse(
        {
          error: 'Empty prompt',
          ...buildAgentResponsePayload({
            text: 'Kein Prompt empfangen.',
          }),
        },
        { status: 400, headers: jsonHeaders },
      );
    }

    if (!env.AI) {
      return jsonResponse(
        {
          error: 'AI service not configured',
          ...buildAgentResponsePayload({
            text: 'KI-Dienst nicht verfügbar.',
            retryable: false,
          }),
        },
        { status: 500, headers: jsonHeaders },
      );
    }

    // ── Parallel: memory recall + deterministic memory persistence ──
    const [memResult, storedPromptMemoriesResult] =
      await Promise.allSettled([
        resolveMemoryContext(env, userId, prompt, config),
        persistPromptMemories(env, userId, prompt, config),
      ]);

    const recalledMemories =
      memResult.status === 'fulfilled' ? memResult.value : [];
    const storedPromptMemories =
      storedPromptMemoriesResult.status === 'fulfilled'
        ? storedPromptMemoriesResult.value
        : [];
    const mergedMemories = mergeMemoryEntries(
      recalledMemories,
      storedPromptMemories,
    );

    const memoryContext =
      mergedMemories.length > 0
        ? mergedMemories
            .slice(0, Math.max(config.maxMemoryResults, 8))
            .map((m) => `- ${m.key}: ${m.value}`)
            .join('\n')
        : '';

    // ── Build messages ──
    const systemPrompt = buildSystemPrompt(memoryContext, imageAnalysis);
    const messages = [{ role: 'system', content: systemPrompt }];

    if (Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-config.maxHistoryTurns)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: String(msg.content || '') });
        }
      }
    }
    messages.push({ role: 'user', content: prompt });

    // ── Non-streaming path ──
    if (!stream) {
      return handleNonStreaming(
        env,
        messages,
        userId,
        jsonHeaders,
        {
          memoryContext,
          imageAnalysis,
        },
        config,
      );
    }

    // ── SSE Streaming ──
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const write = (event, data) =>
      writer.write(encoder.encode(sseEvent(event, data)));

    context.waitUntil(
      (async () => {
        try {
          await write('status', { phase: 'thinking' });

          const useTools = promptNeedsTools(prompt);
          const aiResult = await env.AI.run(
            config.chatModel,
            buildAiRunParams(messages, config, { useTools }),
          );

          let toolCalls = Array.isArray(aiResult?.tool_calls)
            ? aiResult.tool_calls
            : [];
          const responseText = sanitizeAssistantText(aiResult?.response || '');

          if (useTools && toolCalls.length === 0) {
            toolCalls = inferClientToolCallsFromPrompt(prompt);
          }

          if (toolCalls.length > 0) {
            await processToolCalls(
              toolCalls,
              write,
              env,
              userId,
              { memoryContext, imageAnalysis },
              messages,
              responseText,
              config,
            );
          } else if (responseText) {
            await write('status', { phase: 'streaming' });
            await writeTokenizedText(write, responseText);
            await write(
              'message',
              buildAgentMessagePayload(
                responseText,
                [],
                [],
                { memoryContext, imageAnalysis },
                config,
              ),
            );
          } else {
            await write(
              'message',
              buildAgentMessagePayload(
                'Keine Antwort erhalten.',
                [],
                [],
                { memoryContext, imageAnalysis },
                config,
              ),
            );
          }
        } catch (error) {
          log.error('SSE pipeline error:', error?.message || error);
          const fallbackToolCalls = inferClientToolCallsFromPrompt(prompt);
          for (const toolCall of fallbackToolCalls) {
            await write('tool', {
              name: toolCall.name,
              arguments: toolCall.arguments,
              status: 'client',
              isServerTool: false,
              degraded: true,
            });
          }

          await write('message', {
            ...buildAgentMessagePayload(
              fallbackToolCalls.length > 0
                ? 'Der KI-Dienst ist gerade nicht erreichbar. Ich habe die angefragte Aktion trotzdem lokal ausgefuehrt.'
                : 'Der KI-Dienst ist gerade nicht erreichbar. Bitte versuche es in ein paar Sekunden erneut.',
              fallbackToolCalls,
              [],
              { memoryContext, imageAnalysis },
              config,
            ),
            degraded: true,
            retryable: true,
          });
        } finally {
          await write('done', { ts: Date.now() });
          await writer.close();
        }
      })(),
    );

    return new Response(readable, { headers: sseResponseHeaders });
  } catch (error) {
    log.error('AI Agent error:', error?.message || error);
    return jsonResponse(
      {
        error: 'AI Agent request failed',
        ...buildAgentResponsePayload({
          text: 'KI-Dienst fehlgeschlagen. Bitte erneut versuchen.',
          retryable: true,
        }),
      },
      {
        status: 503,
        headers: mergeHeaders(corsHeaders, {
          'Cache-Control': CACHE_CONTROL_NO_STORE,
        }),
      },
    );
  }
}

// ─── Process Tool Calls ─────────────────────────────────────────────────────────

async function processToolCalls(
  toolCalls,
  write,
  env,
  userId,
  ctx,
  messages = [],
  existingText = '',
  config,
) {
  const { clientToolCalls, serverToolResults } = await classifyToolCalls(
    env,
    toolCalls,
    userId,
    config,
  );

  for (const sr of serverToolResults) {
    await write('tool', {
      name: sr.name,
      status: 'done',
      result: sr.result,
      isServerTool: true,
    });
  }
  for (const ct of clientToolCalls) {
    await write('tool', {
      name: ct.name,
      arguments: ct.arguments,
      status: 'client',
      isServerTool: false,
    });
  }

  if (serverToolResults.length > 0 && messages.length > 0) {
    await write('status', { phase: 'synthesizing' });
    const followUpMessages = buildServerToolFollowUpMessages(
      messages,
      serverToolResults,
    );
    try {
      const result = await env.AI.run(
        config.chatModel,
        buildAiRunParams(followUpMessages, config, { stream: true }),
      );
      const text = sanitizeAssistantText(await streamToSSE(result, write));
      if (hasMeaningfulAgentText(text)) {
        await write(
          'message',
          buildAgentMessagePayload(
            text,
            clientToolCalls,
            serverToolResults,
            ctx,
            config,
          ),
        );
        return;
      }

      const fallback = await env.AI.run(
        config.chatModel,
        buildAiRunParams(followUpMessages, config),
      );
      const fallbackText = sanitizeAssistantText(fallback?.response || '');
      if (hasMeaningfulAgentText(fallbackText)) {
        await write('message', {
          ...buildAgentMessagePayload(
            fallbackText,
            clientToolCalls,
            serverToolResults,
            ctx,
            config,
          ),
          forcedFromNonStreamFallback: true,
        });
        return;
      }
    } catch (err) {
      log.warn('Follow-up failed:', err?.message);
    }
  }

  if (
    clientToolCalls.length > 0 &&
    !hasMeaningfulAgentText(existingText) &&
    messages.length > 0
  ) {
    await write('status', { phase: 'responding' });
    try {
      const followUpText = await requestClientToolConfirmationText(
        env,
        messages,
        clientToolCalls,
        config,
      );
      if (followUpText) {
        await writeTokenizedText(write, followUpText);
        await write(
          'message',
          buildAgentMessagePayload(
            followUpText,
            clientToolCalls,
            serverToolResults,
            ctx,
            config,
          ),
        );
        return;
      }
    } catch (err) {
      log.warn('Follow-up for client tools failed:', err?.message);
    }
  }

  await write(
    'message',
    buildAgentMessagePayload(
      getFallbackAgentText(existingText, clientToolCalls, serverToolResults),
      clientToolCalls,
      serverToolResults,
      ctx,
      config,
    ),
  );
}

// ─── Non-Streaming Handler ──────────────────────────────────────────────────────

async function handleNonStreaming(
  env,
  messages,
  userId,
  corsHeaders,
  ctx,
  config,
) {
  try {
    const useTools = promptNeedsTools(
      messages[messages.length - 1]?.content || '',
    );
    const aiResult = await env.AI.run(
      config.chatModel,
      buildAiRunParams(messages, config, { useTools }),
    );
    if (!aiResult) throw new Error('Empty AI response');

    let toolCalls = Array.isArray(aiResult.tool_calls)
      ? aiResult.tool_calls
      : [];
    if (useTools && toolCalls.length === 0) {
      toolCalls = inferClientToolCallsFromPrompt(
        messages[messages.length - 1]?.content || '',
      );
    }

    const { clientToolCalls, serverToolResults } = await classifyToolCalls(
      env,
      toolCalls,
      userId,
      config,
    );

    let responseText = sanitizeAssistantText(aiResult.response || '');
    if (serverToolResults.length > 0) {
      try {
        const followUp = await env.AI.run(
          config.chatModel,
          buildAiRunParams(
            buildServerToolFollowUpMessages(messages, serverToolResults),
            config,
          ),
        );
        const followUpText = sanitizeAssistantText(followUp?.response || '');
        if (followUpText) responseText = followUpText;
      } catch {
        /* use original */
      }
    }

    if (!responseText && clientToolCalls.length > 0) {
      try {
        const followUpText = await requestClientToolConfirmationText(
          env,
          messages,
          clientToolCalls,
          config,
        );
        if (followUpText) responseText = followUpText;
      } catch {
        /* ignore */
      }
    }

    return jsonResponse(
      buildAgentResponsePayload({
        text:
          responseText ||
          (clientToolCalls.length
            ? 'Aktion wird ausgeführt…'
            : 'Keine Antwort.'),
        toolCalls: clientToolCalls,
        model: config.chatModel,
        hasMemory: !!ctx.memoryContext,
        hasImage: !!ctx.imageAnalysis,
      }),
      { headers: corsHeaders },
    );
  } catch (error) {
    log.error('Non-streaming error:', error?.message || error);
    const prompt = String(messages[messages.length - 1]?.content || '');
    const fallbackToolCalls = inferClientToolCallsFromPrompt(prompt);
    return jsonResponse(
      buildAgentResponsePayload({
        text:
          fallbackToolCalls.length > 0
            ? 'Der KI-Dienst ist gerade nicht erreichbar. Ich habe die angefragte Aktion trotzdem lokal ausgefuehrt.'
            : 'Der KI-Dienst ist gerade nicht erreichbar. Bitte versuche es in ein paar Sekunden erneut.',
        toolCalls: fallbackToolCalls,
        model: config.chatModel,
        hasMemory: !!ctx.memoryContext,
        hasImage: !!ctx.imageAnalysis,
        retryable: true,
        degraded: true,
      }),
      { headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
