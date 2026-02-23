import * as THREE from 'three';
import React, { useEffect, useRef } from 'react';
import { ProjectGallery } from './ProjectGallery.js';
import { useScrollCamera } from '../hooks/useScrollCamera.js';
const BREAKPOINTS = {
  mobile: 640,
  tablet: 1024,
};

function getViewportSize(container) {
  const width = Math.max(
    1,
    Math.floor(container?.clientWidth || window.innerWidth),
  );
  const height = Math.max(
    1,
    Math.floor(container?.clientHeight || window.innerHeight),
  );

  return { width, height };
}

function getCameraFov(viewportWidth) {
  if (viewportWidth <= BREAKPOINTS.mobile) return 72;
  if (viewportWidth <= BREAKPOINTS.tablet) return 66;
  return 60;
}

function getMotionProfile(viewportWidth) {
  if (viewportWidth <= BREAKPOINTS.mobile) {
    return {
      lerpFactor: 0.11,
      xAmplitude: 0.2,
      yBase: 0.78,
      yAmplitude: 0.16,
      starRotationSpeed: 0.012,
    };
  }

  if (viewportWidth <= BREAKPOINTS.tablet) {
    return {
      lerpFactor: 0.095,
      xAmplitude: 0.35,
      yBase: 0.88,
      yAmplitude: 0.22,
      starRotationSpeed: 0.016,
    };
  }

  return {
    lerpFactor: 0.08,
    xAmplitude: 0.5,
    yBase: 1,
    yAmplitude: 0.3,
    starRotationSpeed: 0.02,
  };
}

function getProjectsSignature(projects) {
  return projects
    .map((project) => project?.name || project?.dirName || project?.id || '')
    .join('|');
}

// GLOBAL STATE
// We keep the renderer and scene persistent across mounts to prevent
// WebGL context churn (the "Too many active WebGL contexts" error).
let globalRenderer = null;
let globalScene = null;
let globalCamera = null;
let globalStars = null;
let globalGallery = null;
let globalCameraLight = null;
let globalGallerySignature = '';

/**
 * Three.js Scene Component
 * Uses a singleton pattern for the WebGLRenderer to survive React StrictMode
 * and fast navigation without creating/destroying contexts repeatedly.
 */
