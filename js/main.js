"use strict";
import { AnimationManager, FeatureCardsManager } from './combined.js';

document.addEventListener("DOMContentLoaded", () => {
  try {
    initAnimations();
    initFeatureCards();
  } catch (error) {
    console.error('Initialization error:', error);
  }
});

function initAnimations() {
  const animation = new AnimationManager();
  animation.init();
}

function initFeatureCards() {
  const features = new FeatureCardsManager();
  features.init();
}
