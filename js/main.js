"use strict";
import { AnimationManager, NavigationManager, FeatureCardsManager } from './combined.js';

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
