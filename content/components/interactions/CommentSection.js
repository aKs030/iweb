import React from 'react';
import htm from 'htm';

const html = htm.bind(React.createElement);

/**
 * Premium Comment Section Component
 */
export const CommentSection = ({ postId }) => {
  const [comments, setComments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [author, setAuthor] = React.useState('');
  const [content, setContent] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!postId) return;

    setLoading(true);
    fetch(`/api/comments?post_id=${encodeURIComponent(postId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.comments) setComments(data.comments);
      })
      .catch((e) => console.error('Error fetching comments', e))
      .finally(() => setLoading(false));
  }, [postId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!author.trim() || !content.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, author_name: author, content }),
      });
      const data = await res.json();
      if (data.success) {
        setComments([data.comment, ...comments]);
        setAuthor('');
        setContent('');
      } else {
        setError(data.error || 'Fehler beim Senden');
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setSubmitting(false);
    }
  };

  return html`
    <section className="comment-section">
      <h3 className="comment-title">
        Gedanken & Feedback (${comments.length})
      </h3>

      <form className="comment-form" onSubmit=${handleSubmit}>
        <div className="form-group">
          <input
            type="text"
            placeholder="Dein Name"
            value=${author}
            onInput=${(e) => setAuthor(e.target.value)}
            required
            className="comment-input"
          />
        </div>
        <div className="form-group">
          <textarea
            placeholder="Was denkst du darüber? Teile dein Feedback..."
            value=${content}
            onInput=${(e) => setContent(e.target.value)}
            required
            className="comment-textarea"
          ></textarea>
        </div>
        ${error && html`<p className="comment-error">${error}</p>`}
        <button
          type="submit"
          className="btn btn-primary"
          disabled=${submitting}
        >
          ${submitting ? 'Abgeschickt...' : 'Beitrag posten'}
        </button>
      </form>

      <div className="comment-list">
        ${loading
          ? html`<p>Lade Interaktionen...</p>`
          : comments.length === 0
            ? html`<p className="no-comments">
                Bisher noch keine Gedanken geteilt. Sei der Erste!
              </p>`
            : comments.map(
                (c) => html`
                  <div key=${c.id} className="comment-item">
                    <div className="comment-header">
                      <strong className="comment-author"
                        >${c.author_name}</strong
                      >
                      <time className="comment-date"
                        >${new Date(c.created_at).toLocaleDateString()}</time
                      >
                    </div>
                    <p className="comment-content">${c.content}</p>
                  </div>
                `,
              )}
      </div>
    </section>
  `;
};
