# Design Document: Cloudflare Managed AI Search Beta Migration

## Overview

This design addresses the migration from a manual Vectorize index to Cloudflare's Managed AI Search Beta. The primary issue is that Cloudflare's automatic crawler cannot access the sitemap.xml file, resulting in an empty index with 0 vectors. The solution involves ensuring proper sitemap deployment, verifying crawler accessibility, and validating that both the Search API and Robot Companion AI function correctly with the managed index.

The migration leverages Cloudflare's automatic crawling and indexing capabilities, eliminating the need for manual content uploads while maintaining the existing AI-powered search functionality.

## Architecture

### Current State

The system currently uses:

- **Vectorize Index**: `ai-search-plain-mountain-d6d0` (1024 dimensions)
- **Embedding Model**: `@cf/baai/bge-large-en-v1.5` (1024d)
- **Build System**: Vite with custom plugin for file copying
- **API Endpoints**: `/api/search` and `/api/ai` using Vectorize + AI bindings

### Target State

The target architecture maintains the same components but relies on Cloudflare's managed crawling:

- **Automatic Crawling**: Cloudflare discovers and indexes content via sitemap.xml
- **No Manual Uploads**: Content is automatically indexed without custom scripts
- **Same API Surface**: Existing search and AI endpoints remain unchanged
- **Improved Maintenance**: Index updates automatically when content changes

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Build System (Vite)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  htmlTemplatesPlugin.closeBundle()                     │ │
│  │  - Copies sitemap.xml to dist/                         │ │
│  │  - Copies sitemap-images.xml to dist/                  │ │
│  │  - Copies sitemap-videos.xml to dist/                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Pages Deployment                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Static Files Serving                                  │ │
│  │  - https://abdulkerimsesli.de/sitemap.xml             │ │
│  │  - https://abdulkerimsesli.de/sitemap-images.xml      │ │
│  │  - https://abdulkerimsesli.de/sitemap-videos.xml      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Managed Crawler                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. Fetch sitemap.xml                                  │ │
│  │  2. Parse URLs from sitemap                            │ │
│  │  3. Crawl each URL                                     │ │
│  │  4. Extract content                                    │ │
│  │  5. Generate embeddings (@cf/baai/bge-large-en-v1.5)  │ │
│  │  6. Store in Vectorize index                           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         Vectorize Index (ai-search-plain-mountain-d6d0)      │
│  - Stores 1024-dimensional vectors                          │
│  - Metadata: url, title, category, description              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Endpoints                             │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │  /api/search         │  │  /api/ai                     │ │
│  │  - Query embedding   │  │  - Query embedding           │ │
│  │  - Vector search     │  │  - Context retrieval         │ │
│  │  - Result formatting │  │  - LLM response generation   │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Build System Enhancement

**Component**: `vite.config.js` - `htmlTemplatesPlugin.closeBundle()`

**Current Implementation**:

```javascript
closeBundle() {
  const root = process.cwd();
  const dist = resolve(root, 'dist');
  const files = [
    '_redirects', '_headers', 'robots.txt',
    'sitemap.xml', 'sitemap-images.xml', 'sitemap-videos.xml',
    'manifest.json', 'sw.js', 'favicon.ico', 'favicon.svg',
  ];

  files.forEach((file) => {
    const src = resolve(root, file);
    const dest = resolve(dist, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  });
}
```

**Enhancement Required**:
Add validation to ensure sitemap.xml is successfully copied:

```javascript
closeBundle() {
  const root = process.cwd();
  const dist = resolve(root, 'dist');
  const files = [
    '_redirects', '_headers', 'robots.txt',
    'sitemap.xml', 'sitemap-images.xml', 'sitemap-videos.xml',
    'manifest.json', 'sw.js', 'favicon.ico', 'favicon.svg',
  ];

  const criticalFiles = ['sitemap.xml'];
  const copiedFiles = [];
  const missingFiles = [];

  files.forEach((file) => {
    const src = resolve(root, file);
    const dest = resolve(dist, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      copiedFiles.push(file);
      console.log(`✓ Copied: ${file}`);
    } else if (criticalFiles.includes(file)) {
      missingFiles.push(file);
      console.error(`✗ CRITICAL: Missing ${file}`);
    }
  });

  if (missingFiles.length > 0) {
    throw new Error(`Build failed: Critical files missing: ${missingFiles.join(', ')}`);
  }

  console.log(`\n✓ Build complete: ${copiedFiles.length} files copied`);
}
```

