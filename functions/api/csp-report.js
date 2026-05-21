export async function onRequestPost(context) {
  try {
    const contentType = context.request.headers.get("content-type") || "";
    let payload = null;

    if (contentType.includes("application/json")) {
      payload = await context.request.json();
    } else {
      const text = await context.request.text();
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = { raw: text };
      }
    }

    // Log a trimmed version to the Worker logs for inspection
    try {
      console.warn("CSP-Report:", JSON.stringify(payload).slice(0, 10000));
    } catch {
      console.warn("CSP-Report (unserializable)");
    }

    // Optionally, if you have a KV binding configured (e.g. CSP_REPORTS_KV),
    // you could store reports for later analysis. That is intentionally
    // left out here to avoid failing when KV is not bound.

    return new Response("", { status: 204 });
  } catch (err) {
    console.error("csp-report error", String(err));
    return new Response("", { status: 500 });
  }
}
