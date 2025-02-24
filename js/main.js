"use strict";
import { AnimationManager, FeatureCardsManager } from './combined.js';

document.addEventListener("DOMContentLoaded", () => {
  try {
    const animation = new AnimationManager();
    const features = new FeatureCardsManager();

    animation.init();
    features.init();
  } catch (error) {
    console.error('Initialization error:', error);
  }
});
