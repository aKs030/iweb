# Requirements Document: Search API Refactoring

## Introduction

Die Search API (`functions/api/search.js` und `functions/api/_search-utils.js`) ist auf Version 11.0.0 aktualisiert worden und funktioniert korrekt. Allerdings wurden mehrere Code-Quality-Probleme identifiziert, die die Wartbarkeit, Lesbarkeit und Testbarkeit beeinträchtigen. Dieses Refactoring-Projekt zielt darauf ab, die Code-Qualität zu verbessern, ohne die bestehende Funktionalität zu ändern oder Breaking Changes einzuführen.

## Glossary

- **Search_API**: Die Cloudflare Pages Function unter `functions/api/search.js`
- **Search_Utils**: Die Utility-Funktionen unter `functions/api/_search-utils.js`
- **Magic_Number**: Hardcodierte numerische Werte ohne benannte Konstanten
- **Configuration_Object**: Zentrales Objekt mit allen konfigurierbaren Werten und Schwellenwerten
- **Result_Builder**: Komponente zum Konstruieren von Search-Result-Objekten
- **Title_Mapper**: Komponente zur Extraktion und Transformation von Titeln aus URLs
- **Category_Mapper**: Komponente zur Bestimmung der Kategorie aus URLs
- **Cache_Manager**: Komponente zur Verwaltung von Caching-Operationen
- **Response_Transformer**: Komponente zur Transformation von AI Search Beta Responses
- **Deduplicator**: Komponente zur Entfernung von Duplikaten
- **Relevance_Scorer**: Komponente zur Berechnung von Relevanz-Scores

## Requirements

### Requirement 1: Configuration Management

**User Story:** Als Entwickler möchte ich alle konfigurierbaren Werte zentral verwalten, damit ich Schwellenwerte und Limits einfach anpassen kann, ohne den Code durchsuchen zu müssen.

#### Acceptance Criteria

1. THE Configuration_Object SHALL contain all magic numbers as named constants
2. WHEN a developer needs to adjust a threshold, THE Configuration_Object SHALL provide a single location for all configurable values
3. THE Configuration_Object SHALL include constants for: cache TTL, max results per category, truncation lengths, fuzzy match thresholds, and relevance score boosts
4. THE Configuration_Object SHALL be exportable from Search_Utils for reuse
5. THE Configuration_Object SHALL use descriptive names that explain the purpose of each value

### Requirement 2: Function Decomposition

**User Story:** Als Entwickler möchte ich, dass die Hauptfunktion in kleinere, fokussierte Funktionen aufgeteilt wird, damit der Code leichter zu verstehen und zu testen ist.

#### Acceptance Criteria

1. THE Search_API SHALL split the `onRequestPost` function into functions with single responsibilities
2. WHEN the main function exceeds 50 lines, THE Search_API SHALL extract logical blocks into separate functions
3. THE Search_API SHALL create separate functions for: cache operations, query processing, response transformation, and result filtering
4. THE Search_API SHALL maintain the same external API contract after refactoring
5. WHEN a function performs multiple operations, THE Search_API SHALL extract each operation into its own function

### Requirement 3: Title Extraction

**User Story:** Als Entwickler möchte ich die Title-Extraction-Logik in eine separate, testbare Funktion auslagern, damit sie wiederverwendbar und wartbar ist.

#### Acceptance Criteria

1. THE Title_Mapper SHALL extract title mapping logic from the main function
2. WHEN given a URL and filename, THE Title_Mapper SHALL return an appropriate title
3. THE Title_Mapper SHALL handle special cases: root path, index pages, top-level pages, and sub-pages
4. THE Title_Mapper SHALL convert kebab-case to Title Case
5. THE Title_Mapper SHALL use a configuration object for title mappings
6. WHEN the URL is "/", THE Title_Mapper SHALL return "Startseite"
7. WHEN the filename is "index" or empty, THE Title_Mapper SHALL derive the title from URL segments

### Requirement 4: Category Mapping

**User Story:** Als Entwickler möchte ich die URL-zu-Kategorie-Zuordnung in eine separate Funktion auslagern, damit sie konsistent und wartbar ist.

#### Acceptance Criteria

1. THE Category_Mapper SHALL extract category mapping logic from the main function
2. WHEN given a URL, THE Category_Mapper SHALL return the appropriate category
3. THE Category_Mapper SHALL use a configuration object for URL-to-category mappings
4. THE Category_Mapper SHALL return "Seite" as default category for unknown URLs
5. THE Category_Mapper SHALL handle all existing categories: Home, Projekte, Blog, Galerie, Videos, Über mich, Kontakt

### Requirement 5: Result Builder Pattern

**User Story:** Als Entwickler möchte ich ein Builder-Pattern für Search-Result-Objekte, damit die Konstruktion konsistent und erweiterbar ist.

#### Acceptance Criteria

1. THE Result_Builder SHALL provide a fluent interface for constructing search result objects
2. WHEN building a result, THE Result_Builder SHALL accept raw data from AI Search Beta
3. THE Result_Builder SHALL use Title_Mapper for title extraction
4. THE Result_Builder SHALL use Category_Mapper for category determination
5. THE Result_Builder SHALL handle text truncation with smart breaking points
6. THE Result_Builder SHALL return a complete result object with: url, title, category, description, and score

### Requirement 6: String Operation Optimization

