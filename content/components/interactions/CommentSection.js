import React from "react";
import htm from "htm";
import { fetchJSON } from "../../core/utils/index.js";
import { createLogger } from "../../core/logger.js";

const html = htm.bind(React.createElement);
const log = createLogger("CommentSection");
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let turnstileScriptPromise = null;

function loadTurnstileScript() {
  if (globalThis.turnstile) return Promise.resolve(globalThis.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
    const script = existing || document.createElement("script");
    script.addEventListener("load", () => resolve(globalThis.turnstile), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Turnstile konnte nicht geladen werden")),
      {
        once: true,
      }
    );
    if (!existing) {
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return turnstileScriptPromise;
}

/**
 * Premium Comment Section Component
 */
export const CommentSection = ({ postId }) => {
  const [comments, setComments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [author, setAuthor] = React.useState("");
  const [content, setContent] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [turnstileSiteKey, setTurnstileSiteKey] = React.useState("");
  const [turnstileToken, setTurnstileToken] = React.useState("");
  const turnstileContainerRef = React.useRef(null);
  const turnstileWidgetRef = React.useRef(null);

  React.useEffect(() => {
    if (!postId) return;

    setLoading(true);
    (async () => {
      try {
        const data = await fetchJSON(`/api/comments?post_id=${encodeURIComponent(postId)}`, {
          retries: 1,
        });
        if (data?.comments) setComments(data.comments);
      } catch (e) {
        log.error("Error fetching comments", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [postId]);

  React.useEffect(() => {
    fetchJSON("/api/comments?config=turnstile", { retries: 1 })
      .then(data => setTurnstileSiteKey(String(data?.turnstileSiteKey || "")))
      .catch(error => log.warn("Turnstile config unavailable", error));
  }, []);

  React.useEffect(() => {
    if (!turnstileSiteKey || !turnstileContainerRef.current) return undefined;
    let cancelled = false;

    loadTurnstileScript()
      .then(turnstile => {
        if (cancelled || !turnstile?.render || !turnstileContainerRef.current) return;
        turnstileWidgetRef.current = turnstile.render(turnstileContainerRef.current, {
          sitekey: turnstileSiteKey,
          theme: "auto",
          callback: token => setTurnstileToken(String(token || "")),
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => setTurnstileToken(""),
        });
      })
      .catch(error => setError(error.message));

    return () => {
      cancelled = true;
      if (globalThis.turnstile?.remove && turnstileWidgetRef.current !== null) {
        globalThis.turnstile.remove(turnstileWidgetRef.current);
      }
      turnstileWidgetRef.current = null;
    };
  }, [turnstileSiteKey]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!author.trim() || !content.trim()) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    if (turnstileSiteKey && !turnstileToken) {
      setError("Bitte bestätige zuerst die Bot-Prüfung.");
      setSubmitting(false);
      return;
    }

    try {
      const data = await fetchJSON("/api/comments", {
        fetchOptions: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            post_id: postId,
            author_name: author,
            content,
            turnstile_token: turnstileToken,
          }),
        },
        retries: 1,
        throwOnHTTPError: false,
      });
      if (data.success) {
        setAuthor("");
        setContent("");
        setTurnstileToken("");
        setSuccess(data.message || "Dein Kommentar wartet auf Freigabe.");
        if (globalThis.turnstile?.reset && turnstileWidgetRef.current !== null) {
          globalThis.turnstile.reset(turnstileWidgetRef.current);
        }
      } else {
        setError(data.error || "Fehler beim Senden");
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSubmitting(false);
    }
  };

  return html`
    <section className="comment-section">
      <h3 className="comment-title">Gedanken & Feedback (${comments.length})</h3>

      <form className="comment-form" onSubmit=${handleSubmit}>
        <div className="form-group">
          <input
            type="text"
            placeholder="Dein Name"
            value=${author}
            onInput=${e => setAuthor(e.target.value)}
            required
            className="comment-input"
          />
        </div>
        <div className="form-group">
          <textarea
            placeholder="Was denkst du darüber? Teile dein Feedback..."
            value=${content}
            onInput=${e => setContent(e.target.value)}
            required
            className="comment-textarea"
          ></textarea>
        </div>
        ${error && html`<p className="comment-error">${error}</p>`}
        ${success && html`<p className="comment-success" role="status">${success}</p>`}
        ${
          turnstileSiteKey &&
          html`<div className="comment-turnstile" ref=${turnstileContainerRef}></div>`
        }
        <button type="submit" className="btn btn-primary" disabled=${submitting}>
          ${submitting ? "Abgeschickt..." : "Beitrag posten"}
        </button>
      </form>

      <div className="comment-list">
        ${
          loading
            ? html`<p>Lade Interaktionen...</p>`
            : comments.length === 0
              ? html`<p className="no-comments">
                  Bisher noch keine Gedanken geteilt. Sei der Erste!
                </p>`
              : comments.map(
                  c => html`
                    <div key=${c.id} className="comment-item">
                      <div className="comment-header">
                        <strong className="comment-author">${c.author_name}</strong>
                        <time className="comment-date"
                          >${new Date(c.created_at).toLocaleDateString()}</time
                        >
                      </div>
                      <p className="comment-content">${c.content}</p>
                    </div>
                  `
                )
        }
      </div>
    </section>
  `;
};
