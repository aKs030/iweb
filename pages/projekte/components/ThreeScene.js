import * as THREE from 'three';
import React, { useEffect, useRef } from 'react';
import { ProjectGallery } from './ProjectGallery.js';
import { useScrollCamera } from '../hooks/useScrollCamera.js';
const BREAKPOINTS = {
  mobile: 640,
  tablet: 1024,
};

const QUALITY_PROFILES = Object.freeze({
  high: Object.freeze({
    key: 'high',
    starCount: 4000,
    starSize: 0.08,
    starOpacity: 0.6,
    dprCap: 2,
    targetFrameIntervalMs: 16,
    minFps: 48,
    motionScale: 1,
    antialias: true,
  }),
  balanced: Object.freeze({
    key: 'balanced',
    starCount: 2600,
    starSize: 0.072,
    starOpacity: 0.54,
    dprCap: 1.5,
    targetFrameIntervalMs: 20,
    minFps: 42,
    motionScale: 0.88,
    antialias: true,
  }),
  low: Object.freeze({
    key: 'low',
    starCount: 1400,
    starSize: 0.066,
    starOpacity: 0.46,
    dprCap: 1.25,
    targetFrameIntervalMs: 28,
    minFps: 34,
    motionScale: 0.72,
    antialias: false,
  }),
  saver: Object.freeze({
    key: 'saver',
    starCount: 800,
    starSize: 0.06,
    starOpacity: 0.36,
    dprCap: 1,
    targetFrameIntervalMs: 34,
    minFps: 24,
    motionScale: 0.5,
    antialias: false,
  }),
});

const QUALITY_PROFILE_ORDER = ['high', 'balanced', 'low', 'saver'];

