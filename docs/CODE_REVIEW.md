# Code Review & Optimization Report

## 1. 3D Earth Visualization Optimization

**Goal:** Stabilize frame rate and prevent rapid quality switching.

**Analysis:**

- The previous `PerformanceMonitor` implementation updated quality settings every 1 second based on instantaneous FPS.
- The hysteresis thresholds (25/35 FPS) were too close, causing "ping-pong" behavior where quality would drop, FPS would rise, quality would rise, FPS would drop, repeating the cycle.

**Optimizations Implemented:**

- **Wider Hysteresis:** Adjusted thresholds to Drop < 25 FPS / Raise > 45 FPS. This 20 FPS buffer ensures that quality is only raised when the device has significant headroom.
- **Dampened Response:** Increased the `PerformanceMonitor` sampling interval from 1000ms to 2000ms. This averages out momentary frame drops (e.g., due to garbage collection) and prevents knee-jerk quality reductions.
- **Stability Logic:** Added `STABILITY_FRAMES` configuration to support future logic requiring multiple consecutive bad frames before downgrading (currently implicitly handled by the longer sampling interval).

## 2. Component Analysis (`content/components/`)

### General Structure

The component architecture is modular, with `particles/earth/` containing the bulk of the complex 3D logic.

### Findings & Potential Issues

- **Runtime HTML Fetching (`footer.js`):** The `SiteFooter` component fetches its template (`footer.html`) at runtime via `fetch()`. This creates a dependency on the build process correctly copying this specific file to the output directory. If the network request fails or the file is missing, the footer renders without content.
  - _Recommendation:_ Bundle the HTML directly into the JS using a Vite string loader or move to a standard custom element template approach to eliminate the network dependency.
- **Singleton Complexity (`three-earth-state.js`):** This module acts as a global state manager for the Earth system. While useful for testing or external control, it adds complexity. If the Earth system is a singleton in practice, this state could be merged into the main system class.
- **Hero Manager Decoupling:** `hero-manager.js` lazily loads the greeting text but assumes the Earth background is managed independently. This is good for separation of concerns but requires implicit coordination (e.g., z-index layering).

### Unused Code Check

- No clear "dead code" (e.g., `*.old`, `*.bak`, or unreferenced test files) was found in the `content/components/` directory.
- All files in `content/components/particles/earth/` appear to be referenced by the system.

## 3. API Endpoints

### Search API (`functions/api/search.js`)

**Implementation:**

- Uses Cloudflare AI Search Beta via Workers Binding
- AI Search Instance: `wispy-pond-1055`
- No API tokens required (secure Workers Binding)
- Returns AI-generated summaries (max 150 characters)

### Robot Chat API (`functions/api/ai.js`)

**Implementation:**

- Uses Groq API (`llama-3.3-70b-versatile`) for chat responses
- RAG context retrieval via AI Search Beta
- GROQ_API_KEY stored as Cloudflare Pages Secret
