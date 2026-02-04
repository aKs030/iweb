## 2024-05-23 - Robot Companion Layout Thrashing

**Learning:** The `RobotCompanion` class was forcing a synchronous layout reflow on every scroll event (throttled by rAF).
The code was resetting `style.bottom = ''` (Write) followed immediately by `getBoundingClientRect()` (Read) to check for footer overlap.
This "Write -> Read" pattern invalidates the layout and forces the browser to recalculate styles and layout synchronously, which is expensive, especially during scrolling.

**Action:** Refactored the overlap check to calculate the theoretical position based on `window.innerHeight` and the known default CSS value (30px). This allows removing the initial style reset, turning the operation into a pure Read (which can use cached layout values) followed by a conditional Write. This eliminates the forced reflow.
