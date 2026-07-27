let activeFrame = 0;
let activeCleanup = null;

const smootherstep = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export function scrollToSectionSlow(section, { duration = 2100, reduceMotion = false } = {}) {
  if (!(section instanceof HTMLElement)) return;
  if (activeFrame) {
    cancelAnimationFrame(activeFrame);
    activeFrame = 0;
  }
  activeCleanup?.();

  const root = document.documentElement;
  const padding = Number.parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
  const start = window.scrollY;
  const target = Math.max(0, section.offsetTop - padding);
  const distance = target - start;
  if (reduceMotion || Math.abs(distance) < 2) {
    window.scrollTo({ top: target, behavior: "auto" });
    return;
  }

  const previousBehavior = root.style.scrollBehavior;
  const previousSnap = root.style.scrollSnapType;
  const startedAt = performance.now();
  root.style.scrollBehavior = "auto";
  root.style.scrollSnapType = "none";
  activeCleanup = () => {
    root.style.scrollBehavior = previousBehavior;
    root.style.scrollSnapType = previousSnap;
    activeCleanup = null;
  };

  const step = now => {
    const progress = Math.min(1, (now - startedAt) / duration);
    window.scrollTo({ top: start + distance * smootherstep(progress), behavior: "auto" });
    if (progress < 1) {
      activeFrame = requestAnimationFrame(step);
      return;
    }
    activeFrame = 0;
    activeCleanup?.();
  };

  activeFrame = requestAnimationFrame(step);
}
