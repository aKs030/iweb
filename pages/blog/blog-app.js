/* global React, ReactDOM */
import htm from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.module.js'
import {blogPosts} from './blog-data.js'

const html = htm.bind(React.createElement)

// Icons
const Clock = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
`

const ArrowRight = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
`

function BlogApp() {
  const [filter, setFilter] = React.useState('All')

  // Extract unique categories
  const categories = ['All', ...new Set(blogPosts.map(post => post.category))]

  const filteredPosts = filter === 'All' ? blogPosts : blogPosts.filter(post => post.category === filter)

  return html`
    <div className="container-blog">
      <!-- Header Section -->
      <header>
        <h1 className="blog-headline">Wissen & Einblicke</h1>
        <p className="blog-subline">
          Gedanken zu Web-Entwicklung, Fotografie und digitalem Design. Hier teile ich, was ich lerne und erschaffe.
        </p>
      </header>

      <!-- Filter -->
      <div className="filter-bar">
        ${categories.map(
          cat => html`
            <button key=${cat} className=${`filter-btn ${filter === cat ? 'active' : ''}`} onClick=${() => setFilter(cat)}>${cat}</button>
          `
        )}
      </div>

      <!-- Grid -->
      <div className="blog-grid">
        ${filteredPosts.map(
          post => html`
            <article key=${post.id} className="blog-card">
              <div className="card-header">
                <span className="card-category">${post.category}</span>
                <span className="card-date">${post.date}</span>
              </div>

              <h2 className="card-title">${post.title}</h2>
              <p className="card-excerpt">${post.excerpt}</p>

              <div className="card-footer">
                <span className="card-read-time">
                  <${Clock} />
                  ${post.readTime}
                </span>
                <button className="btn-read">
                  Lesen
                  <${ArrowRight} />
                </button>
              </div>
            </article>
          `
        )}
      </div>

      <!-- Empty State -->
      ${filteredPosts.length === 0 &&
      html`
        <div style=${{textAlign: 'center', padding: '4rem', color: '#64748b'}}>
          <p>Keine Artikel in dieser Kategorie gefunden.</p>
        </div>
      `}
    </div>
  `
}

// Init
const rootEl = document.getElementById('root')
if (rootEl && window.ReactDOM && window.React) {
  const root = ReactDOM.createRoot(rootEl)
  root.render(html`
    <${BlogApp} />
  `)
} else {
  // Silent fail in production
  if (typeof console !== 'undefined') console.error('React environment not ready')
}
