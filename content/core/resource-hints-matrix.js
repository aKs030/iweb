const DEFAULT_PREFETCH_EAGERNESS = 'conservative';

export const RESOURCE_HINT_ROUTE_MATRIX = Object.freeze({
  home: Object.freeze({
    seedRoutes: ['/projekte/', '/gallery/', '/videos/', '/blog/', '/about/'],
    maxRoutes: 6,
    maxPrefetch: 3,
    prerenderEnabled: true,
    prerenderEagerness: 'moderate',
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 75,
  }),
  blog: Object.freeze({
    seedRoutes: ['/', '/projekte/', '/videos/', '/about/'],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: 'conservative',
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 65,
  }),
  videos: Object.freeze({
    seedRoutes: ['/', '/gallery/', '/blog/', '/about/'],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: 'conservative',
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 65,
  }),
  gallery: Object.freeze({
    seedRoutes: ['/', '/videos/', '/blog/', '/about/'],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: 'conservative',
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 65,
  }),
  projects: Object.freeze({
    seedRoutes: ['/', '/blog/', '/gallery/', '/videos/', '/about/'],
    maxRoutes: 5,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: 'conservative',
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 65,
  }),
  about: Object.freeze({
    seedRoutes: ['/', '/projekte/', '/blog/', '/gallery/', '/videos/'],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: 'conservative',
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 60,
  }),
  generic: Object.freeze({
    seedRoutes: ['/projekte/', '/gallery/', '/videos/', '/blog/', '/about/'],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: 'conservative',
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 60,
  }),
});

export function detectResourceHintRouteBucket(pathname = '/') {
  const path = String(pathname || '/').toLowerCase();

  if (path === '/' || path === '/index.html') return 'home';
  if (path.startsWith('/blog')) return 'blog';
  if (path.startsWith('/videos')) return 'videos';
  if (path.startsWith('/gallery')) return 'gallery';
  if (path.startsWith('/projekte')) return 'projects';
  if (path.startsWith('/about')) return 'about';
  return 'generic';
}

export function getAdaptiveResourceHintBudget(options = {}) {
  const {
    pathname = '/',
    connection = null,
    deviceMemory = 0,
    hardwareConcurrency = 0,
  } = options;

  const bucket = detectResourceHintRouteBucket(pathname);
  const base =
    RESOURCE_HINT_ROUTE_MATRIX[bucket] || RESOURCE_HINT_ROUTE_MATRIX.generic;
  const saveData = Boolean(connection?.saveData);
  const effectiveType = String(connection?.effectiveType || '').toLowerCase();
  const memory = Number(deviceMemory || 0);
  const cores = Number(hardwareConcurrency || 0);

  const budget = {
    ...base,
    seedRoutes: [...base.seedRoutes],
  };

  if (
    saveData ||
    effectiveType.includes('2g') ||
    (memory > 0 && memory <= 2) ||
    (cores > 0 && cores <= 4)
  ) {
    budget.maxRoutes = Math.min(budget.maxRoutes, 3);
    budget.maxPrefetch = Math.min(budget.maxPrefetch, 2);
    budget.prerenderEnabled = false;
    budget.prerenderEagerness = 'conservative';
    budget.intentWarmupDelayMs = Math.max(budget.intentWarmupDelayMs, 110);
    return budget;
  }

  if (
    effectiveType.includes('3g') ||
    (memory > 0 && memory <= 4) ||
    (cores > 0 && cores <= 8)
  ) {
    budget.maxRoutes = Math.min(budget.maxRoutes, 4);
    budget.maxPrefetch = Math.min(budget.maxPrefetch, 2);
    budget.prerenderEagerness = 'conservative';
    budget.intentWarmupDelayMs = Math.max(budget.intentWarmupDelayMs, 90);
    return budget;
  }

  return budget;
}
