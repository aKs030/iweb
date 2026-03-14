/**
 * SSE Stream Parser – Extracted from ai-agent-service.js
 * Handles Server-Sent Events parsing and stream idle guards.
 * @version 1.0.0
 */

/**
 * Abort a controller with an optional reason string.
 * @param {AbortController} controller
 * @param {string} reason
 */
export function abortControllerWithReason(controller, reason) {
  if (!controller || controller.signal.aborted) return;
  controller.__julesAbortReason = reason;
  try {
    controller.abort(reason);
  } catch {
    controller.abort();
  }
}

/**
 * Create a timer that aborts the controller after `timeoutMs`.
 * Returns a cleanup function to clear the timer.
 * @param {AbortController} controller
 * @param {number} timeoutMs
 * @param {string} reason
 * @returns {() => void}
 */
export function createAbortTimer(controller, timeoutMs, reason) {
  if (!(timeoutMs > 0)) return () => {};

  const timeoutId = setTimeout(() => {
    abortControllerWithReason(controller, reason);
  }, timeoutMs);

  return () => clearTimeout(timeoutId);
}

/**
 * Guard that re-starts an idle timer on every `touch()` call.
 * If no touch happens within `idleTimeoutMs` the controller is aborted.
 * @param {AbortController} controller
 * @param {number} idleTimeoutMs
 * @returns {{ touch: () => void, stop: () => void }}
 */
export function createStreamIdleGuard(controller, idleTimeoutMs) {
  if (!(idleTimeoutMs > 0)) {
    return { touch() {}, stop() {} };
  }

  let timeoutId = null;
  const touch = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      abortControllerWithReason(controller, "stream-idle");
    }, idleTimeoutMs);
  };

  const stop = () => {
    if (!timeoutId) return;
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  touch();
  return { touch, stop };
}

/**
 * Check whether an error is an AbortError or TimeoutError.
 * @param {Error} error
 * @returns {boolean}
 */
export function isAbortLikeError(error) {
  return (
    error?.name === "AbortError" ||
    error?.name === "TimeoutError" ||
    error?.code === 20
  );
}

/**
 * Resolve the human-readable abort reason.
 * @param {object|null} service
 * @param {AbortController} controller
 * @returns {string}
 */
export function getAbortReason(service, controller) {
  return (
    (service && service._activeController === controller
      ? service._activeAbortReason
      : null) ||
    controller?.__julesAbortReason ||
    "aborted"
  );
}

/**
 * Map abort reason to user-facing text.
 * @param {string} reason
 * @returns {string}
 */
export function getAbortResultText(reason) {
  switch (reason) {
    case "request-timeout":
    case "stream-idle":
      return "Die Antwort dauert zu lange. Bitte versuche es erneut.";
    case "history-cleared":
    case "destroyed":
    case "cancelled":
      return "";
    default:
      return "Die Anfrage wurde abgebrochen. Bitte versuche es erneut.";
  }
}

// ─── SSE Event Processing ───────────────────────────────────────────────────────

/**
 * Process a single SSE event block.
 * @param {string} eventBlock
 * @param {object} callbacks
 * @param {{ current: object|null }} finalMessageRef
 * @param {(id: string) => void} onIdentity
 */
export function processSSEEventBlock(
  eventBlock,
  callbacks,
  finalMessageRef,
  onIdentity,
) {
  if (!eventBlock.trim()) return;

  let eventType = "";
  const dataLines = [];

  for (const rawLine of eventBlock.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  const eventData = dataLines.join("\n").trim();
  if (!eventType || !eventData || eventData === "[DONE]") return;

  let data;
  try {
    data = JSON.parse(eventData);
  } catch {
    return;
  }

  switch (eventType) {
    case "identity":
      if (data.userId) onIdentity(data.userId);
      break;
    case "token":
      callbacks.onToken?.(data.text || "");
      break;
    case "tool":
      callbacks.onTool?.(data);
      break;
    case "status":
      callbacks.onStatus?.(data.phase || "");
      break;
    case "message":
      finalMessageRef.current = data;
      callbacks.onMessage?.(data);
      break;
    case "error":
      callbacks.onError?.(data);
      break;
    default:
      break;
  }
}

/**
 * Parse a streaming SSE response.
 * @param {Response} response
 * @param {object} callbacks
 * @param {{ idleGuard?: object, onIdentity?: (id: string) => void }} options
 * @returns {Promise<object|null>}
 */
export async function parseSSEStream(response, callbacks = {}, options = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const finalMessageRef = { current: null };
  const idleGuard = options.idleGuard || null;
  const onIdentity = options.onIdentity || (() => {});

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      idleGuard?.touch();

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const event of events) {
        processSSEEventBlock(event, callbacks, finalMessageRef, onIdentity);
      }
    }

    buffer += decoder.decode();
    processSSEEventBlock(buffer, callbacks, finalMessageRef, onIdentity);
  } finally {
    idleGuard?.stop?.();
    reader.releaseLock();
  }

  return finalMessageRef.current;
}

// ─── Utility ────────────────────────────────────────────────────────────────────

/**
 * Stable JSON serialisation for deduplication keys.
 * @param {*} value
 * @returns {string}
 */
export function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

/**
 * Create a unique key from a tool call for deduplication.
 * @param {{ name?: string, arguments?: object }} toolCall
 * @returns {string}
 */
export function createToolCallKey(toolCall) {
  return `${String(toolCall?.name || "").trim()}:${stableSerialize(toolCall?.arguments || {})}`;
}
