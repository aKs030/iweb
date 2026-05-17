import React from "react";
import htm from "htm";
import { Heart, Rocket } from "../icons/icons.js";
import { fetchJSON } from "#core/fetch.js";
import { createLogger } from "#core/logger.js";

const html = htm.bind(React.createElement);
const log = createLogger("LikeButton");

/**
 * Unified, Premium Like Button Component
 */
export const LikeButton = ({ id, type = "project", className = "" }) => {
  const [likes, setLikes] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [localLike, setLocalLike] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);

  const storageKey = `liked_${type}_${id}`;

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLocalLike(localStorage.getItem(storageKey) === "true");

    (async () => {
      try {
        const data = await fetchJSON(`/api/likes?project_id=${encodeURIComponent(id)}`, {
          retries: 1,
        });
        if (data?.likes !== undefined) setLikes(data.likes);
      } catch (e) {
        log.error("Error fetching likes", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, storageKey]);

  const handleLike = async () => {
    if (localLike || isAnimating) return;

    const previousLikes = likes;
    setIsAnimating(true);
    setLocalLike(true);
    setLikes(previousLikes + 1);

    try {
      const payload = await fetchJSON(`/api/likes?project_id=${encodeURIComponent(id)}`, {
        fetchOptions: {
          method: "POST",
        },
        retries: 1,
        throwOnHTTPError: false,
      });

      if (typeof payload?.likes !== "number") {
        throw new Error(payload?.error || "Like konnte nicht gespeichert werden.");
      }

      setLikes(payload.likes);
      localStorage.setItem(storageKey, "true");
    } catch (e) {
      log.error("Error sending like", e);
      setLocalLike(false);
      setLikes(previousLikes);
    }

    setTimeout(() => setIsAnimating(false), 1000);
  };

  return html`
    <button
      type="button"
      className=${`btn-modern-clap ${localLike ? "is-liked" : ""} ${isAnimating ? "is-animating" : ""} ${className}`}
      onClick=${handleLike}
      disabled=${loading || localLike}
    >
      <div className="clap-icon-wrapper">
        <${Heart} className="clap-icon-main" />
        ${isAnimating && html`<${Heart} className="clap-icon-bloom" />`}
        ${isAnimating && html`<${Rocket} className="clap-icon-particle" />`}
      </div>
      <span className="clap-count">
        ${loading ? "..." : likes === 0 ? "Like" : `${likes} ${likes === 1 ? "Like" : "Likes"}`}
      </span>
    </button>
  `;
};
