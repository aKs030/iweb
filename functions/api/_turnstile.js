const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TOKEN_LENGTH = 2_048;

function normalizeHostname(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

export async function verifyTurnstileToken({
  token,
  secret,
  remoteIp,
  expectedAction,
  expectedHostnames = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!secret) return { success: false, errorCodes: ["missing-input-secret"] };
  if (!token) return { success: false, errorCodes: ["missing-input-response"] };
  if (token.length > MAX_TOKEN_LENGTH) {
    return { success: false, errorCodes: ["invalid-input-response"] };
  }

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);
  body.set("idempotency_key", crypto.randomUUID());

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS)),
    });
    if (!response.ok) {
      return { success: false, errorCodes: ["siteverify-unavailable"] };
    }

    const result = await response.json();
    const hostname = normalizeHostname(result?.hostname);
    const action = String(result?.action || "");
    const allowedHostnames = (Array.isArray(expectedHostnames) ? expectedHostnames : [])
      .map(normalizeHostname)
      .filter(Boolean);
    const hostnameMatches = allowedHostnames.length > 0 && allowedHostnames.includes(hostname);
    const actionMatches = Boolean(expectedAction) && action === expectedAction;
    const errorCodes = Array.isArray(result?.["error-codes"]) ? [...result["error-codes"]] : [];

    if (result?.success === true && !hostnameMatches) {
      errorCodes.push("hostname-mismatch");
    }
    if (result?.success === true && !actionMatches) {
      errorCodes.push("action-mismatch");
    }

    return {
      success: result?.success === true && hostnameMatches && actionMatches,
      errorCodes,
      hostname,
      action,
    };
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      success: false,
      errorCodes: [timedOut ? "siteverify-timeout" : "siteverify-unavailable"],
    };
  }
}
