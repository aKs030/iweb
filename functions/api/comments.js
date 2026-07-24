import { createLogger } from "../../content/core/logger.js";
import { TURNSTILE_COMMENT_ACTION } from "../../content/core/turnstile-config.js";

const log = createLogger("comments");
/**
 * API function to handle blog comments using Cloudflare D1
 */

import { escapeHtml } from "../../content/core/utils/index.js";
import { createWindowRateLimiter } from "./_rate-limit.js";
import { errorJsonResponse, jsonResponse } from "./_response.js";
import { getRequestClientIp } from "./_request-utils.js";
import { verifyTurnstileToken } from "./_turnstile.js";

const COMMENT_RATE_LIMIT = 5;
const COMMENT_RATE_WINDOW_SECONDS = 3600;
const commentRateLimiter = createWindowRateLimiter({
  keyNamespace: "comment_write:v1",
  maxEntries: 2000,
});

function getTurnstileHostnames(env) {
  return String(env?.TURNSTILE_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map(hostname => hostname.trim())
    .filter(Boolean);
}

function getBlockedTerms(env) {
  return String(env?.COMMENT_BLOCKLIST || "")
    .split(",")
    .map(term => term.trim().toLocaleLowerCase("de"))
    .filter(Boolean);
}

function getSpamReason(authorName, content, env) {
  const normalized = `${authorName} ${content}`.toLocaleLowerCase("de");
  const blockedTerm = getBlockedTerms(env).find(term => normalized.includes(term));
  if (blockedTerm) return "blocked-term";

  const links = normalized.match(/https?:\/\/|www\./g) || [];
  if (links.length > 2) return "too-many-links";
  if (/(.)\1{12,}/u.test(normalized)) return "repeated-characters";
  return "";
}

async function notifyPendingComment(env, comment) {
  if (!env?.RESEND_API_KEY || !env?.COMMENT_NOTIFICATION_EMAIL) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `Portfolio Moderation <${env.CONTACT_FROM_EMAIL || "onboarding@resend.dev"}>`,
      to: [env.COMMENT_NOTIFICATION_EMAIL],
      subject: `Neuer Kommentar wartet auf Freigabe: ${escapeHtml(comment.postId)}`,
      html: `<p><strong>${escapeHtml(comment.authorName)}</strong> kommentierte auf <code>${escapeHtml(
        comment.postId
      )}</code>:</p><blockquote>${escapeHtml(comment.content)}</blockquote>`,
    }),
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.searchParams.get("config") === "turnstile") {
    return jsonResponse({
      turnstileSiteKey: String(env.TURNSTILE_SITE_KEY || ""),
    });
  }

  const postId = url.searchParams.get("post_id");

  if (!postId) {
    return errorJsonResponse("Missing post_id", {
      status: 400,
    });
  }

  try {
    const db = env.DB_LIKES; // Sharing the same DB binding for simplicity, or use a separate if configured

    if (!db) {
      return jsonResponse({ comments: [], _warning: "DB not bound" });
    }

    const { results } = await db
      .prepare(
        "SELECT id, author_name, content, created_at FROM blog_comments WHERE post_id = ? AND status = 'approved' ORDER BY created_at DESC"
      )
      .bind(postId)
      .all();

    return jsonResponse({ comments: results });
  } catch (error) {
    log.error("Error fetching comments:", error);
    return errorJsonResponse("Internal Server Error", {
      status: 500,
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const clientIp = getRequestClientIp(request);
    const rateLimit = await commentRateLimiter.check(clientIp, {
      kv: env.RATE_LIMIT_KV,
      limit: COMMENT_RATE_LIMIT,
      windowSeconds: COMMENT_RATE_WINDOW_SECONDS,
    });
    if (!rateLimit.allowed) {
      return errorJsonResponse("Zu viele Kommentare. Bitte versuche es später erneut.", {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter || COMMENT_RATE_WINDOW_SECONDS),
        },
      });
    }

    const body = await request.json();
    const postId = String(body?.post_id || "").trim();
    const authorName = String(body?.author_name || "").trim();
    const content = String(body?.content || "").trim();
    const turnstileToken = String(body?.turnstile_token || "").trim();

    if (!postId || !authorName || !content) {
      return errorJsonResponse("Missing required fields", {
        status: 400,
      });
    }

    if (postId.length > 160 || content.length > 1000 || authorName.length > 50) {
      return errorJsonResponse("Content too long", {
        status: 400,
      });
    }

    const turnstile = await verifyTurnstileToken({
      token: turnstileToken,
      secret: env.TURNSTILE_SECRET_KEY,
      remoteIp: clientIp,
      expectedAction: TURNSTILE_COMMENT_ACTION,
      expectedHostnames: getTurnstileHostnames(env),
    });
    if (!turnstile.success) {
      log.warn("Turnstile validation failed", {
        postId,
        errorCodes: turnstile.errorCodes,
      });
      return errorJsonResponse("Bot-Prüfung fehlgeschlagen. Bitte versuche es erneut.", {
        status: 400,
      });
    }

    const spamReason = getSpamReason(authorName, content, env);
    if (spamReason) {
      log.warn("Comment rejected by spam rules", { postId, spamReason });
      return errorJsonResponse("Der Kommentar wurde vom Spamfilter abgelehnt.", {
        status: 400,
      });
    }

    const db = env.DB_LIKES;

    if (!db) {
      return errorJsonResponse("Database not available", {
        status: 500,
      });
    }

    const result = await db
      .prepare(
        "INSERT INTO blog_comments (post_id, author_name, content, status) VALUES (?, ?, ?, 'pending') RETURNING id, created_at"
      )
      .bind(postId, authorName, content)
      .first();

    if (context.waitUntil) {
      context.waitUntil(
        notifyPendingComment(env, {
          postId,
          authorName,
          content,
        }).catch(error => log.warn("Comment notification failed", String(error)))
      );
    }

    return jsonResponse(
      {
        success: true,
        pending: true,
        id: result.id,
        created_at: result.created_at,
        message: "Danke! Dein Kommentar wird nach einer kurzen Prüfung veröffentlicht.",
      },
      { status: 202 }
    );
  } catch (error) {
    log.error("Error adding comment:", error);
    return errorJsonResponse("Internal Server Error", {
      status: 500,
    });
  }
}