export const ThreeScene = ({ projects, onScrollUpdate, onReady }) => {
  const containerRef = useRef(null);
  const frameIdRef = useRef(null);
  const scrollRef = useRef(0);
  const isMountedRef = useRef(true);
  const prevActiveIndexRef = useRef(-1);
  const viewportWidthRef = useRef(window.innerWidth);

  // Use the hook to track scroll
  const normalizedScroll = useScrollCamera(projects);

  // Update ref whenever state changes so animation loop sees it
  useEffect(() => {
    scrollRef.current = normalizedScroll;
  }, [normalizedScroll]);

  // Init / Reuse 3D Environment
  useEffect(() => {
    isMountedRef.current = true;
    if (!containerRef.current) return;

    // --- 1. INITIALIZATION (Once per app session) ---
    if (!globalRenderer) {
      try {
        // Setup Renderer
        globalRenderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false,
        });

        // Handle context loss
        globalRenderer.domElement.addEventListener(
          'webglcontextlost',
          (event) => {
            event.preventDefault();
            console.warn('WebGL context lost');
          },
          false,
        );

        // Setup Scene
        globalScene = new THREE.Scene();
        globalScene.fog = new THREE.FogExp2(0x000000, 0.035);

        // Setup Camera
        globalCamera = new THREE.PerspectiveCamera(
          60,
          window.innerWidth / window.innerHeight,
          0.1,
          1000,
        );
        globalCamera.position.set(0, 1, 5); // Slightly higher Y position to better view elevated objects

        // Setup Stars
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 4000;
        const posArray = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount * 3; i++) {
          posArray[i] = (Math.random() - 0.5) * 150;
        }
        starGeometry.setAttribute(
          'position',
          new THREE.BufferAttribute(posArray, 3),
        );
        const starMaterial = new THREE.PointsMaterial({
          size: 0.08,
          color: 0xffffff,
          transparent: true,
          opacity: 0.6,
        });
        globalStars = new THREE.Points(starGeometry, starMaterial);
        globalScene.add(globalStars);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        globalScene.add(ambientLight);

        globalCameraLight = new THREE.PointLight(0x60a5fa, 1.5, 30);
        globalScene.add(globalCameraLight);
      } catch (e) {
        console.error('Three.js Init Failed:', e);
        return;
      }
    }

    const nextGallerySignature = getProjectsSignature(projects);
    if (!globalGallery || globalGallerySignature !== nextGallerySignature) {
      if (globalGallery) {
        globalGallery.dispose?.();
      }
      globalGallery = new ProjectGallery(globalScene, projects);
      globalGallerySignature = nextGallerySignature;
    }

    // --- 2. ATTACH TO DOM ---
    // Ensure the canvas is in the current container
    if (
      globalRenderer.domElement.parentElement &&
      globalRenderer.domElement.parentElement !== containerRef.current
    ) {
      globalRenderer.domElement.parentElement.removeChild(
        globalRenderer.domElement,
      );
    }
    if (
      globalRenderer.domElement.parentElement !== containerRef.current &&
      containerRef.current
    ) {
      containerRef.current.appendChild(globalRenderer.domElement);
    }

    // --- 3. RESIZE HANDLER ---
    let resizeTimer = null;
    let prevWidth = window.innerWidth;

    const doResize = () => {
      if (
        !isMountedRef.current ||
        !globalRenderer ||
        !globalCamera ||
        !containerRef.current
      )
        return;

      const { width, height } = getViewportSize(containerRef.current);
      viewportWidthRef.current = width;

      // MAX QUALITY: Remove caps and allow native resolution up to DPR 3
      const dprCap = 3;

      globalRenderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, dprCap),
      );
      globalRenderer.setSize(width, height, false);
      globalCamera.fov = getCameraFov(width);
      globalCamera.aspect = width / height;
      globalCamera.updateProjectionMatrix();
      globalGallery?.setViewportWidth(width);
    };

    const handleResize = () => {
      const currentWidth = window.innerWidth;
      const widthChanged = Math.abs(currentWidth - prevWidth) >= 10;
      prevWidth = currentWidth;

      // Mobile optimization: Don't block the main thread for height-only changes (address bar)
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doResize, widthChanged ? 50 : 300);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, {
      passive: true,
    });

    let resizeObserver = null;
    if (window.ResizeObserver && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(containerRef.current);
    }

    // Force initial size update in case window changed while unmounted
    doResize();

    // --- 4. ANIMATION LOOP ---
    const animate = (time) => {
      if (!isMountedRef.current) return;

      frameIdRef.current = requestAnimationFrame(animate);

      const t = time * 0.001;

      // Update Camera & Light
      if (globalCamera && globalCameraLight) {
        const viewportWidth = viewportWidthRef.current;
        const motion = getMotionProfile(viewportWidth);
        const totalPathLength =
          globalGallery?.getPathLength?.() || projects.length * 15 + 10;
        const targetZ = 5 - scrollRef.current * totalPathLength;

        // More responsive camera movement
        const lerpFactor = motion.lerpFactor;
        globalCamera.position.z +=
          (targetZ - globalCamera.position.z) * lerpFactor;

        // Reduce lateral motion on small screens to keep focus centered.
        globalCamera.position.x = Math.sin(t * 0.5) * motion.xAmplitude;
        globalCamera.position.y =
          motion.yBase + Math.cos(t * 0.3) * motion.yAmplitude;

        globalCameraLight.position.copy(globalCamera.position);
      }

      // Update Stars
      if (globalStars) {
        const viewportWidth = viewportWidthRef.current;
        const motion = getMotionProfile(viewportWidth);
        globalStars.rotation.z = t * motion.starRotationSpeed;
      }

      // Update Gallery
      if (globalGallery) {
        globalGallery.update(t);
        const activeIndex = globalGallery.getActiveIndex(
          globalCamera.position.z,
        );
        if (onScrollUpdate && activeIndex !== prevActiveIndexRef.current) {
          prevActiveIndexRef.current = activeIndex;
          onScrollUpdate(activeIndex);
        }
      }

      // Render
      if (globalRenderer && globalScene && globalCamera) {
        globalRenderer.render(globalScene, globalCamera);
      }
    };
    animate(performance.now());

    if (onReady) onReady();

    // --- 5. CLEANUP (Soft) ---
    return () => {
      isMountedRef.current = false;
      if (resizeTimer) clearTimeout(resizeTimer);
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      // IMPORTANT: We do NOT dispose the renderer here.
      // We only remove the canvas from the DOM so the React component can unmount cleanly.
      // The context remains active in `globalRenderer` for the next mount.
      if (globalRenderer && globalRenderer.domElement && containerRef.current) {
        const container = containerRef.current;
        // Checking containerRef.current.contains handles cases where it might already be removed
        if (container.contains(globalRenderer.domElement)) {
          container.removeChild(globalRenderer.domElement);
        }
      }
    };
  }, []); // Run once on mount

  return React.createElement('div', {
    ref: containerRef,
    style: { width: '100%', height: '100%' },
  });
};
