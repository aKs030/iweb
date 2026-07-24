import React from "react";
import htm from "htm";
import { fetchJSON } from "../../core/utils/index.js";
import { createLogger } from "../../core/logger.js";
import { TURNSTILE_COMMENT_ACTION } from "../../core/turnstile-config.js";

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
    script.addEventListener(
      "load",
      () => {
        if (globalThis.turnstile) {
          resolve(globalThis.turnstile);
          return;
        }
        turnstileScriptPromise = null;
        script.remove();
        reject(new Error("Turnstile wurde nicht korrekt initialisiert"));
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => {
        turnstileScriptPromise = null;
        script.remove();
        reject(new Error("Turnstile konnte nicht geladen werden"));
      },
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
  const [turnstileConfigReady, setTurnstileConfigReady] = React.useState(false);
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
      .then(data => {
        const siteKey = String(data?.turnstileSiteKey || "");
        setTurnstileSiteKey(siteKey);
        if (!siteKey) {
          setError("Die Bot-Prüfung ist momentan nicht verfügbar.");
        }
      })
      .catch(error => {
        log.warn("Turnstile config unavailable", error);
        setError("Die Bot-Prüfung ist momentan nicht verfügbar.");
      })
      .finally(() => setTurnstileConfigReady(true));
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
          action: TURNSTILE_COMMENT_ACTION,
          callback: token => {
            setTurnstileToken(String(token || ""));
            setError("");
          },
          "expired-callback": () => setTurnstileToken(""),
          "timeout-callback": () => setTurnstileToken(""),
          "error-callback": () => {
            setTurnstileToken("");
            setError("Die Bot-Prüfung ist fehlgeschlagen. Bitte versuche es erneut.");
          },
          "unsupported-callback": () => {
            setTurnstileToken("");
            setError("Dieser Browser wird von der Bot-Prüfung nicht unterstützt.");
          },
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

    if (!turnstileConfigReady) {
      setError("Die Bot-Prüfung wird noch geladen.");
      setSubmitting(false);
      return;
    }

    if (!turnstileSiteKey) {
      setError("Die Bot-Prüfung ist momentan nicht verfügbar.");
      setSubmitting(false);
      return;
    }

    if (!turnstileToken) {
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
        setSuccess(data.message || "Dein Kommentar wartet auf Freigabe.");
      } else {
        setError(data.error || "Fehler beim Senden");
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setTurnstileToken("");
      if (globalThis.turnstile?.reset && turnstileWidgetRef.current !== null) {
        globalThis.turnstile.reset(turnstileWidgetRef.current);
      }
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
        <button
          type="submit"
          className="btn btn-primary"
          disabled=${submitting || !turnstileConfigReady || !turnstileSiteKey}
        >
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