**Interface**:

- Input: Source files in project root
- Output: Files copied to `dist/` directory
- Side Effect: Console logging and error throwing on critical file absence

### 2. Sitemap Structure

**Component**: `sitemap.xml`

**Current Structure**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://www.abdulkerimsesli.de/</loc>
    <lastmod>2026-02-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <image:image>...</image:image>
  </url>
  <!-- Additional URLs -->
</urlset>
```

**Validation Requirements**:

- Valid XML syntax
- Proper namespace declarations
- All URLs use HTTPS
- URLs are absolute (not relative)
- lastmod dates are in ISO 8601 format
- Priority values between 0.0 and 1.0

**Interface**:

- Format: XML (Sitemap Protocol 0.9)
- Location: `/sitemap.xml` (root of domain)
- Content-Type: `application/xml` or `text/xml`
- Encoding: UTF-8

### 3. Cloudflare Crawler Integration

**Component**: Cloudflare Managed AI Search Crawler

**Behavior**:

1. Periodically fetches `https://abdulkerimsesli.de/sitemap.xml`
2. Parses XML to extract `<loc>` elements
3. Crawls each URL to extract content
4. Generates embeddings using `@cf/baai/bge-large-en-v1.5`
5. Stores vectors with metadata in Vectorize index

**Expected Metadata Structure**:

```javascript
{
  url: string,        // Normalized URL path
  title: string,      // Page title
  category: string,   // Content category
  description: string // Page description
}
```

**Crawler Logs** (Expected Success):

```
✓ Sitemap found: https://abdulkerimsesli.de/sitemap.xml
✓ 10 URLs collected
✓ 10 files seen
✓ Indexing complete: 10 vectors stored
```

**Interface**:

- Input: Sitemap URL (configured in Cloudflare dashboard)
- Output: Populated Vectorize index
- Monitoring: Cloudflare dashboard logs

### 4. Search API

**Component**: `functions/api/search.js`

**Current Implementation** (Already Updated):

- Uses `@cf/baai/bge-large-en-v1.5` for query embeddings (1024d)
- Queries Vectorize index with `topK` parameter
- Applies result deduplication and improvement
- Falls back to static results if Vectorize is empty

**Key Functions**:

```javascript
// Generate query embedding
const embeddingResponse = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
  text: query,
});
const queryVector = embeddingResponse.data[0];

// Search Vectorize
const vectorResults = await env.VECTOR_INDEX.query(queryVector, {
  topK: topK,
  returnMetadata: true,
});

// Process results
const results = vectorResults.matches.map((match) => ({
  url: match.metadata?.url || '/',
  title: match.metadata?.title || 'Seite',
  category: match.metadata?.category || 'Seite',
  description: match.metadata?.description || '',
  score: match.score || 0,
}));
```

**Interface**:

- Endpoint: `POST /api/search`
- Request Body: `{ query: string, topK?: number }`
- Response: `{ results: Array, summary: string, count: number, query: string }`
- Bindings Required: `env.AI`, `env.VECTOR_INDEX`

### 5. Robot Companion AI

**Component**: `functions/api/ai.js`

**Current Implementation** (Already Updated):

- Retrieves context using `@cf/baai/bge-large-en-v1.5` (1024d)
- Queries Vectorize for top 3 relevant results
- Augments LLM prompt with retrieved context
- Uses `@cf/meta/llama-3.1-8b-instruct` for response generation

**Key Functions**:

```javascript
async function getRelevantContext(query, env) {
  // Generate embedding
  const embeddingResponse = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
    text: query,
  });
  const queryVector = embeddingResponse.data[0];

  // Search Vectorize (top 3)
  const vectorResults = await env.VECTOR_INDEX.query(queryVector, {
    topK: 3,
    returnMetadata: true,
  });

  // Format context
  const contextParts = vectorResults.matches.map((match) => {
    const meta = match.metadata || {};
    return `Seite: ${meta.title}
