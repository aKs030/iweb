import {
  authorizeAdmin,
  buildAdminSessionClearCookie,
  buildAdminSessionCookie,
  jsonResponse,
} from "./_admin-utils.js";

function getPasswordFromBody(body) {
  return String(body?.password || "").trim();
}

export async function onRequestGet(context) {
  const auth = await authorizeAdmin(context.request, context.env);
  if (!auth.ok) {
    return jsonResponse({
      authenticated: false,
    });
  }

  return jsonResponse({
    authenticated: true,
    authType: auth.authType || "session",
  });
}

export async function onRequestPost(context) {
  const expectedToken = String(context.env?.ADMIN_TOKEN || "").trim();
  if (!expectedToken) {
    return jsonResponse(
      {
        success: false,
        error: "Admin configuration error: ADMIN_TOKEN is missing",
        code: "admin_token_missing",
      },
      500,
    );
  }

  const body = await context.request.json().catch(() => ({}));
  const password = getPasswordFromBody(body);
  if (!password || password !== expectedToken) {
    return jsonResponse(
      {
        success: false,
        error: "Unauthorized",
        code: "unauthorized",
      },
      401,
    );
  }

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    await buildAdminSessionCookie(context.request, context.env),
  );

  return jsonResponse(
    {
      success: true,
      authenticated: true,
      text: "Admin-Session gestartet.",
    },
    200,
    headers,
  );
}

export async function onRequestDelete(context) {
  const headers = new Headers();
  headers.append("Set-Cookie", buildAdminSessionClearCookie(context.request));

  return jsonResponse(
    {
      success: true,
      authenticated: false,
      text: "Admin-Session beendet.",
    },
    200,
    headers,
  );
}
