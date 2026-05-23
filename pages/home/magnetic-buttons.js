/**
 * Magnetic button effect for home buttons.
 * Adds a subtle follow-mouse effect to buttons with class .home-btn.
 */

export function initMagneticButtons() {
  const buttons = document.querySelectorAll(".home-btn");
  if (!buttons.length) return () => {};

  const cleanups = Array.from(buttons).map(btn => {
    let frameId;
    let targetX = 0,
      targetY = 0;
    let currentX = 0,
      currentY = 0;
    let active = false;

    const lerp = (start, end, factor) => start + (end - start) * factor;

    const update = () => {
      currentX = lerp(currentX, targetX, 0.1);
      currentY = lerp(currentY, targetY, 0.1);

      btn.style.transform = `translate(${currentX}px, ${currentY}px) scale(${active ? 1.02 : 1})`;

      if (!active && Math.abs(currentX) < 0.01 && Math.abs(currentY) < 0.01) {
        btn.style.transform = "";
        return;
      }

      frameId = requestAnimationFrame(update);
    };

    const handleMouseMove = e => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      const maxDistance = 10;
      targetX = (x / (rect.width / 2)) * maxDistance;
      targetY = (y / (rect.height / 2)) * maxDistance;

      if (!active) {
        active = true;
        frameId = requestAnimationFrame(update);
      }
    };

    const handleMouseLeave = () => {
      active = false;
      targetX = 0;
      targetY = 0;
      if (!frameId) {
        frameId = requestAnimationFrame(update);
      }
    };

    btn.addEventListener("mousemove", handleMouseMove, { passive: true });
    btn.addEventListener("mouseleave", handleMouseLeave, { passive: true });

    return () => {
      btn.removeEventListener("mousemove", handleMouseMove);
      btn.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(frameId);
      btn.style.transform = "";
    };
  });

  return () => {
    cleanups.forEach(cleanup => cleanup());
  };
}
