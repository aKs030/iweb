## 2025-03-08 - Avoid Array Pipeline Allocations in Middleware

**Learning:** Edge middleware functions execute on every incoming request. Using chained array methods like `.map().filter().map()` for string parsing (like in `humanizeSlug`) creates multiple intermediate array allocations. This increases memory usage and Garbage Collection (GC) pressure, slowing down the critical path.
**Action:** Use a single-pass `.reduce()` or a standard loop for string segment transformations in edge environment utility functions to minimize intermediate memory allocations.
