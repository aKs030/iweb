// Simplified Atmospheric Sky System Test
import { getElementById } from '../utils/common-utils.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('atmosphericSkySimple');

export function initAtmosphericSky() {
  log.info('🌌 Starting simplified atmospheric sky system');
  
  const background = getElementById('atmosphericBackground');
  if (!background) {
    log.error('❌ Atmospheric background container not found!');
    return () => {};
  }
  
  log.info('✅ Found atmospheric background container');
  
  // Test: Add visible elements immediately
  try {
    // Clear any existing content
    background.innerHTML = '';
    
    // Add test structure
    background.innerHTML = `
      <div class="atmosphere" style="position: absolute; inset: 0; z-index: 1;">
        <div class="clouds" style="position: absolute; inset: 0; overflow: hidden;"></div>
        <div class="stars-container" style="position: absolute; inset: 0;"></div>
        <div class="test-indicator" style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          background: rgba(0,0,0,0.7);
          padding: 20px;
          border-radius: 10px;
          z-index: 1000;
          font-family: monospace;
        ">
          🌌 ATMOSPHERIC SYSTEM LOADED<br>
          <small>This should be visible if the system works</small>
        </div>
      </div>
    `;
    
    log.info('✅ Added test HTML structure');
    
    // Add test stars
    const starsContainer = background.querySelector('.stars-container');
    if (starsContainer) {
      for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.style.cssText = `
          position: absolute;
          width: 2px;
          height: 2px;
          background: white;
          border-radius: 50%;
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          opacity: ${Math.random() * 0.8 + 0.2};
          animation: twinkle 2s ease-in-out infinite alternate;
          animation-delay: ${Math.random() * 2}s;
        `;
        starsContainer.appendChild(star);
      }
      log.info(`✅ Added ${starsContainer.children.length} test stars`);
    }
    
    // Add test clouds
    const cloudsContainer = background.querySelector('.clouds');
    if (cloudsContainer) {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const cloud = document.createElement('div');
          cloud.style.cssText = `
            position: absolute;
            width: ${100 + Math.random() * 100}px;
            height: ${40 + Math.random() * 40}px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50px;
            top: ${Math.random() * 60}%;
            left: -200px;
            animation: moveCloud ${30 + Math.random() * 20}s linear infinite;
          `;
          cloudsContainer.appendChild(cloud);
          
          // Remove after animation
          setTimeout(() => {
            if (cloud.parentNode) {
              cloud.parentNode.removeChild(cloud);
            }
          }, 50000);
        }, i * 2000);
      }
      log.info('✅ Started cloud generation');
    }
    
    // Add CSS animations
    if (!document.getElementById('atmospheric-test-styles')) {
      const style = document.createElement('style');
      style.id = 'atmospheric-test-styles';
      style.textContent = `
        @keyframes twinkle {
          0% { opacity: 0.2; transform: scale(1); }
          100% { opacity: 1; transform: scale(1.2); }
        }
        
        @keyframes moveCloud {
          0% { transform: translateX(-200px); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translateX(calc(100vw + 200px)); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
      log.info('✅ Added CSS animations');
    }
    
    // Remove test indicator after 3 seconds
    setTimeout(() => {
      const indicator = background.querySelector('.test-indicator');
      if (indicator) {
        indicator.style.transition = 'opacity 1s ease-out';
        indicator.style.opacity = '0';
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 1000);
      }
    }, 3000);
    
    log.info('🌟 Simplified atmospheric system initialized successfully!');
    
    return () => {
      log.info('🧹 Cleaning up simplified atmospheric system');
      const testStyles = document.getElementById('atmospheric-test-styles');
      if (testStyles) testStyles.remove();
    };
    
  } catch (error) {
    log.error('❌ Error in simplified atmospheric system:', error);
    return () => {};
  }
}