# API Functions

This directory contains server-side logic powered by Cloudflare Pages Functions.

## Core API Endpoints

- **`search.js`** - Central search API combining Cloudflare AI Search (Vectorize) and deterministic fallback logic.
- **`ai.js`** - AI Chat endpoint using RAG (Retrieval-Augmented Generation) and Groq.
- **`contact.js`** - Contact form handler (email sending).
- **`gallery-items.js`** - Media API for the gallery (R2 storage listing).

## Shared Utilities

- **`_search-query.js`** - Query parsing, synonym expansion, regex compilation.
- **`_search-scoring.js`** - Relevance scoring algorithms (lexical + vector combination).
- **`_search-content.js`** - Snippet generation, highlighting, text cleaning.
- **`_search-url.js`** - URL normalization, category detection, title extraction.
- **`_search-results.js`** - Deduplication, result balancing, formatting.
- **`_search-data.js`** - Static fallback data, synonyms configuration, intent rules.
- **`_cors.js`** - CORS handling middleware.
- **`_text-utils.js`** - General text processing (seo, sitemap).
- **`_html-utils.js`** - HTML escaping helpers.
- **`_xml-utils.js`** - XML generation for sitemaps.

## Search Architecture

The search system is a hybrid engine:

1.  **Intent Analysis:** Checks if the query matches specific sections (e.g., "blog", "projects").
2.  **Vector Search:** Uses Cloudflare AI (Workers AI + Vectorize) for semantic understanding.
3.  **Lexical Fallback:** Deterministic scoring for exact matches and known routes (useful if AI is slow or cold).
4.  **Result Balancing:** Ensures diversity in results (e.g., not just 10 blog posts).

## Development

Run tests:

```bash
npm run check
```