URL: ${meta.url}
Kategorie: ${meta.category}
Beschreibung: ${meta.description}`;
  });

  return contextParts.join('\n\n---\n\n');
}
```

**Interface**:

- Endpoint: `POST /api/ai`
- Request Body: `{ prompt: string, systemInstruction?: string }`
- Response: `{ text: string, model: string, hasContext: boolean }`
- Bindings Required: `env.AI`, `env.VECTOR_INDEX`

## Data Models

### Vectorize Index Configuration

```javascript
{
  name: "ai-search-plain-mountain-d6d0",
  dimensions: 1024,
  metric: "cosine",  // Default for similarity search
  embeddingModel: "@cf/baai/bge-large-en-v1.5"
}
```

### Vector Metadata Schema

```typescript
interface VectorMetadata {
  url: string; // Normalized URL path (e.g., "/blog/threejs-performance")
  title: string; // Page title
  category: string; // Content category (e.g., "Blog", "Projekte")
  description: string; // Page description or excerpt
}
```

### Search Result Schema

```typescript
interface SearchResult {
  url: string; // Normalized URL path
  title: string; // Display title
  category: string; // Content category
  description: string; // Result description
  score: number; // Similarity score (0.0 - 1.0)
}
```

### Sitemap URL Entry

```xml
<url>
  <loc>string</loc>           <!-- Required: Absolute URL -->
  <lastmod>ISO8601</lastmod>  <!-- Optional: Last modification date -->
  <changefreq>string</changefreq> <!-- Optional: Change frequency -->
  <priority>float</priority>  <!-- Optional: Priority (0.0 - 1.0) -->
  <image:image>               <!-- Optional: Image metadata -->
    <image:loc>string</image:loc>
    <image:caption>string</image:caption>
    <image:title>string</image:title>
  </image:image>
</url>
```

## Error Handling

### Build-Time Errors

**Missing Sitemap**:

```javascript
if (!fs.existsSync(sitemapPath)) {
  throw new Error('Build failed: sitemap.xml not found in project root');
}
```

**Copy Failure**:

```javascript
try {
  fs.copyFileSync(src, dest);
} catch (error) {
  throw new Error(`Failed to copy ${file}: ${error.message}`);
}
```

### Runtime Errors

**Vectorize Query Failure**:

```javascript
try {
  const vectorResults = await env.VECTOR_INDEX.query(queryVector, { topK });
} catch (error) {
  console.error('Vectorize search error:', error.message);
  // Fall back to static results
  return staticFallbackResults;
}
```

**Embedding Generation Failure**:

```javascript
try {
  const embeddingResponse = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
    text: query,
  });
} catch (error) {
  console.error('Embedding generation failed:', error.message);
  return { error: 'Search temporarily unavailable' };
}
```

**Empty Index Handling**:

```javascript
if (!vectorResults.matches || vectorResults.matches.length === 0) {
  console.log('Vectorize index empty, using static fallback');
  return staticFallbackResults;
}
```

### Crawler Errors

**Sitemap Not Found** (Current Issue):

```
Error: Sitemap not found: https://abdulkerimsesli.de/sitemap.xml
Result: 0 files seen, 0 URLs collected
```

**Solution**: Ensure sitemap.xml is deployed and accessible at the root URL.

**Invalid Sitemap XML**:

```
Error: Failed to parse sitemap: Invalid XML syntax
```

**Solution**: Validate sitemap XML structure before deployment.

**Crawl Failures**:

```
Warning: Failed to crawl URL: https://abdulkerimsesli.de/some-page
Reason: 404 Not Found
```

**Solution**: Ensure all URLs in sitemap are accessible and return 200 status.

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Search Query Processing

_For any_ valid search query submitted to the Search API, the system SHALL generate embeddings using `@cf/baai/bge-large-en-v1.5`, query the Vectorize index, and return results ranked by descending similarity score.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 2: AI Context Retrieval

_For any_ message sent to the Robot Companion AI, the system SHALL retrieve relevant context from the Vectorize index using `@cf/baai/bge-large-en-v1.5` embeddings, and when relevant content exists, the response SHALL reference that content.

