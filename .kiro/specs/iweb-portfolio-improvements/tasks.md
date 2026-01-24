# Implementation Plan: iweb Portfolio Improvements

## Overview

This implementation plan breaks down the systematic improvements to the iweb Portfolio project into discrete, actionable coding tasks. The plan follows a phased approach, starting with test infrastructure to enable validation of all subsequent changes. Each task builds incrementally, ensuring the codebase remains functional throughout the improvement process.

## Tasks

- [x] 1. Phase 1: Test Infrastructure Setup
  - [x] 1.1 Install and configure fast-check for property-based testing
    - Install fast-check as dev dependency: `npm install --save-dev fast-check`
    - Verify installation and compatibility with Vitest
    - _Requirements: 5.1, 5.8_

  - [x] 1.2 Create test utilities and arbitrary generators
    - Create `content/utils/test-utils/property-generators.js`
    - Implement arbitraries for: logLevel, logMessage, delay, cookieName, cookieValue, numberArray, eventType, sectionId
    - Export all arbitraries for reuse across test files
    - _Requirements: 5.1_

  - [x] 1.3 Update Vitest configuration for property-based testing
    - Update `vitest.config.js` to set minimum 100 iterations for property tests
    - Configure coverage thresholds to 60% for lines, functions, branches, statements
    - Configure coverage reporters: text, HTML, LCOV, JSON
    - Update include/exclude patterns for coverage
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.6_

  - [x] 1.4 Create example property test to validate setup
    - Create `content/utils/shared-utilities.properties.js`
    - Write one example property test using fast-check
    - Verify test runs with 100 iterations
    - Verify test tag format is correct
    - _Requirements: 5.1, 5.2_

- [x] 2. Checkpoint - Verify test infrastructure is working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Phase 2: Logger and Event System Tests
  - [x] 3.1 Write property tests for Logger
    - Create property test for logger level filtering (Property 1)
    - Test that production mode only logs errors
    - Test that development mode logs warn and above
    - Tag: "Feature: iweb-portfolio-improvements, Property 1: Logger Level Filtering"
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 3.2 Write unit tests for Logger edge cases
    - Test logger with undefined console
    - Test logger with null messages
    - Test logger category formatting
    - _Requirements: 1.2_

  - [x] 3.3 Write property tests for Event System
    - Create property test for event dispatch (Property 2)
    - Test fire() with valid targets and various event types
    - Test fire() with invalid targets handles errors gracefully
    - Tag: "Feature: iweb-portfolio-improvements, Property 2: Event System Dispatch"
    - _Requirements: 1.14, 1.15_

  - [x] 3.4 Write unit tests for Event System edge cases
    - Test EVENTS constant is frozen
    - Test event detail serialization
    - Test event bubbling behavior
    - _Requirements: 1.14_

- [x] 4. Phase 2: Timer and Cookie Management Tests
  - [x] 4.1 Write property tests for TimerManager
    - Create property test for timer tracking (Property 3)
    - Test setTimeout and setInterval are tracked
    - Test clearAll() results in zero active timers
    - Test sleep() resolves after correct delay
    - Tag: "Feature: iweb-portfolio-improvements, Property 3: Timer Management Tracking"
    - _Requirements: 1.5, 1.6, 1.7_

  - [x] 4.2 Write unit tests for TimerManager edge cases
    - Test clearing non-existent timers
    - Test activeCount accuracy
    - Test scheduleAsync error handling
    - _Requirements: 1.5_

  - [x] 4.3 Write property tests for CookieManager
    - Create property test for cookie round-trip (Property 4)
    - Test set() then get() returns same value
    - Test delete() makes cookie unretrievable
    - Test cookie expiration and security flags
    - Tag: "Feature: iweb-portfolio-improvements, Property 4: Cookie Round-Trip Consistency"
    - _Requirements: 1.8, 1.9, 1.10_

  - [x] 4.4 Write unit tests for CookieManager edge cases
    - Test deleteAnalytics() removes all analytics cookies
    - Test cookie domain handling
    - Test cookie with special characters
    - _Requirements: 1.8_

- [x] 5. Phase 2: Utility Function Tests
  - [x] 5.1 Write property tests for throttle()
    - Create property test for throttle rate limiting (Property 5)
    - Test function executes at most once per throttle period
    - Test with various call patterns and limits
    - Tag: "Feature: iweb-portfolio-improvements, Property 5: Throttle Rate Limiting"
    - _Requirements: 1.11_

  - [x] 5.2 Write property tests for debounce()
    - Create property test for debounce execution delay (Property 6)
    - Test only last call executes after delay
    - Test with various call patterns and delays
    - Tag: "Feature: iweb-portfolio-improvements, Property 6: Debounce Execution Delay"
    - _Requirements: 1.12_

  - [x] 5.3 Write property tests for shuffle()
    - Create property test for shuffle element preservation (Property 7)
    - Test shuffled array has same length and elements
    - Test with various array types and sizes
    - Tag: "Feature: iweb-portfolio-improvements, Property 7: Shuffle Element Preservation"
    - _Requirements: 1.13_

  - [x] 5.4 Write unit tests for utility functions
    - Test fetchWithTimeout() timeout behavior
    - Test makeAbortController() cancellation
    - Test randomInt() range boundaries
    - _Requirements: 1.13_

