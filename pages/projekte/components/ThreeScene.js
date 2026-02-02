
import * as THREE from 'three';
import React from 'react';
import { ProjectGallery } from './ProjectGallery.js';
import { useScrollCamera } from '../hooks/useScrollCamera.js';

const { useEffect, useRef } = React;

/**
 * Three.js Scene Component
 * Handles the 3D environment, camera, and rendering loop.
 */
export const ThreeScene = ({ projects, onScrollUpdate, onReady }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const starsRef = useRef(null);
  const galleryRef = useRef(null);
  const frameIdRef = useRef(null);
  const scrollRef = useRef(0);
  const isMountedRef = useRef(true);

  // Use the hook to track scroll
  const normalizedScroll = useScrollCamera(new THREE.Camera(), projects);

  // Update ref whenever state changes so animation loop sees it
  useEffect(() => {
    scrollRef.current = normalizedScroll;
  }, [normalizedScroll]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!containerRef.current) return;

    // 1. Setup Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.035);
    sceneRef.current = scene;

    // 2. Setup Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 5);

    // 3. Setup Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Explicitly handle context loss
    renderer.domElement.addEventListener("webglcontextlost", function(event) {
        event.preventDefault();
        console.warn('WebGL context lost');
    }, false);

    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Create Starfield
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 4000;
    const posArray = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 150;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starMaterial = new THREE.PointsMaterial({
      size: 0.08,
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    starsRef.current = stars;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const cameraLight = new THREE.PointLight(0x60a5fa, 1.5, 30);
    scene.add(cameraLight);

    // 6. Initialize Project Gallery
    const gallery = new ProjectGallery(scene, projects);
    galleryRef.current = gallery;

    // 7. Handle Resize
    const handleResize = () => {
      if (!isMountedRef.current || !rendererRef.current) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // 8. Animation Loop
    const animate = (time) => {
      if (!isMountedRef.current) return;

      frameIdRef.current = requestAnimationFrame(animate);

      const t = time * 0.001;

      // Move Camera based on Scroll
      const totalPathLength = projects.length * 15 + 10;
      const targetZ = 5 - scrollRef.current * totalPathLength;

      // Smooth camera movement
      camera.position.z += (targetZ - camera.position.z) * 0.05;

      // Sway
      camera.position.x = Math.sin(t * 0.5) * 0.5;
      camera.position.y = Math.cos(t * 0.3) * 0.3;

      cameraLight.position.copy(camera.position);

      if (starsRef.current) {
        starsRef.current.rotation.z = t * 0.02;
      }

      if (galleryRef.current) {
        galleryRef.current.update(t);

        // Update active index
        const activeIndex = galleryRef.current.getActiveIndex(camera.position.z);
        if (onScrollUpdate) {
          onScrollUpdate(activeIndex);
        }
      }

      if (rendererRef.current) {
        rendererRef.current.render(scene, camera);
      }
    };
    animate(0);

    if (onReady) onReady();

    // Cleanup Function
    return () => {
      isMountedRef.current = false;

      // Stop loop
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }

      window.removeEventListener('resize', handleResize);

      // Clean up Gallery (if it has a dispose method)
      if (galleryRef.current && typeof galleryRef.current.dispose === 'function') {
        galleryRef.current.dispose();
      }

      // Clean up Scene Objects
      scene.traverse((object) => {
        if (!object.isMesh) return;

        if (object.geometry) {
          object.geometry.dispose();
        }

        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => {
                if (material.map) material.map.dispose();
                material.dispose();
            });
          } else {
            if (object.material.map) object.material.map.dispose();
            object.material.dispose();
          }
        }
      });

      // Clean up Stars specific (if not caught by traverse)
      if (starGeometry) starGeometry.dispose();
      if (starMaterial) starMaterial.dispose();

      // Dispose Renderer
      if (rendererRef.current) {
        // Remove canvas from DOM
        if (containerRef.current && rendererRef.current.domElement) {
            containerRef.current.removeChild(rendererRef.current.domElement);
        }

        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        rendererRef.current = null;
      }

      sceneRef.current = null;
    };
  }, []); // Run once

  return React.createElement('div', {
    ref: containerRef,
    style: { width: '100%', height: '100%' },
  });
};