**Validates: Requirements 5.1, 5.4**

### Property 3: Sitemap Filename Preservation

_For any_ sitemap file (sitemap.xml, sitemap-images.xml, sitemap-videos.xml) that exists in the source directory, the build system SHALL copy it to dist/ with the exact same filename.

**Validates: Requirements 6.2**

### Property 4: Error Logging Completeness

_For any_ error that occurs in the Search API or Robot Companion AI, the system SHALL log an error message containing the error type, error message, and sufficient context for debugging.

**Validates: Requirements 7.5**

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and integration points
- **Property tests**: Verify universal properties across randomized inputs

Both testing approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Unit Testing Focus

Unit tests should focus on:

1. **Build Process Validation** (Requirements 1.x, 6.x)
   - Verify sitemap.xml exists in dist/ after build
   - Verify HTTP 200 response for deployed sitemap
   - Validate sitemap XML structure and content
   - Test conditional sitemap references
   - Test conditional file copying (images, videos sitemaps)
   - Verify build validation throws error when sitemap.xml missing
   - Test warning logs for missing optional sitemaps

2. **Index State Verification** (Requirements 3.x)
   - Verify Vectorize index contains vectors after crawling
   - Verify index metadata reports correct document count
   - Verify index configuration (1024 dimensions, correct model)

3. **Edge Cases** (Requirements 4.4, 5.5)
   - Test empty results scenario (no matches)
   - Test AI fallback response when no context found

4. **Configuration Consistency** (Requirement 5.3)
   - Verify both APIs use the same embedding model

### Property-Based Testing Focus

Property tests should focus on:

1. **Search Query Processing** (Property 1)
   - Generate random search queries
   - Verify embeddings are generated for each query
   - Verify results are returned from Vectorize
   - Verify results are sorted by descending score
   - Minimum 100 iterations per test

2. **AI Context Retrieval** (Property 2)
   - Generate random AI messages
   - Verify context retrieval is attempted
   - When context exists, verify it appears in response
   - Minimum 100 iterations per test

3. **Sitemap Filename Preservation** (Property 3)
   - Generate random sitemap filenames
   - Verify copied files have identical names
   - Minimum 100 iterations per test

4. **Error Logging Completeness** (Property 4)
   - Generate random error conditions
   - Verify all errors produce complete log entries
   - Verify logs contain required fields
   - Minimum 100 iterations per test

### Property-Based Testing Library

For JavaScript/Node.js, we will use **fast-check** as the property-based testing library. Fast-check integrates well with existing test frameworks (Vitest, Jest) and provides powerful generators for creating random test data.

### Test Tagging Convention

Each property-based test must include a comment tag referencing the design document:

```javascript
// Feature: cloudflare-managed-ai-search-beta, Property 1: Search Query Processing
test.prop([fc.string({ minLength: 1, maxLength: 100 })])(
  'search query processing',
  async (query) => {
    // Test implementation
  },
);
```

### Manual Verification Steps

Some requirements cannot be automated and require manual verification:

1. **Crawler Verification** (Requirements 2.x)
   - Manually check Cloudflare dashboard logs
   - Verify "Sitemap found" message appears
   - Verify URL collection count > 0
   - Verify files seen count > 0

2. **Monitoring and Diagnostics** (Requirements 7.1-7.4)
   - Manually check Cloudflare dashboard for vector count
   - Manually verify crawler logs
   - Manually test re-crawl trigger functionality

### Testing Workflow

1. **Pre-deployment**: Run all unit tests and property tests locally
2. **Post-deployment**: Verify sitemap accessibility via HTTP request
3. **Post-crawl**: Manually verify crawler logs and index population
4. **Functional validation**: Test search and AI endpoints with real queries
5. **Monitoring**: Set up alerts for index vector count and API errors

### Success Criteria

The migration is successful when:

- All automated tests pass (unit + property tests)
- Sitemap is accessible at https://abdulkerimsesli.de/sitemap.xml
- Cloudflare logs show successful crawling (URLs collected > 0)
- Vectorize index contains vectors (count > 0)
- Search API returns relevant results
- Robot Companion AI provides context-aware responses
- No errors in production logs