- [x] 6. Phase 2: IntersectionObserver and SectionTracker Tests
  - [x] 6.1 Write property tests for IntersectionObserver utilities
    - Create property test for observer callback triggering (Property 8)
    - Test callbacks are triggered on intersection
    - Test with various intersection configurations
    - Tag: "Feature: iweb-portfolio-improvements, Property 8: IntersectionObserver Callback Triggering"
    - _Requirements: 1.16_

  - [x] 6.2 Write property tests for createLazyLoadObserver()
    - Create property test for lazy load idempotence (Property 9)
    - Test callback triggers exactly once
    - Test with multiple intersections
    - Tag: "Feature: iweb-portfolio-improvements, Property 9: Lazy Load Observer Idempotence"
    - _Requirements: 1.17_

  - [x] 6.3 Write property tests for SectionTracker
    - Create property test for section change detection (Property 10)
    - Test section changes are detected correctly
    - Test events are dispatched with correct section ID
    - Tag: "Feature: iweb-portfolio-improvements, Property 10: Section Tracker Change Detection"
    - _Requirements: 1.18_

  - [x] 6.4 Write unit tests for SectionTracker
    - Test refreshSections() updates section list
    - Test destroy() cleans up observers
    - Test checkInitialSection() finds active section
    - _Requirements: 1.18_

- [x] 7. Phase 2: Component Tests (Menu and Search)
  - [x] 7.1 Analyze menu.js structure and create test file
    - Read `content/components/menu/menu.js`
    - Identify menu state machine and transitions
    - Create `content/components/menu/menu.test.js`
    - _Requirements: 1.19_

  - [x] 7.2 Write property tests for menu state transitions
    - Create property test for menu state transitions (Property 11)
    - Test open, close, toggle actions
    - Test DOM reflects current state
    - Tag: "Feature: iweb-portfolio-improvements, Property 11: Menu State Transitions"
    - _Requirements: 1.19_

  - [x] 7.3 Analyze search.js structure and create test file
    - Read `content/components/search/search.js`
    - Identify search filtering logic
    - Create `content/components/search/search.test.js`
    - _Requirements: 1.20_

  - [x] 7.4 Write property tests for search filtering
    - Create property test for search result filtering (Property 12)
    - Test results only include matching items
    - Test with various queries and datasets
    - Tag: "Feature: iweb-portfolio-improvements, Property 12: Search Result Filtering"
    - _Requirements: 1.20_

- [x] 8. Checkpoint - Verify test coverage meets 60-80% target
  - Run coverage report: `npm run test:coverage`
  - Verify coverage thresholds are met
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Phase 3: Global State Namespace Creation
  - [x] 9.1 Create global state management module
    - Create `content/utils/global-state.js`
    - Initialize window.AKS namespace
    - Implement GlobalState access helpers
    - _Requirements: 2.1, 2.12_

  - [x] 9.2 Implement backward compatibility layer
    - Create createDeprecatedProxy() function
    - Implement setupBackwardCompatibility() function
    - Add deprecation warning logic with deduplication
    - _Requirements: 2.13, 2.14_

  - [x] 9.3 Write property tests for backward compatibility
    - Create property test for backward compatibility (Property 13)
    - Test old paths return same values as new paths
    - Tag: "Feature: iweb-portfolio-improvements, Property 13: Backward Compatibility Preservation"
    - _Requirements: 2.13_

  - [x] 9.4 Write property tests for deprecation warnings
    - Create property test for deprecation warnings (Property 14)
    - Test first access emits warning
    - Test subsequent accesses don't emit duplicates
    - Tag: "Feature: iweb-portfolio-improvements, Property 14: Deprecation Warning Emission"
    - _Requirements: 2.14_

