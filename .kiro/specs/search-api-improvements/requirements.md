# Search API Improvements - Requirements

## Overview

Improve the search API implementation to address code quality issues, enhance maintainability, and prepare for future VECTOR_INDEX integration while maintaining current fallback functionality.

## User Stories

### 1. As a developer, I want clean separation of concerns

So that the search API is easier to maintain and test.

**Acceptance Criteria:**

- 1.1 URL normalization logic is extracted into a separate utility module
- 1.2 Static data (URL_MAPPINGS) is moved to a configuration file
- 1.3 Result processing logic is separated from API handler logic
- 1.4 Each function has a single, clear responsibility

### 2. As a developer, I want better error handling

So that failures are gracefully handled and properly logged.

**Acceptance Criteria:**

- 2.1 All error cases have appropriate error messages
- 2.2 Fallback behavior is clearly documented
- 2.3 VECTOR_INDEX availability is handled gracefully
- 2.4 Invalid input is validated and rejected with clear messages

### 3. As a developer, I want improved code organization

So that the codebase is easier to navigate and understand.

**Acceptance Criteria:**

- 3.1 Related functions are grouped logically
- 3.2 Magic numbers are replaced with named constants
- 3.3 Complex logic has explanatory comments
- 3.4 Function names clearly describe their purpose

### 4. As a developer, I want better testability

So that I can verify search functionality works correctly.

**Acceptance Criteria:**

- 4.1 Pure functions are separated from side effects
- 4.2 Dependencies are injected rather than hardcoded
- 4.3 Static data can be easily mocked for testing
- 4.4 Business logic is decoupled from Cloudflare-specific code

### 5. As a user, I want relevant search results

So that I can find the content I'm looking for.

**Acceptance Criteria:**

- 5.1 Search filtering works correctly for title, description, and category
- 5.2 Results are ranked by relevance
- 5.3 Duplicate URLs are properly deduplicated
- 5.4 Empty queries return appropriate responses

## Technical Context

### Current Issues Identified

1. **Code Smells:**
   - Large monolithic file (~300 lines) mixing concerns
   - Static data hardcoded in the main file
   - URL normalization has duplicate logic (try/catch fallback)
   - Magic strings and numbers throughout

2. **Anti-Patterns:**
   - God function: `onRequestPost` handles too many responsibilities
   - Primitive obsession: Using plain objects instead of domain models
   - Feature envy: `improveResult` knows too much about URL_MAPPINGS structure

3. **Maintainability Concerns:**
   - Adding new URL mappings requires editing the main API file
   - Testing requires mocking Cloudflare context
   - No clear separation between business logic and infrastructure

4. **Performance Considerations:**
   - String operations in `normalizeUrl` could be optimized
   - Array filtering happens on every request (could be indexed)
   - No caching strategy for static results

### Proposed Architecture

```
functions/api/
├── search.js                    # Main API handler (thin)
├── search/
│   ├── config.js               # URL_MAPPINGS and constants
│   ├── url-normalizer.js       # URL normalization logic
│   ├── result-processor.js     # Result improvement & deduplication
│   └── search-engine.js        # Search logic (static + future vector)
```

## Non-Functional Requirements

### Performance

- API response time < 100ms for static results
- Bundle size impact < 5KB additional

### Maintainability

- Each module < 100 lines of code
- Functions < 20 lines each
- Cyclomatic complexity < 10

### Compatibility

- Must work with existing Cloudflare Pages Functions
- No breaking changes to API contract
- Backward compatible with current search component

## Out of Scope

- Implementing actual VECTOR_INDEX integration (future work)
- Changing the API response format
- Adding new search features (fuzzy matching, synonyms, etc.)
- Performance optimizations beyond code organization

## Dependencies

- Existing CORS utilities (`_cors.js`)
- Cloudflare Pages Functions environment
- Current search component expectations

## Success Metrics

- Code coverage > 80% for new modules
- ESLint violations = 0
- Prettier formatting compliance = 100%
- Bundle size increase < 5KB
- API response time unchanged or improved
