import * as THREE from 'three';
import React from 'react';
import { ProjectGallery } from './ProjectGallery.js';
import { useScrollCamera } from '../hooks/useScrollCamera.js';

const { useEffect, useRef } = React;

// GLOBAL STATE
// We keep the renderer and scene persistent across mounts to prevent
// WebGL context churn (the "Too many active WebGL contexts" error).
let globalRenderer = null;
let globalScene = null;
let globalCamera = null;
let globalStars = null;
let globalGallery = null;
let globalCameraLight = null;
const globalRaycaster = new THREE.Raycaster();
const globalMouse = new THREE.Vector2();

/**
 * Three.js Scene Component
 * Uses a singleton pattern for the WebGLRenderer to survive React StrictMode
 * and fast navigation without creating/destroying contexts repeatedly.
 */
export const ThreeScene = ({ projects, onScrollUpdate, onReady, onSelect }) => {
  const containerRef = useRef(null);
  const frameIdRef = useRef(null);
  const scrollRef = useRef(0);
  const isMountedRef = useRef(true);
  const prevActiveIndexRef = useRef(-1);

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
        globalRenderer.setSize(window.innerWidth, window.innerHeight);
        globalRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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

        // Init Gallery (Dynamic content)
        // We re-create gallery content if projects change, but here we assume init once for simplicity
        // ideally we'd have a method to update it.
        globalGallery = new ProjectGallery(globalScene, projects);
      } catch (e) {
        console.error('Three.js Init Failed:', e);
        return;
      }
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
    const handleResize = () => {
      if (!isMountedRef.current || !globalRenderer || !globalCamera) return;
      globalCamera.aspect = window.innerWidth / window.innerHeight;
      globalCamera.updateProjectionMatrix();
      globalRenderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    // Force initial size update in case window changed while unmounted
    handleResize();

    // --- 4. ANIMATION LOOP ---
    const animate = (time) => {
      if (!isMountedRef.current) return;

      frameIdRef.current = requestAnimationFrame(animate);

      const t = time * 0.001;

      // Update Camera & Light
      if (globalCamera && globalCameraLight) {
        const totalPathLength = projects.length * 15 + 10;
        const targetZ = 5 - scrollRef.current * totalPathLength;

        // More responsive camera movement
        const lerpFactor = 0.08; // Increased from 0.05 for more responsiveness
        globalCamera.position.z +=
          (targetZ - globalCamera.position.z) * lerpFactor;

        // Smoother side-to-side movement with higher Y baseline
        globalCamera.position.x = Math.sin(t * 0.5) * 0.5;
        globalCamera.position.y = 1 + Math.cos(t * 0.3) * 0.3; // Higher baseline Y position

        globalCameraLight.position.copy(globalCamera.position);
      }

      // Update Stars
      if (globalStars) {
        globalStars.rotation.z = t * 0.02;
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
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      window.removeEventListener('resize', handleResize);

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

  const handleClick = (event) => {
    if (!onSelect || !globalCamera || !globalGallery) return;

    globalMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    globalMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    globalRaycaster.setFromCamera(globalMouse, globalCamera);

    const intersects = globalRaycaster.intersectObjects(
      globalGallery.group.children,
      true,
    );

    if (intersects.length > 0) {
      const hit = intersects.find((i) => i.object.userData.index !== undefined);
      if (hit) {
        onSelect(hit.object.userData.index);
      }
    }
  };

  return React.createElement('div', {
    ref: containerRef,
    style: { width: '100%', height: '100%' },
    onClick: handleClick,
  });
};
