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
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const starsRef = useRef(null);
  const galleryRef = useRef(null);
  const scrollRef = useRef(0); // Mutable ref to hold latest scroll value for loop

  // Use the hook to track scroll
  const normalizedScroll = useScrollCamera(cameraRef.current, projects);

  // Update ref whenever state changes so animation loop sees it
  useEffect(() => {
    scrollRef.current = normalizedScroll;
  }, [normalizedScroll]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Setup Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.035); // Deep space fog
    sceneRef.current = scene;

    // 2. Setup Camera
    const camera = new THREE.PerspectiveCamera(
      60, // Slightly wider FOV for speed sensation
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    // Initial position
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    // 3. Setup Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Create Starfield
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
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    starsRef.current = stars;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // Low ambient
    scene.add(ambientLight);

    // Camera light (moves with camera)
    const cameraLight = new THREE.PointLight(0x60a5fa, 1.5, 30);
    scene.add(cameraLight);

    // 6. Initialize Project Gallery
    const gallery = new ProjectGallery(scene, projects);
    galleryRef.current = gallery;

    // 7. Handle Resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // 8. Animation Loop
    const animate = (time) => {
      requestAnimationFrame(animate);

      const t = time * 0.001; // Seconds

      // Move Camera based on Scroll
      // Total path length depends on projects count (approx 15 units per project)
      const totalPathLength = projects.length * 15 + 10;
      const targetZ = 5 - scrollRef.current * totalPathLength;

      // Smooth camera movement (Lerp)
      // We lerp the camera position to the target position
      camera.position.z += (targetZ - camera.position.z) * 0.05;

      // Add slight camera sway based on mouse/time could go here
      camera.position.x = Math.sin(t * 0.5) * 0.5;
      camera.position.y = Math.cos(t * 0.3) * 0.3;

      // Update Lighting to follow camera
      cameraLight.position.copy(camera.position);

      // Rotate stars
      if (starsRef.current) {
        starsRef.current.rotation.z = t * 0.02; // Rotate view
      }

      // Update Project Animations
      if (galleryRef.current) {
        galleryRef.current.update(t, camera.position.z);

        // Check active project
        const activeIndex = galleryRef.current.getActiveIndex(
          camera.position.z,
        );
        if (onScrollUpdate) {
          onScrollUpdate(activeIndex);
        }
      }

      renderer.render(scene, camera);
    };
    animate(0);

    if (onReady) onReady();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      if (galleryRef.current) galleryRef.current.dispose();
    };
  }, []); // Run once

  return React.createElement('div', {
    ref: containerRef,
    style: { width: '100%', height: '100%' },
  });
};
