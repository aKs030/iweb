import { useEffect, useState } from 'react';

/**
 * Hook to manage scroll position and calculate camera position on a path
 * @param {THREE.Camera} camera - The Three.js camera
 * @param {Array} projects - List of projects to calculate path length
 * @returns {number} normalizedScroll - Scroll progress (0 to 1)
 */
export const useScrollCamera = (camera, projects) => {
  const [normalizedScroll, setNormalizedScroll] = useState(0);

  useEffect(() => {
    // Only run if we have a camera and projects
    if (!camera || !projects || projects.length === 0) return;

    // Define the path the camera will fly through
    // A simple sine wave curve moving forward in Z (actually backward in Three.js terms to see objects)
    // We want to fly PAST objects.

    // Project placement strategy:
    // Place projects every 10 units along Z.
    // Path should go slightly offset so we look AT them.

    const handleScroll = () => {
      // Calculate scroll progress based on total document height
      // docHeight - windowHeight = scrollable area
      const scrollableHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const scrollY = window.scrollY;

      // Safety check to avoid division by zero
      const progress = scrollableHeight > 0 ? scrollY / scrollableHeight : 0;

      // Clamp between 0 and 1
      const clampedProgress = Math.max(0, Math.min(1, progress));

      setNormalizedScroll(clampedProgress);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [camera, projects]);

  return normalizedScroll;
};
