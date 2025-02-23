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

    // Back to Top Button
    const backToTop = document.getElementById('back-to-top');
    if (backToTop) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > window.innerHeight / 2) {
          backToTop.classList.add('visible');
        } else {
          backToTop.classList.remove('visible');
        }
      });

      backToTop.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }
  } catch (error) {
    console.error('Initialization error:', error);
  }
});
