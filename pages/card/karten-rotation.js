/**
 * @file karten-rotation.js
 * @version 4.0.0 - Thin Wrapper (Consolidated Architecture)
 * 
 * ⚠️ LEGACY ENTRY POINT - NOW DELEGATES TO three-card-system.js ⚠️
 * 
 * This file has been refactored into a thin wrapper. All orchestration
 * logic (templates, observers, scroll-snap, animation) is now consolidated
 * in content/webentwicklung/particles/three-card-system.js
 * 
 * RESPONSIBILITIES:
 * - Backward compatibility layer
 * - Delegates to three-card-system.js
 * - Re-exports public API
 * 
 * MIGRATION NOTES:
 * - Three-card-system.js now handles all orchestration
 * - Auto-initialization happens via DOMContentLoaded
 * - Manual control via window.FeatureRotationIntegrated
 * 
 * @see content/webentwicklung/particles/three-card-system.js
 * @see INTEGRATION_REPORT.md
 */

import {
  initFeatureRotation,
  destroyFeatureRotation,
} from "../../content/webentwicklung/particles/three-card-system.js";

(() => {
  "use strict";

  // Prevent double-initialization
  if (window.FeatureRotation) {
    console.info("[FeatureRotation] Already initialized, skipping wrapper");
    return;
  }

  console.info(
    "[FeatureRotation v4.0] Thin wrapper loaded - delegating to three-card-system.js"
  );

  /**
   * Legacy API - delegates to consolidated system
   * @deprecated Use window.FeatureRotationIntegrated directly
   */
  window.FeatureRotation = {
    /**
     * Initialize the feature rotation system
     * @returns {Promise<boolean>}
     */
    init: async () => {
      console.info("[FeatureRotation] Delegating init to three-card-system.js");
      try {
        return await initFeatureRotation();
      } catch (error) {
        console.error("[FeatureRotation] Initialization failed:", error);
        return false;
      }
    },

    /**
     * Destroy and cleanup the system
     */
    destroy: () => {
      console.info("[FeatureRotation] Delegating destroy to three-card-system.js");
      try {
        destroyFeatureRotation();
      } catch (error) {
        console.error("[FeatureRotation] Cleanup error:", error);
      }
    },

    /**
     * Get current state
     * @returns {Object}
     */
    getState: () => {
      if (window.FeatureRotationIntegrated) {
        return window.FeatureRotationIntegrated.getState();
      }
      return {
        hasAnimated: false,
        isReversing: false,
        reverseTriggered: false,
        templatesLoaded: false,
      };
    },

    /**
     * Version info
     */
    version: "4.0.0",
    mode: "thin-wrapper",
  };

  console.info(
    "[FeatureRotation] Wrapper ready. Auto-initialization handled by three-card-system.js"
  );
})();