**User Story:** Als Entwickler möchte ich redundante String-Operationen eliminieren, damit die Performance verbessert wird.

#### Acceptance Criteria

1. WHEN a string is converted to lowercase multiple times, THE Search_API SHALL cache the result
2. THE Relevance_Scorer SHALL perform toLowerCase() operations only once per string
3. THE Search_API SHALL avoid repeated string transformations on the same data
4. WHEN processing query strings, THE Search_API SHALL normalize them once at the beginning

### Requirement 7: Early Deduplication

**User Story:** Als Entwickler möchte ich die Deduplication früher in der Pipeline durchführen, damit unnötige Verarbeitungsschritte vermieden werden.

#### Acceptance Criteria

1. THE Deduplicator SHALL remove duplicate URLs before relevance scoring
2. WHEN duplicate results are detected, THE Deduplicator SHALL keep the result with the higher initial score
3. THE Deduplicator SHALL use Set-based deduplication for O(n) complexity
4. THE Search_API SHALL apply deduplication immediately after response transformation

### Requirement 8: Cache Management Separation

**User Story:** Als Entwickler möchte ich die Caching-Logik in separate Funktionen auslagern, damit sie testbar und wiederverwendbar ist.

#### Acceptance Criteria

1. THE Cache_Manager SHALL provide functions for cache read and write operations
2. WHEN reading from cache, THE Cache_Manager SHALL handle errors gracefully
3. WHEN writing to cache, THE Cache_Manager SHALL handle errors gracefully
4. THE Cache_Manager SHALL validate cache entries before returning them
5. THE Cache_Manager SHALL use the configuration object for TTL values
6. THE Cache_Manager SHALL generate cache keys consistently

### Requirement 9: Response Transformation

**User Story:** Als Entwickler möchte ich die Transformation von AI Search Beta Responses in eine separate Funktion auslagern, damit sie testbar ist.

#### Acceptance Criteria

1. THE Response_Transformer SHALL convert AI Search Beta responses to the internal format
2. WHEN transforming responses, THE Response_Transformer SHALL use Result_Builder
3. THE Response_Transformer SHALL handle missing or malformed data gracefully
4. THE Response_Transformer SHALL extract and clean text content from response items
5. THE Response_Transformer SHALL normalize URLs using the existing normalizeUrl function

### Requirement 10: Error Handling Improvement

**User Story:** Als Entwickler möchte ich spezifischere Error-Types und bessere Fehlerbehandlung, damit Probleme leichter diagnostiziert werden können.

#### Acceptance Criteria

1. WHEN an error occurs, THE Search_API SHALL log sufficient context for debugging
2. THE Search_API SHALL distinguish between different error types: cache errors, API errors, and transformation errors
3. WHEN a cache operation fails, THE Search_API SHALL continue with the search operation
4. WHEN the AI binding is missing, THE Search_API SHALL return a descriptive error message
5. THE Search_API SHALL never expose internal error details to the client

### Requirement 11: Code Documentation

**User Story:** Als Entwickler möchte ich vollständige JSDoc-Kommentare für alle Funktionen, damit die API-Nutzung klar dokumentiert ist.

#### Acceptance Criteria

1. THE Search_Utils SHALL have JSDoc comments for all exported functions
2. WHEN a function has parameters, THE JSDoc SHALL document each parameter with type and description
3. WHEN a function returns a value, THE JSDoc SHALL document the return type and description
4. THE JSDoc SHALL include usage examples for complex functions
5. THE JSDoc SHALL document any side effects or exceptions

### Requirement 12: Backward Compatibility

**User Story:** Als API-Nutzer möchte ich, dass das Refactoring keine Breaking Changes einführt, damit meine bestehende Integration weiterhin funktioniert.

#### Acceptance Criteria

1. THE Search_API SHALL maintain the same request format after refactoring
2. THE Search_API SHALL maintain the same response format after refactoring
3. THE Search_API SHALL maintain the same HTTP status codes after refactoring
4. THE Search_API SHALL maintain the same CORS headers after refactoring
5. THE Search_API SHALL maintain the same caching behavior after refactoring
6. WHEN the refactored API is deployed, THE existing clients SHALL continue to work without modifications

### Requirement 13: Bundle Size Constraint

**User Story:** Als Entwickler möchte ich, dass das Refactoring die Bundle-Größe nicht signifikant erhöht, damit die Performance nicht beeinträchtigt wird.

#### Acceptance Criteria

1. WHEN the refactoring is complete, THE Search_API bundle size SHALL not increase by more than 5%
2. THE Search_API SHALL avoid introducing unnecessary dependencies
3. THE Search_API SHALL use code splitting where appropriate
4. WHEN adding new utility functions, THE Search_API SHALL ensure they are tree-shakeable

### Requirement 14: Testing Infrastructure

**User Story:** Als Entwickler möchte ich eine Test-Suite für alle Utility-Funktionen, damit Regressionen verhindert werden.

#### Acceptance Criteria

1. THE Search_Utils SHALL have unit tests for all exported functions
2. THE Title_Mapper SHALL have tests covering all URL patterns
3. THE Category_Mapper SHALL have tests for all category mappings
4. THE Result_Builder SHALL have tests for result construction
5. THE Deduplicator SHALL have tests for duplicate detection
6. WHEN a utility function is modified, THE tests SHALL catch breaking changes
