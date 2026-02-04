import { useEffect, useRef, useCallback } from 'react';

export const useRobotAnimation = (_mood) => {
  const containerRef = useRef(null);
  const eyesRef = useRef(null);
  const leftPupilRef = useRef(null);
  const rightPupilRef = useRef(null);

  const _idleTimerRef = useRef(null);
  const blinkTimerRef = useRef(null);

  // Eye tracking
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!eyesRef.current) return;

      const rect = eyesRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate angle and distance limited to eye radius
      const maxDist = 3;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const angle = Math.atan2(dy, dx);
      const dist = Math.min(maxDist, Math.sqrt(dx * dx + dy * dy) / 30); // Dampened

      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;

      if (leftPupilRef.current) {
        leftPupilRef.current.setAttribute('cx', 40 + x);
        leftPupilRef.current.setAttribute('cy', 42 + y);
      }
      if (rightPupilRef.current) {
        rightPupilRef.current.setAttribute('cx', 60 + x);
        rightPupilRef.current.setAttribute('cy', 42 + y);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Blinking
  useEffect(() => {
    const blink = () => {
      if (!eyesRef.current) return;
      eyesRef.current.classList.add('blink');
      setTimeout(() => {
        if (eyesRef.current) eyesRef.current.classList.remove('blink');
      }, 150);

      blinkTimerRef.current = setTimeout(blink, Math.random() * 3000 + 2000);
    };

    blink();
    return () => clearTimeout(blinkTimerRef.current);
  }, []);

  // Knockback effect
  const triggerKnockback = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.classList.add('knockback');
      setTimeout(() => {
        if (containerRef.current)
          containerRef.current.classList.remove('knockback');
      }, 500);
    }
  }, []);

  return {
    containerRef,
    eyesRef,
    leftPupilRef,
    rightPupilRef,
    triggerKnockback,
  };
};