- [x] 10. Phase 3: Migrate Global Variables
  - [x] 10.1 Migrate Three.js Earth global variables
    - Update `content/main.js` to use window.AKS.threeEarthCleanup
    - Update `content/main.js` to use window.AKS.threeEarthSystem
    - Update `content/main.js` to use window.AKS.forceThreeEarth
    - Add backward compatibility proxies
    - _Requirements: 2.3, 2.7, 2.11_

  - [x] 10.2 Migrate core system global variables
    - Update `content/main.js` to use window.AKS.announce
    - Update `content/main.js` to use window.AKS.SectionLoader
    - Update `content/main.js` to use window.AKS.mainDelegatedRemove
    - Add backward compatibility proxies
    - _Requirements: 2.4, 2.5, 2.6_

  - [x] 10.3 Migrate Robot Companion global variables
    - Update `content/components/robot-companion/robot-companion.js` to use window.AKS.robotCompanionTexts
    - Add backward compatibility proxy
    - _Requirements: 2.8_

  - [x] 10.4 Migrate YouTube integration global variables
    - Update `pages/videos/videos.js` to use window.AKS.youtubeChannelId
    - Update `pages/videos/videos.js` to use window.AKS.youtubeChannelHandle
    - Add backward compatibility proxies
    - _Requirements: 2.9, 2.10_

  - [x] 10.5 Initialize global state in main.js
    - Import and call setupBackwardCompatibility() in main.js
    - Verify all global variables are accessible through window.AKS
    - Test backward compatibility works
    - _Requirements: 2.12, 2.13_

- [x] 11. Checkpoint - Verify global state refactoring
  - Run all tests to verify no regressions
  - Test backward compatibility manually
  - Verify deprecation warnings appear
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Phase 4: Performance Optimization - Baseline Measurement
  - [x] 12.1 Measure baseline bundle sizes
    - Run production build: `npm run build`
    - Record bundle sizes from dist/ directory
    - Record gzipped sizes
    - Create performance baseline report
    - _Requirements: 3.6_

  - [x] 12.2 Install bundle analysis tools
    - Install rollup-plugin-visualizer: `npm install --save-dev rollup-plugin-visualizer`
    - Update vite.config.js to include visualizer plugin
    - Generate bundle analysis report
    - _Requirements: 3.6_

- [x] 13. Phase 4: React to Preact Migration
  - [x] 13.1 Install Preact dependencies
    - Install Preact: `npm install preact`
    - Install Preact compat: `npm install preact/compat`
    - Install Preact Vite plugin: `npm install --save-dev @preact/preset-vite`
    - _Requirements: 3.2_

  - [x] 13.2 Update Vite configuration for Preact
    - Update `vite.config.js` to use @preact/preset-vite
    - Add React to Preact aliases
    - Configure manual chunks for preact-vendor
    - _Requirements: 3.2_

  - [x] 13.3 Test Robot Companion with Preact
    - Run development server and test Robot Companion
    - Verify all functionality works
    - Check for console errors or warnings
    - _Requirements: 3.3_

  - [x] 13.4 Write property tests for behavioral equivalence
    - Create property test for behavioral equivalence (Property 15)
    - Test Robot Companion behavior is unchanged
    - Tag: "Feature: iweb-portfolio-improvements, Property 15: Behavioral Equivalence After Optimization"
    - _Requirements: 3.3_

  - [x] 13.5 Measure Preact bundle size
    - Run production build
    - Compare preact-vendor chunk size to previous react bundle
    - Verify at least 25KB reduction
    - _Requirements: 3.2_

- [x] 14. Phase 4: Three.js Tree-Shaking
  - [x] 14.1 Analyze Three.js usage in three-earth.js
    - Read `content/components/three-earth/three-earth.js`
    - Identify all Three.js imports
    - Document which modules are actually used
    - _Requirements: 3.4_

  - [x] 14.2 Optimize Three.js imports
    - Replace `import * as THREE from 'three'` with specific imports
    - Import only: WebGLRenderer, Scene, PerspectiveCamera, SphereGeometry, MeshStandardMaterial, Mesh, AmbientLight, DirectionalLight, TextureLoader
    - Use deep imports: `import { X } from 'three/src/Y/X.js'`
    - _Requirements: 3.4, 3.5_

  - [x] 14.3 Update Vite configuration for Three.js optimization
    - Configure manual chunks for three-vendor
    - Add Three.js to optimizeDeps.include
    - _Requirements: 3.5_

  - [x] 14.4 Test Three.js Earth functionality
    - Run development server and test 3D Earth
    - Verify all animations and interactions work
    - Check for console errors
    - _Requirements: 3.8_

  - [x] 14.5 Measure Three.js bundle size
    - Run production build
    - Compare three-vendor chunk size to baseline
    - Document size reduction
    - _Requirements: 3.5_

- [x] 15. Phase 4: Final Performance Validation
  - [x] 15.1 Measure total bundle size reduction
    - Compare total bundle size to baseline
    - Verify at least 30KB total reduction
    - _Requirements: 3.10_

  - [x] 15.2 Create performance report
    - Document before/after bundle sizes
    - Calculate percentage improvements
    - List all optimizations performed
    - _Requirements: 6.1_

  - [x] 15.3 Run full test suite to verify no regressions
    - Run all unit tests
    - Run all property tests
    - Verify all tests pass
    - _Requirements: 3.9_

