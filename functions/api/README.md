# API Utilities

Shared utility modules for Cloudflare Pages Functions.

## Modules

### Core Utilities

- **`_xml-utils.js`** - XML/URL processing
  - `escapeXml()` - XML character escaping
  - `normalizePath()` - URL path normalization
  - `resolveOrigin()` - Origin URL resolution
  - `toISODate()` - ISO date conversion
  - `toAbsoluteUrl()` - Relative to absolute URLs

- **`_text-utils.js`** - Text processing
  - `normalizeText()` - Text normalization with fallback
  - `sanitizeDiscoveryText()` - Discovery text cleanup
  - `formatSlug()` - Slug to readable text

- **`_html-utils.js`** - HTML processing
  - `escapeHtml()` - HTML entity escaping for XSS prevention

### Search & Content

- **`_search-utils.js`** - Search functionality
  - Query expansion with synonyms
  - Fuzzy matching (Levenshtein distance)
  - Relevance scoring
  - URL normalization
  - Snippet generation

- **`_cleanup-patterns.js`** - Text cleanup
  - 60+ regex patterns for content cleaning
  - HTML entity decoding
  - Site-specific artifact removal

### External Services

- **`_youtube-utils.js`** - YouTube API integration
  - `fetchUploadsPlaylistId()` - Get uploads playlist
  - `toYoutubeDate()` - Date format conversion
  - `getBestYouTubeThumbnail()` - Optimal thumbnail selection

## Usage

```javascript
// Import utilities
import { escapeXml, normalizePath } from './_xml-utils.js';
import { normalizeText } from './_text-utils.js';
import { escapeHtml } from './_html-utils.js';

// Use in your API endpoints
const safeText = escapeXml(userInput);
const cleanPath = normalizePath('/blog/post/');
```

## Naming Convention

Files prefixed with `_` are utility modules, not API endpoints.
