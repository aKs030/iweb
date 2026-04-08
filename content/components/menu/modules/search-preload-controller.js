import { resourceHints } from '#core/resource-hints.js';
import { SEARCH_PRELOAD_URLS } from '#config/import-map.generated.js';

export class MenuSearchPreloadController {
  constructor(options = {}) {
    this.container = options.container || null;
    this.timers = options.timers || null;
    this.addListener = options.addListener || (() => () => {});
    this.searchDepsPreloaded = false;
    this.searchDepsIntentTimer = null;
  }

  setupIntent({ trigger, bar }) {
    if (!trigger || !bar) return [];

    const preload = () => this.preloadSearchDependencies();
    const scheduleIntent = () => {
      if (
        this.searchDepsPreloaded ||
        this.searchDepsIntentTimer ||
        !this.timers
      ) {
        return;
      }

      this.searchDepsIntentTimer = this.timers.setTimeout(() => {
        this.searchDepsIntentTimer = null;
        preload();
      }, 80);
    };

    const clearIntentTimer = () => {
      if (!this.searchDepsIntentTimer || !this.timers) return;
      this.timers.clearTimeout(this.searchDepsIntentTimer);
      this.searchDepsIntentTimer = null;
    };

    const isPointerNearSearchControl = (event) => {
      const pointerX = Number(event?.clientX);
      const pointerY = Number(event?.clientY);
      if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
        return false;
      }

      const rects = [trigger, bar]
        .map((element) => element?.getBoundingClientRect?.())
        .filter(Boolean);
      if (!rects.length) return false;

      return rects.some((rect) => {
        const dx =
          pointerX < rect.left
            ? rect.left - pointerX
            : pointerX > rect.right
              ? pointerX - rect.right
              : 0;
        const dy =
          pointerY < rect.top
            ? rect.top - pointerY
            : pointerY > rect.bottom
              ? pointerY - rect.bottom
              : 0;
        return Math.hypot(dx, dy) <= 120;
      });
    };

    const handlePointerMove = (event) => {
      if (this.searchDepsPreloaded) return;
      if (!isPointerNearSearchControl(event)) return;
      scheduleIntent();
    };

    /** @type {Array<() => void>} */
    const cleanupFns = [];
    const canHover = window.matchMedia?.('(hover: hover)').matches;
    if (canHover) {
      cleanupFns.push(
        this.addListener(this.container, 'pointermove', handlePointerMove, {
          passive: true,
        }),
        this.addListener(trigger, 'pointerenter', scheduleIntent),
        this.addListener(bar, 'pointerenter', scheduleIntent),
      );
    }

    cleanupFns.push(
      this.addListener(trigger, 'focus', preload),
      this.addListener(bar, 'focusin', preload),
      this.addListener(trigger, 'click', preload),
      clearIntentTimer,
    );

    return cleanupFns;
  }

  preloadSearchDependencies() {
    if (this.searchDepsPreloaded) return;
    this.searchDepsPreloaded = true;

    [...SEARCH_PRELOAD_URLS].forEach((href) =>
      resourceHints.modulePreload(href),
    );
  }
}