- [x] 16. Checkpoint - Verify performance optimizations
  - Verify 30KB bundle size reduction achieved
  - Verify all features working correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Phase 5: Code Cleanup - MediaQueryList API
  - [x] 17.1 Update vitest.setup.js MediaQueryList mock
    - Remove deprecated addListener method
    - Remove deprecated removeListener method
    - Keep addEventListener and removeEventListener
    - _Requirements: 4.1, 4.2_

  - [x] 17.2 Test MediaQueryList mock works correctly
    - Verify tests using matchMedia still pass
    - Check for deprecation warnings
    - _Requirements: 4.1_

- [x] 18. Phase 5: Module System Migration
  - [x] 18.1 Update package.json module type
    - Change "type": "commonjs" to "type": "module"
    - _Requirements: 4.3_

  - [x] 18.2 Verify all imports and exports work
    - Run development server
    - Run production build
    - Run all tests
    - Check for module resolution errors
    - _Requirements: 4.4_

  - [x] 18.3 Write property tests for module system compatibility
    - Test all modules load correctly
    - Test no circular dependencies
    - Tag: "Feature: iweb-portfolio-improvements, Property 15: Behavioral Equivalence After Optimization"
    - _Requirements: 4.7_

- [x] 19. Phase 5: ESLint Configuration Update
  - [x] 19.1 Update ESLint rules for deprecated patterns
    - Update `eslint.config.mjs`
    - Add rules to catch deprecated MediaQueryList methods
    - Add rules to catch globalThis usage (suggest window.AKS)
    - _Requirements: 4.9_

  - [x] 19.2 Run ESLint and fix any issues
    - Run `npm run lint:check`
    - Fix any new linting errors
    - Run `npm run lint` to auto-fix
    - _Requirements: 4.9_

- [x] 20. Phase 5: Documentation Updates
  - [x] 20.1 Update CHANGELOG.md
    - Document all breaking changes
    - Document all improvements
    - Document migration steps for global variables
    - _Requirements: 4.10, 6.2_

  - [x] 20.2 Create migration guide for global variables
    - Document old vs new global variable paths
    - Provide code examples
    - Explain backward compatibility timeline
    - _Requirements: 6.3_

  - [x] 20.3 Update README.md with testing instructions
    - Document how to run tests
    - Document how to run property tests
    - Document coverage requirements
    - _Requirements: 6.9_

- [x] 21. Checkpoint - Verify code cleanup complete
  - Run all tests to verify no regressions
  - Verify ESLint passes
  - Verify documentation is complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. Phase 6: Continuous Integration Setup
  - [x] 22.1 Create GitHub Actions workflow
    - Create `.github/workflows/test.yml`
    - Configure to run on pull requests
    - Set up Node.js matrix (18.x, 20.x)
    - Configure dependency caching
    - _Requirements: 7.1, 7.9, 7.10_

  - [x] 22.2 Add test and lint steps to CI
    - Add `npm run lint:check` step
    - Add `npm test` step
    - Add `npm run build` step
    - _Requirements: 7.1, 7.5, 7.6_

  - [x] 22.3 Add coverage reporting to CI
    - Add `npm run test:coverage` step
    - Configure coverage thresholds to fail build
    - Upload coverage reports as artifacts
    - _Requirements: 7.2, 7.4_

  - [x] 22.4 Add deprecated API check to CI
    - Add step to check for deprecated patterns
    - Use ESLint to catch deprecated APIs
    - _Requirements: 7.7_

  - [x] 22.5 Test CI workflow
    - Create test pull request
    - Verify all CI steps pass
    - Verify coverage reports are generated
    - _Requirements: 7.1_

- [x] 23. Phase 6: Final Documentation and Reporting
  - [x] 23.1 Create final summary report
    - Document all improvements made
    - Include before/after metrics
    - List all tests added
    - Document bundle size reductions
    - _Requirements: 6.6_

  - [x] 23.2 Update project score
    - Calculate new project score based on improvements
    - Document score improvement from A- (92/100) to A+ (98/100)
    - _Requirements: 6.4_

  - [x] 23.3 Create verification checklist
    - List all improvements to verify
    - Include test commands
    - Include manual testing steps
    - _Requirements: 6.10_

- [x] 24. Final Checkpoint - Project Complete
  - Verify all 7 requirements are met
  - Verify project score improved to A+ (98/100)
  - Verify all tests pass
  - Verify CI is working
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- All property tests must run with minimum 100 iterations
- All property tests must be tagged with format: "Feature: iweb-portfolio-improvements, Property {number}: {property_text}"