function getRuntimeQualitySignals() {
  const nav =
    typeof navigator === 'undefined'
      ? /** @type {any} */ ({})
      : /** @type {any} */ (navigator);
  const connection =
    nav?.connection || nav?.mozConnection || nav?.webkitConnection || null;

  return {
    deviceMemory: Number(nav?.deviceMemory || 0),
    hardwareConcurrency: Number(nav?.hardwareConcurrency || 0),
    effectiveType: String(connection?.effectiveType || '').toLowerCase(),
    saveData: Boolean(connection?.saveData),
    reducedMotion:
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

function resolveInitialQualityProfileKey(viewportWidth) {
  const signals = getRuntimeQualitySignals();

  if (signals.reducedMotion || signals.saveData) {
    return 'saver';
  }

  if (
    signals.effectiveType === 'slow-2g' ||
    signals.effectiveType === '2g' ||
    (signals.deviceMemory > 0 && signals.deviceMemory <= 2)
  ) {
    return 'low';
  }

  if (
    viewportWidth <= BREAKPOINTS.mobile ||
    (signals.hardwareConcurrency > 0 && signals.hardwareConcurrency <= 4) ||
    (signals.deviceMemory > 0 && signals.deviceMemory <= 4)
  ) {
    return 'balanced';
  }

  return 'high';
}

function getNextLowerQualityProfileKey(currentKey) {
  const currentIndex = QUALITY_PROFILE_ORDER.indexOf(currentKey);
  if (currentIndex < 0) return QUALITY_PROFILE_ORDER[QUALITY_PROFILE_ORDER.length - 1];
  return QUALITY_PROFILE_ORDER[Math.min(currentIndex + 1, QUALITY_PROFILE_ORDER.length - 1)];
}

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

function createStarsForQuality(quality) {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = quality.starCount;
  const posArray = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount * 3; i += 1) {
    posArray[i] = (Math.random() - 0.5) * 150;
  }

  starGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(posArray, 3),
  );

  const starMaterial = new THREE.PointsMaterial({
    size: quality.starSize,
    color: 0xffffff,
    transparent: true,
    opacity: quality.starOpacity,
  });

  return new THREE.Points(starGeometry, starMaterial);
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
let globalQualityProfileKey = '';
let globalQualityProfile = null;
let globalQualityRuntime = {
  frameDeltas: [],
  lastFrameTime: 0,
  lastPerformanceCheckTime: 0,
  lastRenderTime: 0,
};

function getActiveQualityProfile() {
  return globalQualityProfile || QUALITY_PROFILES.balanced;
}

function setActiveQualityProfile(profileKey) {
  const nextProfile = QUALITY_PROFILES[profileKey] || QUALITY_PROFILES.balanced;
  if (globalQualityProfileKey === nextProfile.key && globalQualityProfile) {
    return false;
  }

  globalQualityProfileKey = nextProfile.key;
  globalQualityProfile = nextProfile;
  globalQualityRuntime = {
    frameDeltas: [],
    lastFrameTime: 0,
    lastPerformanceCheckTime: 0,
    lastRenderTime: 0,
  };
  return true;
}

function rebuildStarsForActiveQuality() {
  if (!globalScene) return;

  if (globalStars) {
    globalScene.remove(globalStars);
    globalStars.geometry?.dispose?.();
    globalStars.material?.dispose?.();
  }

  globalStars = createStarsForQuality(getActiveQualityProfile());
  globalScene.add(globalStars);
}

function maybeDowngradeQuality(now) {
  const quality = getActiveQualityProfile();
  const runtime = globalQualityRuntime;

  if (!runtime.lastFrameTime) {
    runtime.lastFrameTime = now;
    runtime.lastPerformanceCheckTime = now;
    return false;
  }

  const delta = now - runtime.lastFrameTime;
  runtime.lastFrameTime = now;

  if (delta <= 0 || delta > 1000) {
    return false;
  }

  runtime.frameDeltas.push(delta);
  if (runtime.frameDeltas.length > 48) {
    runtime.frameDeltas.shift();
  }

  if (
    runtime.frameDeltas.length < 12 ||
    now - runtime.lastPerformanceCheckTime < 2000
  ) {
    return false;
  }

  runtime.lastPerformanceCheckTime = now;
  const avgDelta =
    runtime.frameDeltas.reduce((sum, value) => sum + value, 0) /
    runtime.frameDeltas.length;
  runtime.frameDeltas = [];

  const fps = avgDelta > 0 ? 1000 / avgDelta : 60;
  if (fps >= quality.minFps || quality.key === 'saver') {
    return false;
  }

  return setActiveQualityProfile(getNextLowerQualityProfileKey(quality.key));
}

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
  const isVisibleRef = useRef(false);
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

    if (!globalQualityProfile) {
      setActiveQualityProfile(
        resolveInitialQualityProfileKey(window.innerWidth),
      );
    }

    // --- 1. INITIALIZATION (Once per app session) ---
    if (!globalRenderer) {
      try {
        const quality = getActiveQualityProfile();
        // Setup Renderer
        globalRenderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: quality.antialias,
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
        globalStars = createStarsForQuality(quality);
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
      const quality = getActiveQualityProfile();

      globalRenderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, quality.dprCap),
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

      // CPU/GPU Optimization: Skip heavy calculations and rendering if totally off-screen
      if (!isVisibleRef.current) return;

      const quality = getActiveQualityProfile();
      if (
        globalQualityRuntime.lastRenderTime &&
        time - globalQualityRuntime.lastRenderTime <
          quality.targetFrameIntervalMs
      ) {
        return;
      }
      globalQualityRuntime.lastRenderTime = time;

      if (maybeDowngradeQuality(time)) {
        rebuildStarsForActiveQuality();
        doResize();
      }

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
        globalCamera.position.x =
          Math.sin(t * 0.5) * motion.xAmplitude * quality.motionScale;
        globalCamera.position.y =
          motion.yBase +
          Math.cos(t * 0.3) * motion.yAmplitude * quality.motionScale;

        globalCameraLight.position.copy(globalCamera.position);
      }

      // Update Stars
      if (globalStars) {
        const viewportWidth = viewportWidthRef.current;
        const motion = getMotionProfile(viewportWidth);
        globalStars.rotation.z =
          t * motion.starRotationSpeed * quality.motionScale;
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

    // --- 4b. VISIBILITY OBSERVER ---
    let visibilityObserver = null;
    if (window.IntersectionObserver && containerRef.current) {
      visibilityObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0]) {
            isVisibleRef.current = entries[0].isIntersecting;
          }
        },
        { rootMargin: '100px', threshold: 0 }, // Add soft margin to render just before entering
      );
      visibilityObserver.observe(containerRef.current);
    } else {
      // Fallback
      isVisibleRef.current = true;
    }

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
      if (visibilityObserver) {
        visibilityObserver.disconnect();
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
    className: 'three-scene-container',
  });
};
