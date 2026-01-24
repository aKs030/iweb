/**
 * Modern Menu System - Main Entry Point
 * 
 * Features:
 * - ES6 Module Architecture
 * - Performance Optimized
 * - Event-driven Communication
 * - Lazy Loading
 * - Memory-efficient
 * - Analytics Ready
 * - Configurable
 * 
 * @author Abdulkerim Sesli
 * @version 3.1.0
 */

import { MenuController } from './modules/MenuController.js';
import { createConfig } from './modules/MenuConfig.js';
import { createLogger } from '/content/utils/shared-utilities.js';

const logger = createLogger('menu');

// Global controller instance
let globalController = null;

// Initialize menu system
const initializeMenu = async (customConfig = {}) => {
  try {
    const config = createConfig(customConfig);
    const controller = new MenuController(config);
    await controller.init();
    
    // Store global reference
    globalController = controller;
    
    // Expose API
    window.menuController = controller;
    window.menuCleanup = () => controller.destroy();
    
    logger.info('Menu system initialized');
    return controller;
  } catch (error) {
    logger.error('Menu initialization failed:', error);
    throw error;
  }
};

// Auto-initialize with default config
if (document.readyState !== 'loading') {
  initializeMenu();
} else {
  document.addEventListener('DOMContentLoaded', () => initializeMenu(), { once: true });
}

// Export for manual initialization
export { initializeMenu, globalController };
