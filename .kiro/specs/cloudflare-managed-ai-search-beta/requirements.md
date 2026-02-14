# Requirements Document

## Introduction

This document specifies the requirements for migrating from a manual Vectorize index to Cloudflare's Managed AI Search Beta. The migration involves ensuring proper sitemap accessibility, enabling automatic website crawling, and validating that both the search functionality and Robot Companion AI work correctly with the new managed index.

## Glossary

- **Vectorize_Index**: Cloudflare's vector database service for storing embeddings (currently `ai-search-plain-mountain-d6d0` with 1024 dimensions)
- **Embedding_Model**: The AI model used to generate vector embeddings (`@cf/baai/bge-large-en-v1.5`)
- **Sitemap**: XML file listing all website URLs for crawler discovery
- **Crawler**: Cloudflare's automated service that discovers and indexes website content
- **Build_System**: Vite-based build pipeline that generates the `dist/` directory
- **Search_API**: The `/api/search` endpoint that queries the Vectorize index
- **Robot_Companion_AI**: The `/api/ai` endpoint that uses RAG with the Vectorize index

## Requirements

### Requirement 1: Sitemap Accessibility

**User Story:** As a Cloudflare crawler, I want to access the sitemap at the standard URL, so that I can discover all website pages for indexing.

#### Acceptance Criteria

1. WHEN the Build_System completes THEN the sitemap.xml SHALL exist in the dist/ directory
2. WHEN a request is made to https://abdulkerimsesli.de/sitemap.xml THEN the system SHALL return the sitemap with HTTP 200 status
3. THE sitemap.xml SHALL contain valid XML with all main pages and blog posts
4. THE sitemap.xml SHALL reference additional sitemaps (sitemap-images.xml, sitemap-videos.xml) if they exist
5. WHEN the Build_System runs THEN sitemap-images.xml and sitemap-videos.xml SHALL be copied to dist/ if they exist in the source

### Requirement 2: Crawler Verification

**User Story:** As a developer, I want to verify that Cloudflare's crawler can successfully access and parse the sitemap, so that I can confirm the crawling process will work.

#### Acceptance Criteria

1. WHEN checking Cloudflare logs THEN the system SHALL show "Sitemap found" instead of "Sitemap not found"
2. WHEN the Crawler processes the sitemap THEN it SHALL report more than 0 URLs collected
3. WHEN the Crawler completes THEN it SHALL report more than 0 files seen
4. THE Crawler SHALL successfully parse all valid URLs from the sitemap

### Requirement 3: Index Population

**User Story:** As a developer, I want the Vectorize index to be automatically populated with website content, so that search functionality works without manual intervention.

#### Acceptance Criteria

1. WHEN the Crawler completes indexing THEN the Vectorize_Index SHALL contain more than 0 vectors
2. WHEN querying the Vectorize_Index metadata THEN it SHALL report the correct number of indexed documents
3. THE Vectorize_Index SHALL use the Embedding_Model `@cf/baai/bge-large-en-v1.5` with 1024 dimensions
4. WHEN content is updated on the website THEN the Crawler SHALL re-index the changed content on subsequent crawls

### Requirement 4: Search Functionality Validation

**User Story:** As a website visitor, I want the AI-powered search to return relevant results, so that I can find content quickly.

#### Acceptance Criteria

1. WHEN a user submits a search query to the Search_API THEN the system SHALL return relevant results from the Vectorize_Index
2. WHEN the Search_API receives a query THEN it SHALL generate embeddings using the Embedding_Model
3. WHEN the Vectorize_Index is queried THEN it SHALL return results ranked by similarity score
4. WHEN no results match the query THEN the Search_API SHALL return an empty results array with HTTP 200 status
5. THE Search_API SHALL return results within 2 seconds for typical queries

### Requirement 5: Robot Companion AI Validation

**User Story:** As a website visitor, I want the Robot Companion AI to provide accurate answers based on website content, so that I can get helpful information.

#### Acceptance Criteria

1. WHEN a user sends a message to the Robot_Companion_AI THEN the system SHALL retrieve relevant context from the Vectorize_Index
2. WHEN the Robot_Companion_AI generates a response THEN it SHALL use the retrieved context to provide accurate answers
3. THE Robot_Companion_AI SHALL use the same Embedding_Model as the Search_API for consistency
4. WHEN the Vectorize_Index contains relevant content THEN the Robot_Companion_AI SHALL reference that content in responses
5. WHEN the Robot_Companion_AI cannot find relevant content THEN it SHALL provide a helpful fallback response

### Requirement 6: Build Process Integration

**User Story:** As a developer, I want the build process to automatically handle sitemap deployment, so that I don't need manual steps after each build.

#### Acceptance Criteria

1. WHEN running `npm run build` THEN the Build_System SHALL copy all sitemap files to dist/
2. WHEN the build completes THEN all sitemap files SHALL maintain their original filenames
3. THE Build_System SHALL validate that sitemap.xml exists before completing the build
4. WHEN deploying to Cloudflare Pages THEN all sitemap files SHALL be included in the deployment
5. IF a sitemap file is missing from the source THEN the Build_System SHALL log a warning but continue

### Requirement 7: Monitoring and Diagnostics

**User Story:** As a developer, I want to monitor the crawler status and index health, so that I can quickly identify and resolve issues.

#### Acceptance Criteria

1. WHEN checking Cloudflare dashboard THEN the system SHALL display the current vector count in the Vectorize_Index
2. WHEN the Crawler runs THEN it SHALL log the number of URLs discovered and indexed
3. WHEN the Crawler encounters errors THEN it SHALL log detailed error messages
4. THE system SHALL provide a way to manually trigger a re-crawl if needed
5. WHEN the Search_API or Robot_Companion_AI fail THEN they SHALL log errors with sufficient detail for debugging
