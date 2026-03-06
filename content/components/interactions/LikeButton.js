import React from 'react';
import htm from 'htm';
import { Heart, Rocket } from '../icons/icons.js';

const html = htm.bind(React.createElement);

/**
 * Unified, Premium Like Button Component
 */
export const LikeButton = ({ id, type = 'project', className = '' }) => {
  const [likes, setLikes] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [localLike, setLocalLike] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);

  const storageKey = `liked_${type}_${id}`;

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLocalLike(localStorage.getItem(storageKey) === 'true');

    fetch(`/api/likes?project_id=${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.likes !== undefined) setLikes(data.likes);
      })
      .catch((e) => console.error('Error fetching likes', e))
      .finally(() => setLoading(false));
  }, [id, storageKey]);

  const handleLike = async () => {
    if (localLike || isAnimating) return;

    setIsAnimating(true);
    setLocalLike(true);
    setLikes((prev) => prev + 1);
    localStorage.setItem(storageKey, 'true');

    try {
      await fetch(`/api/likes?project_id=${encodeURIComponent(id)}`, {
        method: 'POST',
      });
    } catch (e) {
      console.error('Error sending like', e);
    }

    setTimeout(() => setIsAnimating(false), 1000);
  };

  return html`
    <button
      type="button"
      className=${`btn-modern-clap ${localLike ? 'is-liked' : ''} ${isAnimating ? 'is-animating' : ''} ${className}`}
      onClick=${handleLike}
      disabled=${loading || localLike}
    >
      <div className="clap-icon-wrapper">
        <${Heart} className="clap-icon-main" />
        ${isAnimating && html`<${Heart} className="clap-icon-bloom" />`}
        ${isAnimating && html`<${Rocket} className="clap-icon-particle" />`}
      </div>
      <span className="clap-count">
        ${loading
          ? '...'
          : likes === 0
            ? 'Like'
            : `${likes} ${likes === 1 ? 'Like' : 'Likes'}`}
      </span>
    </button>
  `;
};
