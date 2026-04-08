/**
 * React Projects App - 3D Space Edition
 * @version 8.0.0 - Deep cleanup
 * @description 3D Scroll-based Gallery using Three.js and React
 */

import React, {
  createElement as h,
  Fragment,
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { useProjects } from './hooks/useProjects.js';
import { ThreeScene } from './components/ThreeScene.js';
import * as Icons from '#components/icons/icons.js';
import { LikeButton } from '#components/interactions/index.js';
import { i18n } from '#core/i18n.js';
import {
  PROJECTS_HOME_PATH,
  buildProjectDetailPath,
  extractProjectSlugFromLocation,
  normalizeProjectSlug,
} from '#core/project-paths.js';
import { createErrorBoundary } from '#components/ErrorBoundary.js';

const ErrorBoundary = createErrorBoundary(React);
const DEFAULT_PROJECTS_TITLE = 'Projekte | Abdulkerim Sesli';
const DEFAULT_PROJECTS_DESCRIPTION =
  'Entdecke interaktive Web-Experimente und produktionsnahe Apps mit Fokus auf Performance, UI-Systeme und spielerische Interfaces.';
const DEFAULT_BROWSE_STATE = Object.freeze({
  query: '',
  category: 'all',
  tag: '',
  stack: '',
  sort: 'featured',
  caseStudyOnly: false,
  livePreviewOnly: false,
});
const BROWSE_SORT_VALUES = new Set([
  'featured',
  'latest',
  'alphabetical',
  'category',
]);

const CRAWLER_UA_PATTERN =
  /googlebot|google-inspectiontool|bingbot|slurp|duckduckbot|baiduspider|yandex|facebookexternalhit|twitterbot|linkedinbot|applebot|semrushbot|ahrefsbot/i;

const shouldDisableThreeScene = () => {
  if (typeof window === 'undefined') return false;

  const userAgent =
    typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
  if (CRAWLER_UA_PATTERN.test(userAgent)) return true;

  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const getProjectSlug = (project, index = 0) =>
  normalizeProjectSlug(
    project?.name || project?.title || `project-${index + 1}`,
  ) || `project-${index + 1}`;

const findProjectIndexBySlug = (projects, slug) =>
  projects.findIndex(
    (project, index) => getProjectSlug(project, index) === slug,
  );

const toAbsoluteAppUrl = (url) => {
  if (!url || typeof window === 'undefined') return String(url || '');

  try {
    return new URL(String(url), window.location.origin).toString();
  } catch {
    return String(url || '');
  }
};

const normalizeBrowseToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeBrowseQuery = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

const normalizeBrowseCategory = (value) => {
  const token = normalizeBrowseToken(value);
  return token || 'all';
};

const normalizeBrowseSort = (value) => {
  const token = normalizeBrowseToken(value);
  return BROWSE_SORT_VALUES.has(token) ? token : DEFAULT_BROWSE_STATE.sort;
};

const normalizeBrowseState = (state = {}) => ({
  query: normalizeBrowseQuery(state.query),
  category:
    normalizeBrowseCategory(state.category) || DEFAULT_BROWSE_STATE.category,
  tag: normalizeBrowseToken(state.tag),
  stack: normalizeBrowseToken(state.stack),
  sort: normalizeBrowseSort(state.sort),
  caseStudyOnly: Boolean(state.caseStudyOnly),
  livePreviewOnly: Boolean(state.livePreviewOnly),
});

const parseBrowseStateFromLocation = (locationLike = globalThis.location) => {
  let params;
  try {
    params = new URLSearchParams(locationLike?.search || '');
  } catch {
    params = new URLSearchParams();
  }

  return normalizeBrowseState({
    query: params.get('q') || '',
    category: params.get('category') || '',
    tag: params.get('tag') || '',
    stack: params.get('stack') || '',
    sort: params.get('sort') || '',
    caseStudyOnly: params.get('caseStudy') === '1',
    livePreviewOnly: params.get('live') === '1',
  });
};

const buildBrowseSearch = (state) => {
  const safeState = normalizeBrowseState(state);
  const params = new URLSearchParams();

  if (safeState.query) params.set('q', safeState.query);
  if (safeState.category !== 'all') params.set('category', safeState.category);
  if (safeState.tag) params.set('tag', safeState.tag);
  if (safeState.stack) params.set('stack', safeState.stack);
  if (safeState.sort !== DEFAULT_BROWSE_STATE.sort) {
    params.set('sort', safeState.sort);
  }
  if (safeState.caseStudyOnly) params.set('caseStudy', '1');
  if (safeState.livePreviewOnly) params.set('live', '1');

  const search = params.toString();
  return search ? `?${search}` : '';
};

const buildProjectsOverviewPath = (state) =>
  `${PROJECTS_HOME_PATH}${buildBrowseSearch(state)}`;

const normalizeValueList = (values) =>
  Array.isArray(values)
    ? values.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

const projectHasToken = (values, token) => {
  if (!token) return true;
  return normalizeValueList(values).some(
    (value) => normalizeBrowseToken(value) === token,
  );
};

const matchesProjectQuery = (project, query) => {
  const tokens = normalizeBrowseQuery(query)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = [
    project?.title,
    project?.description,
    project?.category,
    ...normalizeValueList(project?.tags),
    ...normalizeValueList(project?.techStack),
  ]
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
};

const getFeaturedScore = (project) => {
  let score = 0;
  if (project?.hasCaseStudy) score += 8;
  if (project?.hasLivePreview) score += 6;
  if (project?.hasSource) score += 4;
  score += Math.min(3, normalizeValueList(project?.techStack).length);
  score += Math.min(2, normalizeValueList(project?.tags).length);
  return score;
};

const getProjectTimestamp = (project) => {
  const value = Date.parse(String(project?.datePublished || ''));
  return Number.isFinite(value) ? value : 0;
};

const sortProjects = (projects, sortMode) => {
  const items = [...projects];

  switch (sortMode) {
    case 'latest':
      return items.sort(
        (a, b) =>
          getProjectTimestamp(b) - getProjectTimestamp(a) ||
          getFeaturedScore(b) - getFeaturedScore(a) ||
          a.title.localeCompare(b.title),
      );
    case 'alphabetical':
      return items.sort((a, b) => a.title.localeCompare(b.title));
    case 'category':
      return items.sort(
        (a, b) =>
          String(a.category || '').localeCompare(String(b.category || '')) ||
          a.title.localeCompare(b.title),
      );
    default:
      return items.sort(
        (a, b) =>
          getFeaturedScore(b) - getFeaturedScore(a) ||
          getProjectTimestamp(b) - getProjectTimestamp(a) ||
          a.title.localeCompare(b.title),
      );
  }
};

const filterProjects = (projects, state) => {
  const safeState = normalizeBrowseState(state);

  return sortProjects(
    projects.filter((project) => {
      if (
        safeState.category !== 'all' &&
        normalizeBrowseCategory(project?.category) !== safeState.category
      ) {
        return false;
      }

      if (!projectHasToken(project?.tags, safeState.tag)) return false;
      if (!projectHasToken(project?.techStack, safeState.stack)) return false;
      if (safeState.caseStudyOnly && !project?.hasCaseStudy) return false;
      if (safeState.livePreviewOnly && !project?.hasLivePreview) return false;

      return matchesProjectQuery(project, safeState.query);
    }),
    safeState.sort,
  );
};

const collectFacetCounts = (projects, field) => {
  const counts = new Map();

  projects.forEach((project) => {
    const values =
      field === 'category'
        ? [String(project?.category || '').trim()]
        : normalizeValueList(project?.[field]);

    values.forEach((value) => {
      if (!value) return;
      const token = normalizeBrowseToken(value);
      if (!token) return;

      const existing = counts.get(token);
      if (existing) {
        existing.count += 1;
        return;
      }

      counts.set(token, {
        token,
        label: value,
        count: 1,
      });
    });
  });

  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
};

const findFacetLabel = (items, token) => {
  const match = (Array.isArray(items) ? items : []).find(
    (item) => item.token === token,
  );
  return match?.label || String(token || '').replace(/-/g, ' ');
};

const getScrollMultiplier = (projectCount) =>
  Math.max(3.6, Math.min(6.2, 2.4 + Math.max(1, projectCount) * 0.16));

/**
 * Main App Component
 */
const App = () => {
  const { projects, loading, error } = useProjects(Icons);
  const [lang, setLang] = useState(i18n.currentLang);

  // State for the currently focused project index (controlled by scroll in ThreeScene)
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);
  const [browseState, setBrowseState] = useState(() =>
    parseBrowseStateFromLocation(),
  );
  const [preferredProjectSlug, setPreferredProjectSlug] = useState('');
  const [lastBrowseProjectSlug, setLastBrowseProjectSlug] = useState('');
  const [isInitialRouteResolved, setIsInitialRouteResolved] = useState(false);
  const [isDetailRouteActive, setIsDetailRouteActive] = useState(() =>
    Boolean(
      typeof window !== 'undefined' &&
      extractProjectSlugFromLocation(window.location),
    ),
  );
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [isThreeSceneEnabled] = useState(() => !shouldDisableThreeScene());
  const [popupApp, setPopupApp] = useState(null);
  const [popupSize, setPopupSize] = useState(null);
  const [showCaseStudy, setShowCaseStudy] = useState(false);
  const popupFrameRef = useRef(null);
  const popupOverlayRef = useRef(null);
  const deferredQuery = useDeferredValue(browseState.query);

  const t = (key, fallback, params = {}) =>
    i18n.tOrFallback(key, fallback, params);
  const categoryItems = collectFacetCounts(projects, 'category');
  const tagItems = collectFacetCounts(projects, 'tags');
  const stackItems = collectFacetCounts(projects, 'techStack');
  const filteredProjects = filterProjects(projects, {
    ...browseState,
    query: deferredQuery,
  });
  const sceneProjects = isDetailRouteActive ? projects : filteredProjects;
  const activeProject = sceneProjects[activeProjectIndex] || null;
  const activeProjectSlug = activeProject
    ? getProjectSlug(activeProject, activeProjectIndex)
    : '';
  const activeProjectPath = activeProjectSlug
    ? buildProjectDetailPath(activeProjectSlug)
    : PROJECTS_HOME_PATH;
  const activeCategoryLabel =
    browseState.category !== 'all'
      ? findFacetLabel(categoryItems, browseState.category)
      : '';
  const activeTagLabel = browseState.tag
    ? findFacetLabel(tagItems, browseState.tag)
    : '';
  const activeStackLabel = browseState.stack
    ? findFacetLabel(stackItems, browseState.stack)
    : '';
  const totalProjectCount = projects.length;
  const hasActiveBrowseFilters =
    Boolean(browseState.query) ||
    browseState.category !== 'all' ||
    Boolean(browseState.tag) ||
    Boolean(browseState.stack) ||
    browseState.caseStudyOnly ||
    browseState.livePreviewOnly ||
    browseState.sort !== DEFAULT_BROWSE_STATE.sort;
  const catalogStats = {
    total: totalProjectCount,
    live: projects.filter((project) => project?.hasLivePreview).length,
    caseStudies: projects.filter((project) => project?.hasCaseStudy).length,
    source: projects.filter((project) => project?.hasSource).length,
  };
  const topTagItems = tagItems.slice(0, 6);
  const topStackItems = stackItems.slice(0, 6);
  const projectProgressLabel = activeProject
    ? `${Math.min(activeProjectIndex + 1, sceneProjects.length)}/${sceneProjects.length}${
        !isDetailRouteActive && sceneProjects.length < totalProjectCount
          ? ` · ${totalProjectCount}`
          : ''
      }`
    : '';

  useEffect(() => i18n.subscribe(setLang), []);

  useEffect(() => {
    if (isDetailRouteActive) {
      if (activeProjectIndex >= projects.length) {
        setActiveProjectIndex(0);
      }
      return;
    }

    if (filteredProjects.length === 0) {
      if (activeProjectIndex !== 0) {
        setActiveProjectIndex(0);
      }
      if (preferredProjectSlug) {
        setPreferredProjectSlug('');
      }
      return;
    }

    const targetSlug = preferredProjectSlug || lastBrowseProjectSlug;
    if (targetSlug) {
      const targetIndex = findProjectIndexBySlug(filteredProjects, targetSlug);
      if (targetIndex >= 0) {
        if (targetIndex !== activeProjectIndex) {
          setActiveProjectIndex(targetIndex);
        }
        if (preferredProjectSlug) {
          setPreferredProjectSlug('');
        }
        return;
      }
    }

    if (preferredProjectSlug) {
      setPreferredProjectSlug('');
      return;
    }

    if (activeProjectIndex >= filteredProjects.length) {
      setActiveProjectIndex(0);
    }
  }, [
    activeProjectIndex,
    filteredProjects,
    isDetailRouteActive,
    lastBrowseProjectSlug,
    preferredProjectSlug,
    projects.length,
  ]);

  useEffect(() => {
    if (!isDetailRouteActive && activeProjectSlug) {
      setLastBrowseProjectSlug(activeProjectSlug);
    }
  }, [activeProjectSlug, isDetailRouteActive]);

  useEffect(() => {
    if (!projects.length) return;

    const nextBrowseState = parseBrowseStateFromLocation(window.location);
    setBrowseState(nextBrowseState);

    const routeSlug = extractProjectSlugFromLocation(window.location);
    if (!routeSlug) {
      setIsDetailRouteActive(false);
      setIsInitialRouteResolved(true);
      return;
    }

    const appIndex = findProjectIndexBySlug(projects, routeSlug);
    if (appIndex < 0) {
      const nextOverviewPath = buildProjectsOverviewPath(nextBrowseState);
      if (
        `${window.location.pathname}${window.location.search}` !==
        nextOverviewPath
      ) {
        window.history.replaceState(null, '', nextOverviewPath);
      }
      setIsDetailRouteActive(false);
      setIsInitialRouteResolved(true);
      return;
    }

    setIsDetailRouteActive(true);
    setActiveProjectIndex(appIndex);

    const canonicalPath = buildProjectDetailPath(
      getProjectSlug(projects[appIndex]),
    );
    if (
      window.location.pathname !== canonicalPath ||
      String(window.location.search || '').length > 0
    ) {
      window.history.replaceState(null, '', canonicalPath);
    }
    setIsInitialRouteResolved(true);
  }, [projects]);

  useEffect(() => {
    if (!projects.length) return;

    const handlePopState = () => {
      const nextBrowseState = parseBrowseStateFromLocation(window.location);
      setBrowseState(nextBrowseState);

      const routeSlug = extractProjectSlugFromLocation(window.location);
      if (!routeSlug) {
        setIsDetailRouteActive(false);
        setPreferredProjectSlug(lastBrowseProjectSlug || activeProjectSlug);
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        return;
      }

      const appIndex = findProjectIndexBySlug(projects, routeSlug);
      if (appIndex >= 0) {
        setIsDetailRouteActive(true);
        setActiveProjectIndex(appIndex);
        return;
      }

      setIsDetailRouteActive(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeProjectSlug, lastBrowseProjectSlug, projects]);

  useEffect(() => {
    if (!isInitialRouteResolved || isDetailRouteActive) return;

    const nextSearch = buildBrowseSearch(browseState);
    if (
      window.location.pathname !== PROJECTS_HOME_PATH ||
      window.location.search !== nextSearch
    ) {
      window.history.replaceState(
        null,
        '',
        `${PROJECTS_HOME_PATH}${nextSearch}`,
      );
    }
  }, [browseState, isDetailRouteActive, isInitialRouteResolved]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    document.body.style.setProperty(
      '--projects-scroll-multiplier',
      String(
        getScrollMultiplier(
          isDetailRouteActive ? projects.length : filteredProjects.length,
        ),
      ),
    );

    return () => {
      document.body.style.removeProperty('--projects-scroll-multiplier');
    };
  }, [filteredProjects.length, isDetailRouteActive, projects.length]);

  useEffect(() => {
    if (projects.length === 0) {
      setIsSceneReady(false);
      return;
    }

    // Inject SoftwareApplication Schema.org JSON-LD
    const scriptId = 'projects-schema-ldjson';
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      /** @type {any} */ (script).type = 'application/ld+json';
      document.head.appendChild(script);
    }

    const CATEGORY_MAP = {
      game: 'GameApplication',
      utility: 'WebApplication',
      productivity: 'WebApplication',
      ui: 'WebApplication',
      web: 'WebApplication',
    };

    const projectsListId =
      'https://www.abdulkerimsesli.de/projekte/#projects-list';
    const seenSlugs = new Set();
    const projectNodes = [];

    projects.forEach((project, index) => {
      const slug = getProjectSlug(project, index);
      if (seenSlugs.has(slug)) return;
      seenSlugs.add(slug);

      const canonicalUrl = `https://www.abdulkerimsesli.de${buildProjectDetailPath(slug)}`;
      const nodeId = `${canonicalUrl}#app`;
      const name = project.title || project.name || `Projekt ${index + 1}`;
      const appUrl = toAbsoluteAppUrl(project.appPath);

      projectNodes.push({
        '@type': 'SoftwareApplication',
        '@id': nodeId,
        name,
        description: project.description,
        applicationCategory: CATEGORY_MAP[project.category] || 'WebApplication',
        applicationSubCategory: project.category || undefined,
        operatingSystem: 'Any',
        url: canonicalUrl,
        ...(appUrl ? { sameAs: appUrl } : {}),
        ...(project.image ? { image: [project.image] } : {}),
        ...(Array.isArray(project.tags) && project.tags.length
          ? { keywords: project.tags.join(', ') }
          : {}),
        ...(project.version ? { softwareVersion: project.version } : {}),
        author: {
          '@type': 'Person',
          name: 'Abdulkerim Sesli',
          url: 'https://www.abdulkerimsesli.de/',
        },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
        },
        isPartOf: { '@id': projectsListId },
      });
    });

    const listNode = {
      '@type': 'ItemList',
      '@id': projectsListId,
      name: 'Projekte von Abdulkerim Sesli',
      numberOfItems: projectNodes.length,
      itemListElement: projectNodes.map((node, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@id': node['@id'],
          name: node.name,
          url: node.url,
        },
      })),
    };

    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [listNode, ...projectNodes],
    });
  }, [projects]);

  useEffect(() => {
    if (loading || projects.length === 0) return;

    if (!isThreeSceneEnabled) {
      setIsSceneReady(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setIsSceneReady(true);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [loading, projects.length, isThreeSceneEnabled]);

  useEffect(() => {
    if (!popupApp) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('projects-popup-open');
    setPopupSize(null);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPopupApp(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove('projects-popup-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [popupApp]);

  useEffect(() => {
    if (!popupApp) return;

    const onMessage = (event) => {
      const payload = event.data;
      if (!payload || payload.type !== 'card-fit-size') return;

      const frameWindow = popupFrameRef.current?.contentWindow;
      if (frameWindow && event.source !== frameWindow) return;

      const width = Number(payload.width);
      const height = Number(payload.height);
      if (!Number.isFinite(width) || !Number.isFinite(height)) return;

      const clampedWidth = Math.max(320, Math.min(1600, Math.round(width)));
      const clampedHeight = Math.max(240, Math.min(1200, Math.round(height)));
      setPopupSize({ width: clampedWidth, height: clampedHeight });
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [popupApp]);

  // Animate backdrop-filter on popup overlay
  useEffect(() => {
    const el = popupOverlayRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => el.classList.add('is-active'));
    return () => cancelAnimationFrame(raf);
  }, [popupApp]);

  const normalizeAppUrl = (url) => {
    return toAbsoluteAppUrl(url);
  };

  const markPreferredProject = (
    slug = activeProjectSlug || lastBrowseProjectSlug,
  ) => {
    if (slug) {
      setPreferredProjectSlug(slug);
    }
  };

  const updateBrowseFilters = (updater) => {
    markPreferredProject();
    startTransition(() => {
      setBrowseState((currentState) => {
        const nextState =
          typeof updater === 'function'
            ? updater(currentState)
            : { ...currentState, ...updater };
        return normalizeBrowseState(nextState);
      });
    });
  };

  const resetBrowseFilters = () => {
    setPreferredProjectSlug('');
    startTransition(() => {
      setBrowseState(DEFAULT_BROWSE_STATE);
    });
  };

  const openProjectDetail = (project, options = {}) => {
    const slug = getProjectSlug(project);
    const appIndex = findProjectIndexBySlug(projects, slug);
    if (appIndex < 0) return;

    setIsDetailRouteActive(true);
    setActiveProjectIndex(appIndex);

    const nextPath = buildProjectDetailPath(slug);
    const historyMethod = options.replace ? 'replaceState' : 'pushState';
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history[historyMethod](null, '', nextPath);
    }

    if (options.scroll !== false) {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: options.behavior || 'smooth',
      });
    }
  };

  const closeDetailView = () => {
    const nextPath = buildProjectsOverviewPath(browseState);
    markPreferredProject(activeProjectSlug || lastBrowseProjectSlug);
    setIsDetailRouteActive(false);

    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
  };

  const jumpToBrowseCollection = (
    partialState,
    focusProject = activeProject,
  ) => {
    const nextState = normalizeBrowseState({
      ...DEFAULT_BROWSE_STATE,
      sort: browseState.sort,
      ...partialState,
    });

    setBrowseState(nextState);
    setIsDetailRouteActive(false);
    setPreferredProjectSlug(focusProject ? getProjectSlug(focusProject) : '');

    const nextPath = buildProjectsOverviewPath(nextState);
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const popupAppUrl = (url) => {
    const normalized = normalizeAppUrl(url);
    if (!normalized) return normalized;

    try {
      const parsed = new URL(normalized, window.location.origin);
      parsed.searchParams.set('card', '1');
      parsed.searchParams.set('popup', '1');
      return parsed.toString();
    } catch {
      const separator = normalized.includes('?') ? '&' : '?';
      return `${normalized}${separator}card=1&popup=1`;
    }
  };

  const openAppPopup = (event, project) => {
    event.preventDefault();
    const url = popupAppUrl(project?.appPath);
    if (!url) return;

    setPopupApp({
      title: project?.title || t('projects.card.btn_open', 'Open App'),
      url,
    });
  };

  const closeAppPopup = () => setPopupApp(null);

  const requestPopupFit = () => {
    const frameWindow = popupFrameRef.current?.contentWindow;
    if (!frameWindow) return;

    try {
      frameWindow.postMessage({ type: 'card-fit-request' }, '*');
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    if (!popupApp) return;

    const runFitRequest = () => {
      window.requestAnimationFrame(() => {
        requestPopupFit();
      });
    };

    const resizeTimer = window.setTimeout(runFitRequest, 120);
    const lateTimer = window.setTimeout(runFitRequest, 420);

    const onResize = () => runFitRequest();
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      window.clearTimeout(resizeTimer);
      window.clearTimeout(lateTimer);
      window.removeEventListener('resize', onResize);
    };
  }, [popupApp]);

  // Update active project based on scroll
  const handleScrollUpdate = (index) => {
    if (isDetailRouteActive) return;
    setActiveProjectIndex(index);
  };

  useEffect(() => {
    setShowCaseStudy(false);
  }, [activeProjectIndex]);

  useEffect(() => {
    if (!activeProject || !isInitialRouteResolved) return;

    const nextTitle = isDetailRouteActive
      ? `${activeProject.title} — Projekte | Abdulkerim Sesli`
      : activeStackLabel
        ? `${activeStackLabel} Projekte | Abdulkerim Sesli`
        : activeTagLabel
          ? `${activeTagLabel} Projekte | Abdulkerim Sesli`
          : activeCategoryLabel
            ? `${activeCategoryLabel} Projekte | Abdulkerim Sesli`
            : DEFAULT_PROJECTS_TITLE;
    if (document.title !== nextTitle) {
      document.title = nextTitle;
    }

    const descriptionTag = document.querySelector('meta[name="description"]');
    if (descriptionTag instanceof HTMLMetaElement) {
      descriptionTag.content =
        (isDetailRouteActive && activeProject.description) ||
        DEFAULT_PROJECTS_DESCRIPTION;
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink instanceof HTMLLinkElement) {
      canonicalLink.href = `https://www.abdulkerimsesli.de${
        isDetailRouteActive ? activeProjectPath : PROJECTS_HOME_PATH
      }`;
    }

    if (
      isDetailRouteActive &&
      (window.location.pathname !== activeProjectPath ||
        String(window.location.search || '').length > 0)
    ) {
      window.history.replaceState(null, '', activeProjectPath);
    }
  }, [
    activeProject,
    activeCategoryLabel,
    activeProjectPath,
    activeStackLabel,
    activeTagLabel,
    isDetailRouteActive,
    isInitialRouteResolved,
  ]);

  if (loading) {
    return h(
      'div',
      {
        className: 'launch-screen',
        'data-lang': lang,
        'aria-live': 'polite',
      },
      h(
        'div',
        { className: 'launch-card' },
        h(
          'span',
          { className: 'launch-badge' },
          t('projects.launch.badge', '3D Project Gallery'),
        ),
        h(
          'h1',
          { className: 'launch-title' },
          t('projects.launch.title', 'Starting project view'),
        ),
        h(
          'p',
          { className: 'launch-subtitle' },
          t(
            'projects.launch.subtitle',
            'Apps are loaded from the maintained project catalog and prepared for 3D navigation.',
          ),
        ),
        h(
          'div',
          { className: 'launch-status' },
          h('span', { className: 'launch-dot', 'aria-hidden': 'true' }),
          h(
            'span',
            null,
            t(
              'projects.launch.loading',
              'Loading projects and preparing the scene...',
            ),
          ),
        ),
        h(
          'p',
          { className: 'launch-hint' },
          t(
            'projects.launch.hint',
            'After startup you can explore the app list by scrolling.',
          ),
        ),
      ),
    );
  }

  if (error) {
    return h(
      'div',
      {
        className: 'launch-screen launch-screen--error',
        'data-lang': lang,
        'aria-live': 'assertive',
      },
      h(
        'div',
        { className: 'launch-card' },
        h(
          'h2',
          { className: 'launch-title' },
          t(
            'projects.launch.error_title',
            'Projects could not be loaded at startup',
          ),
        ),
        h('p', { className: 'launch-error-copy' }, error),
        h(
          'button',
          {
            type: 'button',
            className: 'btn btn-primary launch-retry',
            onClick: () => window.location.reload(),
          },
          t('projects.launch.retry', 'Reload page'),
        ),
      ),
    );
  }

  if (projects.length === 0) {
    return h(
      'div',
      {
        className: 'launch-screen launch-screen--error',
        'data-lang': lang,
        'aria-live': 'polite',
      },
      h(
        'div',
        { className: 'launch-card' },
        h(
          'h2',
          { className: 'launch-title' },
          t('error.no_content', 'No projects available'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'btn btn-primary launch-retry',
            onClick: () => window.location.reload(),
          },
          t('projects.launch.retry', 'Reload page'),
        ),
      ),
    );
  }

  const relatedMatchLabel = (project) => {
    if (!project?.matchType) {
      return project?.category || t('projects.discovery.category_all', 'All');
    }

    if (project.matchType === 'stack') {
      return t(
        'projects.discovery.match_stack',
        'Gemeinsamer Stack: {{value}}',
        {
          value: project.matchLabel,
        },
      );
    }

    if (project.matchType === 'tag') {
      return t('projects.discovery.match_tag', 'Gemeinsames Tag: {{value}}', {
        value: project.matchLabel,
      });
    }

    return t('projects.discovery.match_category', 'Gleiche Kategorie');
  };

  const activeBrowseChips = [
    browseState.category !== 'all' && {
      key: 'category',
      label: activeCategoryLabel,
      onClear: () => updateBrowseFilters({ category: 'all' }),
    },
    browseState.tag && {
      key: 'tag',
      label: activeTagLabel,
      onClear: () => updateBrowseFilters({ tag: '' }),
    },
    browseState.stack && {
      key: 'stack',
      label: activeStackLabel,
      onClear: () => updateBrowseFilters({ stack: '' }),
    },
    browseState.caseStudyOnly && {
      key: 'case-study',
      label: t('projects.discovery.case_studies_only', 'Nur Case Studies'),
      onClear: () => updateBrowseFilters({ caseStudyOnly: false }),
    },
    browseState.livePreviewOnly && {
      key: 'live',
      label: t('projects.discovery.live_only', 'Nur Live-Demos'),
      onClear: () => updateBrowseFilters({ livePreviewOnly: false }),
    },
  ].filter(Boolean);

  const discoveryStats = [
    {
      key: 'total',
      label: t('projects.discovery.stats_total', 'Apps'),
      value: catalogStats.total,
    },
    {
      key: 'live',
      label: t('projects.discovery.stats_live', 'Live-Demos'),
      value: catalogStats.live,
    },
    {
      key: 'caseStudies',
      label: t('projects.discovery.stats_case', 'Case Studies'),
      value: catalogStats.caseStudies,
    },
    {
      key: 'source',
      label: t('projects.discovery.stats_source', 'Code-Links'),
      value: catalogStats.source,
    },
  ];

  const popupPanelStyle = popupSize
    ? {
        width: `min(calc(100vw - 1rem), ${Math.max(420, popupSize.width + 36)}px)`,
        height: `min(calc(100vh - 1rem), ${Math.max(380, popupSize.height + 86)}px)`,
      }
    : null;

  return h(
    Fragment,
    null,
    // 3D Canvas Container
    h(
      'div',
      { id: 'canvas-container' },
      isThreeSceneEnabled &&
        sceneProjects.length > 0 &&
        h(ThreeScene, {
          projects: sceneProjects,
          onScrollUpdate: handleScrollUpdate,
          onReady: () => setIsSceneReady(true),
        }),
    ),

    !isSceneReady &&
      h(
        'div',
        { className: 'launch-overlay', 'aria-live': 'polite' },
        h(
          'div',
          { className: 'launch-overlay-card' },
          h('span', { className: 'launch-dot', 'aria-hidden': 'true' }, ' '),
          h(
            'span',
            null,
            t('projects.launch.scene', 'Initializing 3D scene...'),
          ),
        ),
      ),

    popupApp &&
      typeof document !== 'undefined' &&
      document.body &&
      createPortal(
        h(
          'div',
          {
            className: 'app-popup',
            ref: popupOverlayRef,
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('projects.app.popup_title', 'App popup'),
            onClick: (event) => {
              if (event.target === event.currentTarget) {
                closeAppPopup();
              }
            },
          },
          h(
            'div',
            { className: 'app-popup__panel', style: popupPanelStyle },
            h(
              'div',
              { className: 'app-popup__header' },
              h(
                'div',
                { className: 'app-popup__title-wrap' },
                h(
                  'span',
                  { className: 'app-popup__label' },
                  t('projects.launch.source', 'Curated app catalog'),
                ),
                h('strong', { className: 'app-popup__title' }, popupApp.title),
              ),
              h(
                'div',
                { className: 'app-popup__actions' },
                h(
                  'a',
                  {
                    href: popupApp.url,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className: 'btn btn-outline app-popup__action',
                  },
                  t('projects.app.open_tab', 'Open in new tab'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'btn btn-primary app-popup__action',
                    onClick: closeAppPopup,
                  },
                  t('projects.app.close', 'Close'),
                ),
              ),
            ),
            h(
              'div',
              { className: 'app-popup__frame-wrap' },
              h('iframe', {
                className: 'app-popup__frame',
                ref: popupFrameRef,
                src: popupApp.url,
                title: popupApp.title,
                loading: 'eager',
                allow: 'clipboard-read; clipboard-write; fullscreen',
                referrerPolicy: 'no-referrer-when-downgrade',
                onLoad: () => requestPopupFit(),
              }),
            ),
          ),
        ),
        document.body,
      ),

    !isDetailRouteActive &&
      h(
        'section',
        {
          className: 'projects-discovery-wrap',
          'aria-label': t(
            'projects.discovery.title',
            'Projekte filtern und vergleichen',
          ),
        },
        h(
          'div',
          { className: 'projects-discovery-card' },
          h(
            'div',
            { className: 'projects-discovery__intro' },
            h(
              'span',
              { className: 'projects-discovery__eyebrow' },
              t('projects.discovery.eyebrow', 'Produkt-Katalog'),
            ),
            h(
              'div',
              { className: 'projects-discovery__headline' },
              h(
                'h2',
                { className: 'projects-discovery__title' },
                t(
                  'projects.discovery.title',
                  'Projekte filtern und vergleichen',
                ),
              ),
              h(
                'p',
                { className: 'projects-discovery__subtitle' },
                hasActiveBrowseFilters
                  ? t(
                      'projects.discovery.showing',
                      '{{visible}} von {{total}} Apps sichtbar',
                      {
                        visible: filteredProjects.length,
                        total: totalProjectCount,
                      },
                    )
                  : t(
                      'projects.discovery.subtitle',
                      'Suche nach Use Cases, Tags und Stack-Signalen, sortiere den Katalog und springe direkt in passende App-Sammlungen.',
                    ),
              ),
            ),
            h(
              'div',
              { className: 'projects-discovery__stats' },
              discoveryStats.map((item) =>
                h(
                  'div',
                  {
                    key: item.key,
                    className: 'projects-discovery__stat-card',
                  },
                  h(
                    'strong',
                    { className: 'projects-discovery__stat-value' },
                    item.value,
                  ),
                  h(
                    'span',
                    { className: 'projects-discovery__stat-label' },
                    item.label,
                  ),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'projects-discovery__controls' },
            h(
              'label',
              {
                className:
                  'projects-discovery__field projects-discovery__field--search',
              },
              h(
                'span',
                { className: 'projects-discovery__field-label' },
                t('projects.discovery.search_label', 'Projekte durchsuchen'),
              ),
              h('input', {
                type: 'search',
                className: 'projects-discovery__input',
                value: browseState.query,
                placeholder: t(
                  'projects.discovery.search_placeholder',
                  'Nach Projektname, Tag oder Stack suchen...',
                ),
                onInput: (event) =>
                  updateBrowseFilters({
                    query: event.currentTarget.value,
                  }),
              }),
            ),
            h(
              'label',
              {
                className:
                  'projects-discovery__field projects-discovery__field--sort',
              },
              h(
                'span',
                { className: 'projects-discovery__field-label' },
                t('projects.discovery.sort_label', 'Sortierung'),
              ),
              h(
                'select',
                {
                  className: 'projects-discovery__select',
                  value: browseState.sort,
                  onChange: (event) =>
                    updateBrowseFilters({
                      sort: event.currentTarget.value,
                    }),
                },
                h(
                  'option',
                  { value: 'featured' },
                  t('projects.discovery.sort_featured', 'Empfohlen'),
                ),
                h(
                  'option',
                  { value: 'latest' },
                  t('projects.discovery.sort_latest', 'Neueste zuerst'),
                ),
                h(
                  'option',
                  { value: 'alphabetical' },
                  t('projects.discovery.sort_alpha', 'A bis Z'),
                ),
                h(
                  'option',
                  { value: 'category' },
                  t('projects.discovery.sort_category', 'Nach Kategorie'),
                ),
              ),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'btn btn-outline projects-discovery__clear',
                onClick: resetBrowseFilters,
                disabled: !hasActiveBrowseFilters,
              },
              t('projects.discovery.clear', 'Filter zurücksetzen'),
            ),
          ),
          h(
            'div',
            { className: 'projects-discovery__toolbar' },
            h(
              'div',
              { className: 'projects-discovery__toggle-row' },
              h(
                'button',
                {
                  type: 'button',
                  className: `projects-discovery__chip ${
                    browseState.caseStudyOnly
                      ? 'projects-discovery__chip--active'
                      : ''
                  }`,
                  'aria-pressed': browseState.caseStudyOnly,
                  onClick: () =>
                    updateBrowseFilters((currentState) => ({
                      ...currentState,
                      caseStudyOnly: !currentState.caseStudyOnly,
                    })),
                },
                t('projects.discovery.case_studies_only', 'Nur Case Studies'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: `projects-discovery__chip ${
                    browseState.livePreviewOnly
                      ? 'projects-discovery__chip--active'
                      : ''
                  }`,
                  'aria-pressed': browseState.livePreviewOnly,
                  onClick: () =>
                    updateBrowseFilters((currentState) => ({
                      ...currentState,
                      livePreviewOnly: !currentState.livePreviewOnly,
                    })),
                },
                t('projects.discovery.live_only', 'Nur Live-Demos'),
              ),
            ),
            h(
              'div',
              { className: 'projects-discovery__facet-group' },
              h(
                'span',
                { className: 'projects-discovery__facet-label' },
                t('projects.discovery.category_all', 'Alle Kategorien'),
              ),
              h(
                'div',
                { className: 'projects-discovery__chip-list' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: `projects-discovery__chip ${
                      browseState.category === 'all'
                        ? 'projects-discovery__chip--active'
                        : ''
                    }`,
                    'aria-pressed': browseState.category === 'all',
                    onClick: () => updateBrowseFilters({ category: 'all' }),
                  },
                  t('projects.discovery.category_all', 'Alle Kategorien'),
                ),
                categoryItems.map((item) =>
                  h(
                    'button',
                    {
                      key: item.token,
                      type: 'button',
                      className: `projects-discovery__chip ${
                        browseState.category === item.token
                          ? 'projects-discovery__chip--active'
                          : ''
                      }`,
                      'aria-pressed': browseState.category === item.token,
                      onClick: () =>
                        updateBrowseFilters((currentState) => ({
                          ...currentState,
                          category:
                            currentState.category === item.token
                              ? 'all'
                              : item.token,
                        })),
                    },
                    `${item.label} · ${item.count}`,
                  ),
                ),
              ),
            ),
            activeBrowseChips.length > 0 &&
              h(
                'div',
                { className: 'projects-discovery__facet-group' },
                h(
                  'span',
                  { className: 'projects-discovery__facet-label' },
                  t('projects.discovery.active_filters', 'Aktive Filter'),
                ),
                h(
                  'div',
                  { className: 'projects-discovery__chip-list' },
                  activeBrowseChips.map((item) =>
                    h(
                      'button',
                      {
                        key: item.key,
                        type: 'button',
                        className:
                          'projects-discovery__chip projects-discovery__chip--active',
                        onClick: item.onClear,
                      },
                      `${item.label} ×`,
                    ),
                  ),
                ),
              ),
            topTagItems.length > 0 &&
              h(
                'div',
                { className: 'projects-discovery__facet-group' },
                h(
                  'span',
                  { className: 'projects-discovery__facet-label' },
                  t('projects.discovery.tags_label', 'Beliebte Tags'),
                ),
                h(
                  'div',
                  { className: 'projects-discovery__chip-list' },
                  topTagItems.map((item) =>
                    h(
                      'button',
                      {
                        key: item.token,
                        type: 'button',
                        className: `projects-discovery__chip ${
                          browseState.tag === item.token
                            ? 'projects-discovery__chip--active'
                            : ''
                        }`,
                        'aria-pressed': browseState.tag === item.token,
                        onClick: () =>
                          updateBrowseFilters((currentState) => ({
                            ...currentState,
                            tag:
                              currentState.tag === item.token ? '' : item.token,
                          })),
                      },
                      `${item.label} · ${item.count}`,
                    ),
                  ),
                ),
              ),
            topStackItems.length > 0 &&
              h(
                'div',
                { className: 'projects-discovery__facet-group' },
                h(
                  'span',
                  { className: 'projects-discovery__facet-label' },
                  t('projects.discovery.stack_label', 'Stack-Fokus'),
                ),
                h(
                  'div',
                  { className: 'projects-discovery__chip-list' },
                  topStackItems.map((item) =>
                    h(
                      'button',
                      {
                        key: item.token,
                        type: 'button',
                        className: `projects-discovery__chip ${
                          browseState.stack === item.token
                            ? 'projects-discovery__chip--active'
                            : ''
                        }`,
                        'aria-pressed': browseState.stack === item.token,
                        onClick: () =>
                          updateBrowseFilters((currentState) => ({
                            ...currentState,
                            stack:
                              currentState.stack === item.token
                                ? ''
                                : item.token,
                          })),
                      },
                      `${item.label} · ${item.count}`,
                    ),
                  ),
                ),
              ),
          ),
        ),
      ),

    // HUD Overlay
    h(
      'div',
      {
        className: `hud-container ${isSceneReady ? 'is-ready' : 'is-pending'}`,
      },

      !isDetailRouteActive &&
        filteredProjects.length === 0 &&
        h(
          'div',
          {
            className: `hud-panel hud-panel--empty ${isSceneReady ? 'visible' : ''}`,
          },
          h(
            'span',
            { className: 'hud-meta-pill' },
            t('projects.discovery.results_count', '{{count}} Ergebnisse', {
              count: 0,
            }),
          ),
          h(
            'h2',
            { className: 'hud-title hud-title--empty' },
            t(
              'projects.discovery.empty_title',
              'Keine Projekte passen zu dieser Auswahl',
            ),
          ),
          h(
            'p',
            { className: 'hud-desc hud-desc--empty' },
            t(
              'projects.discovery.empty_text',
              'Passe Suche oder Filter an, um wieder Ergebnisse zu sehen.',
            ),
          ),
          h(
            'div',
            { className: 'hud-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'btn btn-primary',
                onClick: resetBrowseFilters,
              },
              t('projects.discovery.clear', 'Filter zurücksetzen'),
            ),
          ),
        ),

      // Active Project Info Panel
      activeProject &&
        h(
          'div',
          {
            className: `hud-panel ${isSceneReady ? 'visible' : ''}`,
            key: activeProject.id,
          },
          h(
            'div',
            { className: 'hud-meta-row' },
            h(
              'span',
              { className: 'hud-meta-pill' },
              t('projects.launch.source', 'Curated app catalog'),
            ),
            h('span', { className: 'hud-meta-count' }, projectProgressLabel),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'hud-category hud-category--button',
              onClick: () =>
                jumpToBrowseCollection({
                  category: normalizeBrowseCategory(activeProject.category),
                }),
            },
            activeProject.category || 'Project',
          ),
          h('h1', { className: 'hud-title' }, activeProject.title),
          h('p', { className: 'hud-desc' }, activeProject.description),

          activeProject.previewUrl &&
            h(
              'figure',
              { className: 'hud-preview-card' },
              h('img', {
                className: 'hud-preview-image',
                src: activeProject.previewUrl,
                alt:
                  activeProject.previewAlt || `${activeProject.title} Vorschau`,
                loading: 'eager',
                decoding: 'async',
              }),
            ),

          h(
            'div',
            { className: 'hud-detail-grid' },
            h(
              'div',
              { className: 'hud-detail-card' },
              h('span', { className: 'hud-detail-label' }, 'Version'),
              h(
                'strong',
                { className: 'hud-detail-value' },
                activeProject.version || '1.0.0',
              ),
            ),
            h(
              'div',
              { className: 'hud-detail-card' },
              h('span', { className: 'hud-detail-label' }, 'Update'),
              h(
                'strong',
                { className: 'hud-detail-value' },
                activeProject.datePublished || 'Aktuell',
              ),
            ),
            h(
              'div',
              { className: 'hud-detail-card' },
              h('span', { className: 'hud-detail-label' }, 'Preview'),
              h(
                'strong',
                { className: 'hud-detail-value' },
                activeProject.appPath ? 'Live Demo' : 'Katalog',
              ),
            ),
            h(
              'div',
              { className: 'hud-detail-card' },
              h('span', { className: 'hud-detail-label' }, 'Code'),
              h(
                'strong',
                { className: 'hud-detail-value' },
                activeProject.githubPath ? 'GitHub' : 'Privat',
              ),
            ),
          ),

          // Dynamic Edge Likes/Claps
          h(LikeButton, {
            id: getProjectSlug(activeProject, activeProjectIndex),
            type: 'project',
          }),

          Array.isArray(activeProject.techStack) &&
            activeProject.techStack.length > 0 &&
            h(
              'section',
              { className: 'hud-info-section' },
              h('span', { className: 'hud-section-label' }, 'Tech Stack'),
              h(
                'div',
                { className: 'hud-pill-list' },
                activeProject.techStack.map((entry) =>
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'hud-pill hud-pill--button',
                      key: `stack-${entry}`,
                      onClick: () =>
                        jumpToBrowseCollection({
                          stack: normalizeBrowseToken(entry),
                        }),
                    },
                    entry,
                  ),
                ),
              ),
            ),

          Array.isArray(activeProject.tags) &&
            activeProject.tags.length > 0 &&
            h(
              'section',
              { className: 'hud-info-section' },
              h('span', { className: 'hud-section-label' }, 'Tags'),
              h(
                'div',
                { className: 'hud-pill-list hud-pill-list--muted' },
                activeProject.tags.slice(0, 8).map((tag) =>
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'hud-pill hud-pill--muted hud-pill--button',
                      key: tag,
                      onClick: () =>
                        jumpToBrowseCollection({
                          tag: normalizeBrowseToken(tag),
                        }),
                    },
                    tag,
                  ),
                ),
              ),
            ),

          // Case Study expandable section
          activeProject.caseStudy &&
            h(
              'div',
              { className: 'hud-case-study' },
              h(
                'button',
                {
                  type: 'button',
                  className: `btn btn-outline hud-case-study-toggle hud-case-study-toggle--compact ${showCaseStudy ? 'is-open' : ''}`,
                  onClick: () => setShowCaseStudy((v) => !v),
                },
                showCaseStudy ? '✕ Case Study schließen' : '📋 Case Study',
              ),
              showCaseStudy &&
                h(
                  'div',
                  { className: 'hud-case-study-content' },
                  h(
                    'div',
                    { className: 'hud-cs-block' },
                    h('strong', null, '⚡ Problem'),
                    h('p', null, activeProject.caseStudy.problem),
                  ),
                  h(
                    'div',
                    { className: 'hud-cs-block' },
                    h('strong', null, '💡 Lösung'),
                    h('p', null, activeProject.caseStudy.solution),
                  ),
                  h(
                    'div',
                    { className: 'hud-cs-block' },
                    h('strong', null, '🛠 Tech Stack'),
                    h('p', null, activeProject.caseStudy.techStack.join(' · ')),
                  ),
                  h(
                    'div',
                    { className: 'hud-cs-block' },
                    h('strong', null, '📊 Ergebnis'),
                    h('p', null, activeProject.caseStudy.results),
                  ),
                ),
            ),

          Array.isArray(activeProject.relatedProjects) &&
            activeProject.relatedProjects.length > 0 &&
            h(
              'section',
              { className: 'hud-info-section hud-related' },
              h('span', { className: 'hud-section-label' }, 'Related Apps'),
              h(
                'div',
                { className: 'hud-related-list' },
                activeProject.relatedProjects.map((project) =>
                  h(
                    'a',
                    {
                      key: project.name,
                      href: buildProjectDetailPath(project.name),
                      className: 'hud-related-link',
                      onClick: (event) => {
                        event.preventDefault();
                        openProjectDetail(project);
                      },
                    },
                    h(
                      'span',
                      { className: 'hud-related-label' },
                      project.title,
                    ),
                    h(
                      'span',
                      { className: 'hud-related-meta' },
                      relatedMatchLabel(project),
                    ),
                  ),
                ),
              ),
            ),

          h(
            'div',
            { className: 'hud-actions' },
            isDetailRouteActive &&
              h(
                'button',
                {
                  type: 'button',
                  className: 'btn btn-outline',
                  onClick: closeDetailView,
                },
                t('projects.discovery.back_to_collection', 'Zur Sammlung'),
              ),
            !isDetailRouteActive &&
              h(
                'button',
                {
                  type: 'button',
                  className: 'btn btn-outline',
                  onClick: () => openProjectDetail(activeProject),
                },
                t('projects.discovery.open_detail', 'Produktprofil öffnen'),
              ),
            activeProject.appPath &&
              h(
                'a',
                {
                  href: normalizeAppUrl(activeProject.appPath),
                  onClick: (event) => openAppPopup(event, activeProject),
                  className: 'btn btn-primary',
                },
                'Preview öffnen',
              ),

            activeProject.githubPath &&
              h(
                'a',
                {
                  href: activeProject.githubPath,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  className: 'btn btn-outline',
                },
                'GitHub ansehen',
              ),
          ),
        ),

      // Scroll Indicator
      isThreeSceneEnabled &&
        h(
          'div',
          { className: 'scroll-hint' },
          t('projects.launch.scroll_hint', 'SCROLL TO EXPLORE'),
        ),
    ),
  );
};

export const initReactProjectsApp = () => {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;

  try {
    const root = createRoot(rootEl);
    root.render(h(ErrorBoundary, null, h(App)));
  } catch {
    // Failed to initialize React app - show error in UI
    if (rootEl) {
      rootEl.innerHTML =
        '<div class="launch-screen launch-screen--error"><div class="launch-card"><h2>App konnte nicht geladen werden</h2></div></div>';
    }
  }
};
