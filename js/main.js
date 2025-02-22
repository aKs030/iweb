import { AnimationManager } from './animation.js';
import { NavigationManager } from './navigation.js';
import { FeatureCardsManager } from './features.js';

document.addEventListener("DOMContentLoaded", () => {
  try {
    const animation = new AnimationManager();
    const navigation = new NavigationManager();
    const features = new FeatureCardsManager();

    animation.init();
    navigation.init();
    features.init();
  } catch (error) {
    console.error('Initialization error:', error);
  }
});
