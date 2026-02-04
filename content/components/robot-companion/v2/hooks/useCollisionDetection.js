import { useEffect, useRef } from 'react';
import { RobotCollisionV2 } from '../utils/RobotCollisionV2.js';

export const useCollisionDetection = (
  avatarRef,
  containerRef,
  setBubble,
  triggerKnockback,
  isOpen,
) => {
  const collisionRef = useRef(null);

  useEffect(() => {
    // Wait for refs to be populated
    if (!containerRef.current) return;

    // Avatar might be inside container, let's find it if not passed directly or if it's the SVG
    // But RobotAvatar passes us the button ref probably?
    // Actually RobotAvatar renders a button.
    // We need to pass the button ref (or svg ref) to this hook.
    // In RobotCompanionApp we have containerRef from useRobotAnimation.
    // We can query selector the avatar if needed or pass a ref.

    // Let's assume avatarRef points to the button or SVG container
    const avatarEl =
      avatarRef.current || containerRef.current.querySelector('.robot-avatar');

    if (!avatarEl) return;

    const api = {
      avatar: avatarEl,
      container: containerRef.current,
      showBubble: (text) => setBubble(text),
      hideBubble: () => setBubble(''),
      triggerKnockback,
    };

    collisionRef.current = new RobotCollisionV2(api);

    let animId;
    const loop = () => {
      if (collisionRef.current) {
        collisionRef.current.scanForCollisions(isOpen);
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    // Also listen for typewriter events
    const handleTypewriter = () => {
      try {
        const tw = document.querySelector('.typewriter-title');
        if (tw && collisionRef.current) {
          collisionRef.current.checkForTypewriterCollision(
            tw.getBoundingClientRect(),
          );
        }
      } catch {
        // ignore
      }
    };

    // Listen to hero:typingEnd
    document.addEventListener('hero:typingEnd', handleTypewriter);

    // Check on scroll too (throttled in the class usually, but we can trigger it)
    const handleScroll = () => {
      // Logic inside scanForCollisions handles throttling
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      collisionRef.current?.destroy();
      document.removeEventListener('hero:typingEnd', handleTypewriter);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef, isOpen, setBubble, triggerKnockback]); // removed avatarRef dependency to rely on querySelector if needed or consistent ref

  return collisionRef;
};
