function normalizeText(value) {
  return typeof value === 'string' ? value : String(value || '');
}

function normalizeToolCall(call) {
  if (!call || typeof call !== 'object') return null;
  const name = normalizeText(call.name).trim();
  if (!name) return null;

  const args =
    call.arguments && typeof call.arguments === 'object' && !Array.isArray(call.arguments)
      ? call.arguments
      : {};

  return {
    ...call,
    name,
    arguments: args,
  };
}

function normalizeList(list, mapper = null) {
  if (!Array.isArray(list)) return [];
  if (typeof mapper !== 'function') return list.slice();
  return list.map((item) => mapper(item)).filter(Boolean);
}

/**
 * @typedef {{
 *   name: string,
 *   arguments?: Record<string, unknown>,
 *   [key: string]: unknown,
 * }} AgentToolCall
 */

/**
 * @typedef {{
 *   text: string,
 *   toolCalls: AgentToolCall[],
 *   toolResults: Array<string | Record<string, unknown>>,
 *   model: string,
 *   hasMemory: boolean,
 *   hasImage: boolean,
 *   retryable: boolean,
 *   degraded: boolean,
 *   aborted: boolean,
 *   urlUpdated: boolean,
 *   forcedFromNonStreamFallback: boolean,
 *   [key: string]: unknown,
 * }} AgentResponsePayload
 */

export function buildAgentResponsePayload(payload = {}) {
  return {
    text: normalizeText(payload.text || ''),
    toolCalls: normalizeList(payload.toolCalls, normalizeToolCall),
    toolResults: normalizeList(payload.toolResults),
    model: normalizeText(payload.model || ''),
    hasMemory: Boolean(payload.hasMemory),
    hasImage: Boolean(payload.hasImage),
    retryable: Boolean(payload.retryable),
    degraded: Boolean(payload.degraded),
    aborted: Boolean(payload.aborted),
    urlUpdated: Boolean(payload.urlUpdated),
    forcedFromNonStreamFallback: Boolean(payload.forcedFromNonStreamFallback),
  };
}

export function normalizeAgentResponsePayload(payload = {}) {
  return buildAgentResponsePayload(payload);
}
