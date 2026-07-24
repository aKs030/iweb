const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken({ token, secret, remoteIp }) {
  if (!secret) return { success: true, skipped: true };
  if (!token) return { success: false, errorCodes: ["missing-input-response"] };

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);
  body.set("idempotency_key", crypto.randomUUID());

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
    });
    if (!response.ok) {
      return { success: false, errorCodes: ["siteverify-unavailable"] };
    }

    const result = await response.json();
    return {
      success: result?.success === true,
      errorCodes: Array.isArray(result?.["error-codes"]) ? result["error-codes"] : [],
    };
  } catch {
    return { success: false, errorCodes: ["siteverify-unavailable"] };
  }
}
