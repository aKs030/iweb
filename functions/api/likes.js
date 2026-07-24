/**
 * API function to handle rating/likes of portfolio projects using Cloudflare D1
 */
import { createLogger } from "../../content/core/logger.js";
import { errorJsonResponse, jsonResponse } from "./_response.js";
import { getRequestClientIp } from "./_request-utils.js";

const log = createLogger("likes");

function requireDb(env) {
  const db = env.DB_LIKES;
  if (!db) {
    log.warn("DB_LIKES binding is missing. Ensure D1 is configured.");
    return { db: null, error: errorJsonResponse("DB_LIKES binding missing", { status: 503 }) };
  }
  return { db, error: null };
}

export async function onRequestGet(context) {
  const { env } = context;
  const projectId = new URL(context.request.url).searchParams.get("project_id");

  if (!projectId) return errorJsonResponse("Missing project_id", { status: 400 });

  try {
    const { db, error } = requireDb(env);
    if (error) return error;

    const result = await db
      .prepare("SELECT likes FROM project_likes WHERE project_id = ?")
      .bind(projectId)
      .first();

    return jsonResponse({ likes: result?.likes ?? 0 });
  } catch (error) {
    log.error("Error fetching likes:", error);
    return errorJsonResponse(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let projectId = new URL(request.url).searchParams.get("project_id");

  if (!projectId) {
    try {
      const body = await request.json();
      if (body.project_id) projectId = body.project_id;
    } catch {
      // ignore
    }
  }

  if (!projectId) return errorJsonResponse("Missing project_id in query or body", { status: 400 });

  try {
    const { db, error } = requireDb(env);
    if (error) return error;

    const sourceIp = getRequestClientIp(request);
    const userAgent = String(request.headers.get("User-Agent") || "").trim();
    const requestId = String(request.headers.get("CF-Ray") || crypto.randomUUID()).trim();

    await db.batch([
      db
        .prepare(
          `
        INSERT INTO project_like_events (project_id, source_ip, user_agent, request_id)
        VALUES (?, ?, ?, ?)
      `
        )
        .bind(projectId, sourceIp, userAgent, requestId),
      db
        .prepare(
          `
        INSERT INTO project_likes (project_id, likes)
        VALUES (?, 1)
        ON CONFLICT(project_id) DO UPDATE SET likes = likes + 1
      `
        )
        .bind(projectId),
    ]);

    const result = await db
      .prepare("SELECT likes FROM project_likes WHERE project_id = ?")
      .bind(projectId)
      .first();

    return jsonResponse({ likes: Number(result?.likes) || 0 });
  } catch (error) {
    log.error("Error adding like:", error);
    return errorJsonResponse("Internal Server Error", { status: 500 });
  }
}
