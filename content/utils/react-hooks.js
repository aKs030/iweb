/**
 * Custom React Hooks
 * Reusable hooks for common functionality
 */

// React hooks are available globally via React object
const { useState, useEffect, useRef } = React;

/**
 * Debounce hook - delays updating a value until after a specified delay
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {any} Debounced value
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Focus trap hook for modal dialogs
 * @param {boolean} isActive - Whether the focus trap is active
 * @returns {Object} Focus trap utilities
 */
export function useFocusTrap(isActive) {
  const prevActiveRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    const focusableSelector =
      'a[href], area[href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';

    function getFocusableElements(modal) {
      const nodes = modal.querySelectorAll(focusableSelector);
      return Array.prototype.slice.call(nodes);
    }

    function handleKeyTrap(e) {
      if (e.key === 'Tab') {
        const modal = document.getElementById('lightbox');
        if (!modal) return;

        const focusable = getFocusableElements(modal);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (!modal.contains(document.activeElement)) {
          first.focus();
          e.preventDefault();
          return;
        }

        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
          return;
        }

        if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
          return;
        }
      }
    }

    // Store current active element
    prevActiveRef.current = document.activeElement;

    // Set aria-hidden on main content
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.setAttribute('aria-hidden', 'true');

    // Focus close button after a brief delay
    setTimeout(() => {
      const closeBtn = document.getElementById('lightbox-close');
      if (closeBtn) closeBtn.focus();
    }, 0);

    // Add event listener
    document.addEventListener('keydown', handleKeyTrap);

    return () => {
      document.removeEventListener('keydown', handleKeyTrap);

      // Restore main content
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.removeAttribute('aria-hidden');

      // Restore focus
      setTimeout(() => {
        try {
          if (
            prevActiveRef.current &&
            typeof prevActiveRef.current.focus === 'function'
          ) {
            prevActiveRef.current.focus();
          }
        } catch (err) {
          // Focus restoration failed - ignore silently
        }
      }, 0);
    };
  }, [isActive]);

  return { prevActiveRef };
}

/**
 * Keyboard navigation hook for image galleries
 * @param {Object} selectedImage - Currently selected image
 * @param {Function} setSelectedImage - Function to set selected image
 * @param {Function} navigateImage - Function to navigate between images
 * @param {Function} setZoom - Function to set zoom level
 * @param {Function} setIsSlideshow - Function to set slideshow state
 */
export function useKeyboardNavigation(
  selectedImage,
  setSelectedImage,
  navigateImage,
  setZoom,
  setIsSlideshow,
) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedImage) return;

      switch (e.key) {
        case 'Escape':
          setSelectedImage(null);
          setZoom(1);
          setIsSlideshow(false);
          break;
        case 'ArrowLeft':
          navigateImage(-1);
          break;
        case 'ArrowRight':
          navigateImage(1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, setSelectedImage, navigateImage, setZoom, setIsSlideshow]);
}

/**
 * Progressive image loading hook
 * @param {string} src - Image source URL
 * @returns {Object} Loading state and handlers
 */
export function useProgressiveImage(src) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!imgRef.current) return;

    // If image is already cached, show immediately
    if (imgRef.current.complete && imgRef.current.naturalHeight !== 0) {
      setLoaded(true);
    }
  }, [src]);

  const handleLoad = () => setLoaded(true);
  const handleError = () => setError(true);

  return {
    loaded,
    error,
    imgRef,
    handleLoad,
    handleError,
  };
}
