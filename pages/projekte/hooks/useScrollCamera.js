import { useEffect, useState } from 'react';

/**
 * Hook to manage scroll position and calculate camera position on a path
 * @param {Array} projects - List of projects to calculate path length
 * @returns {number} normalizedScroll - Scroll progress (0 to 1)
 */
export const useScrollCamera = (projects) => {
  const [normalizedScroll, setNormalizedScroll] = useState(0);

  useEffect(() => {
    // Only run if we have projects
    if (!projects || projects.length === 0) return;

    const handleScroll = () => {
      // Get current scroll position
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;

      // Calculate total scrollable height
      const documentHeight = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight,
      );

      const windowHeight = window.innerHeight;
      const scrollableHeight = documentHeight - windowHeight;

      // Calculate progress (0 to 1)
      let progress = 0;
      if (scrollableHeight > 0) {
        progress = scrollY / scrollableHeight;
      }

      // Clamp between 0 and 1
      const clampedProgress = Math.max(0, Math.min(1, progress));

      setNormalizedScroll(clampedProgress);
    };

    // Add scroll listener with passive option for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial calculation
    handleScroll();

    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [projects]); // Removed unused camera parameter

  return normalizedScroll;
};
