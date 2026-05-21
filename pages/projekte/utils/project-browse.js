import { PROJECTS_HOME_PATH, normalizeProjectSlug } from "#core/project-paths.js";

export const DEFAULT_BROWSE_STATE = Object.freeze({
  query: "",
  category: "all",
  tag: "",
  stack: "",
  sort: "featured",
  caseStudyOnly: false,
  livePreviewOnly: false,
});

const BROWSE_SORT_VALUES = new Set(["featured", "latest", "alphabetical", "category"]);
const CRAWLER_UA_PATTERN =
  /googlebot|google-inspectiontool|bingbot|slurp|duckduckbot|baiduspider|yandex|facebookexternalhit|twitterbot|linkedinbot|applebot|semrushbot|ahrefsbot/i;

export const shouldDisableThreeScene = () => {
  if (typeof window === "undefined") return false;

  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent || "";
  if (CRAWLER_UA_PATTERN.test(userAgent)) return true;

  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

export const getProjectSlug = (project, index = 0) =>
  normalizeProjectSlug(project?.name || project?.title || `project-${index + 1}`) ||
  `project-${index + 1}`;

export const findProjectIndexBySlug = (projects, slug) =>
  projects.findIndex((project, index) => getProjectSlug(project, index) === slug);

export const toAbsoluteAppUrl = url => {
  if (!url || typeof window === "undefined") return String(url || "");

  try {
    return new URL(String(url), window.location.origin).toString();
  } catch {
    return String(url || "");
  }
};

export const normalizeBrowseToken = value =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeBrowseQuery = value =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

export const normalizeBrowseCategory = value => {
  const token = normalizeBrowseToken(value);
  return token || "all";
};

const normalizeBrowseSort = value => {
  const token = normalizeBrowseToken(value);
  return BROWSE_SORT_VALUES.has(token) ? token : DEFAULT_BROWSE_STATE.sort;
};

export const normalizeBrowseState = (state = {}) => ({
  query: normalizeBrowseQuery(state.query),
  category: normalizeBrowseCategory(state.category) || DEFAULT_BROWSE_STATE.category,
  tag: normalizeBrowseToken(state.tag),
  stack: normalizeBrowseToken(state.stack),
  sort: normalizeBrowseSort(state.sort),
  caseStudyOnly: Boolean(state.caseStudyOnly),
  livePreviewOnly: Boolean(state.livePreviewOnly),
});

export const parseBrowseStateFromLocation = (locationLike = globalThis.location) => {
  let params;
  try {
    params = new URLSearchParams(locationLike?.search || "");
  } catch {
    params = new URLSearchParams();
  }

  return normalizeBrowseState({
    query: params.get("q") || "",
    category: params.get("category") || "",
    tag: params.get("tag") || "",
    stack: params.get("stack") || "",
    sort: params.get("sort") || "",
    caseStudyOnly: params.get("caseStudy") === "1",
    livePreviewOnly: params.get("live") === "1",
  });
};

export const buildBrowseSearch = state => {
  const safeState = normalizeBrowseState(state);
  const params = new URLSearchParams();

  if (safeState.query) params.set("q", safeState.query);
  if (safeState.category !== "all") params.set("category", safeState.category);
  if (safeState.tag) params.set("tag", safeState.tag);
  if (safeState.stack) params.set("stack", safeState.stack);
  if (safeState.sort !== DEFAULT_BROWSE_STATE.sort) {
    params.set("sort", safeState.sort);
  }
  if (safeState.caseStudyOnly) params.set("caseStudy", "1");
  if (safeState.livePreviewOnly) params.set("live", "1");

  const search = params.toString();
  return search ? `?${search}` : "";
};

export const buildProjectsOverviewPath = state =>
  `${PROJECTS_HOME_PATH}${buildBrowseSearch(state)}`;

const normalizeValueList = values =>
  Array.isArray(values) ? values.map(value => String(value || "").trim()).filter(Boolean) : [];

const projectHasToken = (values, token) => {
  if (!token) return true;
  return normalizeValueList(values).some(value => normalizeBrowseToken(value) === token);
};

const matchesProjectQuery = (project, query) => {
  const tokens = normalizeBrowseQuery(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = [
    project?.title,
    project?.description,
    project?.category,
    ...normalizeValueList(project?.tags),
    ...normalizeValueList(project?.techStack),
  ]
    .join(" ")
    .toLowerCase();

  return tokens.every(token => haystack.includes(token));
};

const getFeaturedScore = project => {
  let score = 0;
  if (project?.hasCaseStudy) score += 8;
  if (project?.hasLivePreview) score += 6;
  if (project?.hasSource) score += 4;
  score += Math.min(3, normalizeValueList(project?.techStack).length);
  score += Math.min(2, normalizeValueList(project?.tags).length);
  return score;
};

const getProjectTimestamp = project => {
  const value = Date.parse(String(project?.datePublished || ""));
  return Number.isFinite(value) ? value : 0;
};

const sortProjects = (projects, sortMode) => {
  const items = [...projects];

  switch (sortMode) {
    case "latest":
      return items.sort(
        (a, b) =>
          getProjectTimestamp(b) - getProjectTimestamp(a) ||
          getFeaturedScore(b) - getFeaturedScore(a) ||
          a.title.localeCompare(b.title)
      );
    case "alphabetical":
      return items.sort((a, b) => a.title.localeCompare(b.title));
    case "category":
      return items.sort(
        (a, b) =>
          String(a.category || "").localeCompare(String(b.category || "")) ||
          a.title.localeCompare(b.title)
      );
    default:
      return items.sort(
        (a, b) =>
          getFeaturedScore(b) - getFeaturedScore(a) ||
          getProjectTimestamp(b) - getProjectTimestamp(a) ||
          a.title.localeCompare(b.title)
      );
  }
};

export const filterProjects = (projects, state) => {
  const safeState = normalizeBrowseState(state);

  return sortProjects(
    projects.filter(project => {
      if (
        safeState.category !== "all" &&
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
    safeState.sort
  );
};

export const collectFacetCounts = (projects, field) => {
  const counts = new Map();

  projects.forEach(project => {
    const values =
      field === "category"
        ? [String(project?.category || "").trim()]
        : normalizeValueList(project?.[field]);

    values.forEach(value => {
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

  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};

export const findFacetLabel = (items, token) => {
  const match = (Array.isArray(items) ? items : []).find(item => item.token === token);
  return match?.label || String(token || "").replace(/-/g, " ");
};

export const getScrollMultiplier = projectCount =>
  Math.max(3.6, Math.min(6.2, 2.4 + Math.max(1, projectCount) * 0.16));
