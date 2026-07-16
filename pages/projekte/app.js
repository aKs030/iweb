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
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { useProjects } from "./hooks/useProjects.js";
import { useProjectCatalog } from "./hooks/useProjectCatalog.js";
import { useProjectPopup } from "./hooks/useProjectPopup.js";
import { useProjectSeo } from "./hooks/useProjectSeo.js";
import { ThreeScene } from "./components/ThreeScene.js";
import { ProjectAppPopup } from "./components/ProjectAppPopup.js";
import { ProjectLaunchState } from "./components/ProjectLaunchState.js";
import {
  DEFAULT_BROWSE_STATE,
  buildBrowseSearch,
  buildProjectsOverviewPath,
  findProjectIndexBySlug,
  getProjectSlug,
  getScrollMultiplier,
  normalizeBrowseCategory,
  normalizeBrowseState,
  normalizeBrowseToken,
  parseBrowseStateFromLocation,
  shouldDisableThreeScene,
  toAbsoluteAppUrl,
} from "./utils/project-browse.js";
import * as Icons from "#components/icons/index.js";
import { LikeButton } from "#components/interactions/index.js";
import { i18n } from "#core/i18n.js";
import {
  PROJECTS_HOME_PATH,
  buildProjectDetailPath,
  extractProjectSlugFromLocation,
} from "#core/project-paths.js";
import { createErrorBoundary } from "#components/error-boundary/index.js";

const ErrorBoundary = createErrorBoundary(React);

function ProjectFacetGroup({ label, items, activeToken, onSelect, children }) {
  if (!children && items.length === 0) return null;

  return h(
    "div",
    { className: "projects-discovery__facet-group" },
    h("span", { className: "projects-discovery__facet-label" }, label),
    h(
      "div",
      { className: "projects-discovery__chip-list" },
      children,
      items.map(item =>
        h(
          "button",
          {
            key: item.token,
            type: "button",
            className: `projects-discovery__chip ${
              activeToken === item.token ? "projects-discovery__chip--active" : ""
            }`,
            "aria-pressed": activeToken === item.token,
            onClick: () => onSelect(item.token),
          },
          `${item.label} · ${item.count}`
        )
      )
    )
  );
}

const ProjectDetailCard = ({ label, value }) =>
  h(
    "div",
    { className: "hud-detail-card" },
    h("span", { className: "hud-detail-label" }, label),
    h("strong", { className: "hud-detail-value" }, value)
  );

/**
 * Main App Component
 */
const App = () => {
  const { projects, loading, error } = useProjects(Icons);
  const [lang, setLang] = useState(i18n.currentLang);

  // State for the currently focused project index (controlled by scroll in ThreeScene)
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);
  const [browseState, setBrowseState] = useState(() => parseBrowseStateFromLocation());
  const [preferredProjectSlug, setPreferredProjectSlug] = useState("");
  const [lastBrowseProjectSlug, setLastBrowseProjectSlug] = useState("");
  const [isInitialRouteResolved, setIsInitialRouteResolved] = useState(false);
  const [isDetailRouteActive, setIsDetailRouteActive] = useState(() =>
    Boolean(typeof window !== "undefined" && extractProjectSlugFromLocation(window.location))
  );
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [isThreeSceneEnabled] = useState(() => !shouldDisableThreeScene());
  const [showCaseStudy, setShowCaseStudy] = useState(false);
  const deferredQuery = useDeferredValue(browseState.query);

  const t = (key, fallback, params = {}) => i18n.tOrFallback(key, fallback, params);
  const {
    categoryItems,
    filteredProjects,
    catalogStats,
    topTagItems,
    topStackItems,
    activeCategoryLabel,
    activeTagLabel,
    activeStackLabel,
  } = useProjectCatalog(projects, browseState, deferredQuery);
  const {
    popupApp,
    popupFrameRef,
    popupOverlayRef,
    popupPanelStyle,
    closeAppPopup,
    openAppPopup,
    requestPopupFit,
  } = useProjectPopup(t("projects.card.btn_open", "Open App"));
  const sceneProjects = isDetailRouteActive ? projects : filteredProjects;
  const activeProject = sceneProjects[activeProjectIndex] || null;
  const activeProjectSlug = activeProject ? getProjectSlug(activeProject, activeProjectIndex) : "";
  const activeProjectPath = activeProjectSlug
    ? buildProjectDetailPath(activeProjectSlug)
    : PROJECTS_HOME_PATH;
  const totalProjectCount = projects.length;
  const hasActiveBrowseFilters =
    Boolean(browseState.query) ||
    browseState.category !== "all" ||
    Boolean(browseState.tag) ||
    Boolean(browseState.stack) ||
    browseState.caseStudyOnly ||
    browseState.livePreviewOnly ||
    browseState.sort !== DEFAULT_BROWSE_STATE.sort;
  const projectProgressLabel = activeProject
    ? `${Math.min(activeProjectIndex + 1, sceneProjects.length)}/${sceneProjects.length}${
        !isDetailRouteActive && sceneProjects.length < totalProjectCount
          ? ` · ${totalProjectCount}`
          : ""
      }`
    : "";

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
        setPreferredProjectSlug("");
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
          setPreferredProjectSlug("");
        }
        return;
      }
    }

    if (preferredProjectSlug) {
      setPreferredProjectSlug("");
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
      if (`${window.location.pathname}${window.location.search}` !== nextOverviewPath) {
        window.history.replaceState(null, "", nextOverviewPath);
      }
      setIsDetailRouteActive(false);
      setIsInitialRouteResolved(true);
      return;
    }

    setIsDetailRouteActive(true);
    setActiveProjectIndex(appIndex);

    const canonicalPath = buildProjectDetailPath(getProjectSlug(projects[appIndex]));
    if (
      window.location.pathname !== canonicalPath ||
      String(window.location.search || "").length > 0
    ) {
      window.history.replaceState(null, "", canonicalPath);
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
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeProjectSlug, lastBrowseProjectSlug, projects]);

  useEffect(() => {
    if (!isInitialRouteResolved || isDetailRouteActive) return;

    const nextSearch = buildBrowseSearch(browseState);
    if (window.location.pathname !== PROJECTS_HOME_PATH || window.location.search !== nextSearch) {
      window.history.replaceState(null, "", `${PROJECTS_HOME_PATH}${nextSearch}`);
    }
  }, [browseState, isDetailRouteActive, isInitialRouteResolved]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const projectCount = isDetailRouteActive ? projects.length : filteredProjects.length;
    const compactQuery = window.matchMedia("(max-width: 768px)");
    const applyScrollMultiplier = () => {
      document.body.style.setProperty(
        "--projects-scroll-multiplier",
        String(getScrollMultiplier(projectCount, { compact: compactQuery.matches }))
      );
    };

    applyScrollMultiplier();
    compactQuery.addEventListener("change", applyScrollMultiplier);

    return () => {
      compactQuery.removeEventListener("change", applyScrollMultiplier);
      document.body.style.removeProperty("--projects-scroll-multiplier");
    };
  }, [filteredProjects.length, isDetailRouteActive, projects.length]);

  useProjectSeo({
    projects,
    activeProject,
    activeProjectPath,
    activeCategoryLabel,
    activeTagLabel,
    activeStackLabel,
    isDetailRouteActive,
    isInitialRouteResolved,
    setSceneReady: setIsSceneReady,
  });

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

  const markPreferredProject = (slug = activeProjectSlug || lastBrowseProjectSlug) => {
    if (slug) {
      setPreferredProjectSlug(slug);
    }
  };

  const updateBrowseFilters = updater => {
    markPreferredProject();
    startTransition(() => {
      setBrowseState(currentState => {
        const nextState =
          typeof updater === "function" ? updater(currentState) : { ...currentState, ...updater };
        return normalizeBrowseState(nextState);
      });
    });
  };

  const toggleBrowseFacet = (facet, token, emptyValue = "") => {
    updateBrowseFilters(currentState => ({
      ...currentState,
      [facet]: currentState[facet] === token ? emptyValue : token,
    }));
  };

  const resetBrowseFilters = () => {
    setPreferredProjectSlug("");
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
    const historyMethod = options.replace ? "replaceState" : "pushState";
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history[historyMethod](null, "", nextPath);
    }

    if (options.scroll !== false) {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: options.behavior || "smooth",
      });
    }
  };

  const closeDetailView = () => {
    const nextPath = buildProjectsOverviewPath(browseState);
    markPreferredProject(activeProjectSlug || lastBrowseProjectSlug);
    setIsDetailRouteActive(false);

    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  };

  const jumpToBrowseCollection = (partialState, focusProject = activeProject) => {
    const nextState = normalizeBrowseState({
      ...DEFAULT_BROWSE_STATE,
      sort: browseState.sort,
      ...partialState,
    });

    setBrowseState(nextState);
    setIsDetailRouteActive(false);
    setPreferredProjectSlug(focusProject ? getProjectSlug(focusProject) : "");

    const nextPath = buildProjectsOverviewPath(nextState);
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  // Update active project based on scroll
  const handleScrollUpdate = index => {
    if (isDetailRouteActive) return;
    setActiveProjectIndex(index);
  };

  useEffect(() => {
    setShowCaseStudy(false);
  }, [activeProjectIndex]);

  if (loading) {
    return h(ProjectLaunchState, { state: "loading", lang, t });
  }

  if (error) {
    return h(ProjectLaunchState, { state: "error", lang, error, t });
  }

  if (projects.length === 0) {
    return h(ProjectLaunchState, { state: "empty", lang, t });
  }

  const relatedMatchLabel = project => {
    if (!project?.matchType) {
      return project?.category || t("projects.discovery.category_all", "All");
    }

    if (project.matchType === "stack") {
      return t("projects.discovery.match_stack", "Gemeinsamer Stack: {{value}}", {
        value: project.matchLabel,
      });
    }

    if (project.matchType === "tag") {
      return t("projects.discovery.match_tag", "Gemeinsames Tag: {{value}}", {
        value: project.matchLabel,
      });
    }

    return t("projects.discovery.match_category", "Gleiche Kategorie");
  };

  const activeBrowseChips = [
    browseState.category !== "all" && {
      key: "category",
      label: activeCategoryLabel,
      onClear: () => updateBrowseFilters({ category: "all" }),
    },
    browseState.tag && {
      key: "tag",
      label: activeTagLabel,
      onClear: () => updateBrowseFilters({ tag: "" }),
    },
    browseState.stack && {
      key: "stack",
      label: activeStackLabel,
      onClear: () => updateBrowseFilters({ stack: "" }),
    },
    browseState.caseStudyOnly && {
      key: "case-study",
      label: t("projects.discovery.case_studies_only", "Nur Case Studies"),
      onClear: () => updateBrowseFilters({ caseStudyOnly: false }),
    },
    browseState.livePreviewOnly && {
      key: "live",
      label: t("projects.discovery.live_only", "Nur Live-Demos"),
      onClear: () => updateBrowseFilters({ livePreviewOnly: false }),
    },
  ].filter(Boolean);

  const discoveryStats = [
    {
      key: "total",
      label: t("projects.discovery.stats_total", "Apps"),
      value: catalogStats.total,
    },
    {
      key: "live",
      label: t("projects.discovery.stats_live", "Live-Demos"),
      value: catalogStats.live,
    },
    {
      key: "caseStudies",
      label: t("projects.discovery.stats_case", "Case Studies"),
      value: catalogStats.caseStudies,
    },
    {
      key: "source",
      label: t("projects.discovery.stats_source", "Code-Links"),
      value: catalogStats.source,
    },
  ];

  return h(
    Fragment,
    null,
    // 3D Canvas Container
    h(
      "div",
      { id: "canvas-container" },
      isThreeSceneEnabled &&
        sceneProjects.length > 0 &&
        h(ThreeScene, {
          projects: sceneProjects,
          onScrollUpdate: handleScrollUpdate,
          onReady: () => setIsSceneReady(true),
        })
    ),

    !isSceneReady &&
      h(
        "div",
        { className: "launch-overlay", "aria-live": "polite" },
        h(
          "div",
          { className: "launch-overlay-card" },
          h("span", { className: "launch-dot", "aria-hidden": "true" }, " "),
          h("span", null, t("projects.launch.scene", "Initializing 3D scene..."))
        )
      ),

    h(ProjectAppPopup, {
      popupApp,
      panelStyle: popupPanelStyle,
      frameRef: popupFrameRef,
      overlayRef: popupOverlayRef,
      onClose: closeAppPopup,
      onRequestFit: requestPopupFit,
      t,
    }),

    !isDetailRouteActive &&
      h(
        "section",
        {
          className: "projects-discovery-wrap",
          "aria-label": t("projects.discovery.title", "Projekte filtern und vergleichen"),
        },
        h(
          "div",
          { className: "projects-discovery-card" },
          h(
            "div",
            { className: "projects-discovery__intro" },
            h(
              "span",
              { className: "projects-discovery__eyebrow" },
              t("projects.discovery.eyebrow", "Produkt-Katalog")
            ),
            h(
              "div",
              { className: "projects-discovery__headline" },
              h(
                "h2",
                { className: "projects-discovery__title" },
                t("projects.discovery.title", "Projekte filtern und vergleichen")
              ),
              h(
                "p",
                { className: "projects-discovery__subtitle" },
                hasActiveBrowseFilters
                  ? t("projects.discovery.showing", "{{visible}} von {{total}} Apps sichtbar", {
                      visible: filteredProjects.length,
                      total: totalProjectCount,
                    })
                  : t(
                      "projects.discovery.subtitle",
                      "Suche nach Use Cases, Tags und Stack-Signalen, sortiere den Katalog und springe direkt in passende App-Sammlungen."
                    )
              )
            ),
            h(
              "div",
              { className: "projects-discovery__stats" },
              discoveryStats.map(item =>
                h(
                  "div",
                  {
                    key: item.key,
                    className: "projects-discovery__stat-card",
                  },
                  h("strong", { className: "projects-discovery__stat-value" }, item.value),
                  h("span", { className: "projects-discovery__stat-label" }, item.label)
                )
              )
            )
          ),
          h(
            "div",
            { className: "projects-discovery__controls" },
            h(
              "label",
              {
                className: "projects-discovery__field projects-discovery__field--search",
              },
              h(
                "span",
                { className: "projects-discovery__field-label" },
                t("projects.discovery.search_label", "Projekte durchsuchen")
              ),
              h("input", {
                type: "search",
                className: "projects-discovery__input",
                value: browseState.query,
                placeholder: t(
                  "projects.discovery.search_placeholder",
                  "Nach Projektname, Tag oder Stack suchen..."
                ),
                onInput: event =>
                  updateBrowseFilters({
                    query: event.currentTarget.value,
                  }),
              })
            ),
            h(
              "label",
              {
                className: "projects-discovery__field projects-discovery__field--sort",
              },
              h(
                "span",
                { className: "projects-discovery__field-label" },
                t("projects.discovery.sort_label", "Sortierung")
              ),
              h(
                "select",
                {
                  className: "projects-discovery__select",
                  value: browseState.sort,
                  onChange: event =>
                    updateBrowseFilters({
                      sort: event.currentTarget.value,
                    }),
                },
                h(
                  "option",
                  { value: "featured" },
                  t("projects.discovery.sort_featured", "Empfohlen")
                ),
                h(
                  "option",
                  { value: "latest" },
                  t("projects.discovery.sort_latest", "Neueste zuerst")
                ),
                h(
                  "option",
                  { value: "alphabetical" },
                  t("projects.discovery.sort_alpha", "A bis Z")
                ),
                h(
                  "option",
                  { value: "category" },
                  t("projects.discovery.sort_category", "Nach Kategorie")
                )
              )
            ),
            h(
              "button",
              {
                type: "button",
                className: "btn btn-outline projects-discovery__clear",
                onClick: resetBrowseFilters,
                disabled: !hasActiveBrowseFilters,
              },
              t("projects.discovery.clear", "Filter zurücksetzen")
            )
          ),
          h(
            "div",
            { className: "projects-discovery__toolbar" },
            h(
              "div",
              { className: "projects-discovery__toggle-row" },
              h(
                "button",
                {
                  type: "button",
                  className: `projects-discovery__chip ${
                    browseState.caseStudyOnly ? "projects-discovery__chip--active" : ""
                  }`,
                  "aria-pressed": browseState.caseStudyOnly,
                  onClick: () =>
                    updateBrowseFilters(currentState => ({
                      ...currentState,
                      caseStudyOnly: !currentState.caseStudyOnly,
                    })),
                },
                t("projects.discovery.case_studies_only", "Nur Case Studies")
              ),
              h(
                "button",
                {
                  type: "button",
                  className: `projects-discovery__chip ${
                    browseState.livePreviewOnly ? "projects-discovery__chip--active" : ""
                  }`,
                  "aria-pressed": browseState.livePreviewOnly,
                  onClick: () =>
                    updateBrowseFilters(currentState => ({
                      ...currentState,
                      livePreviewOnly: !currentState.livePreviewOnly,
                    })),
                },
                t("projects.discovery.live_only", "Nur Live-Demos")
              )
            ),
            h(
              ProjectFacetGroup,
              {
                label: t("projects.discovery.category_all", "Alle Kategorien"),
                items: categoryItems,
                activeToken: browseState.category,
                onSelect: token => toggleBrowseFacet("category", token, "all"),
              },
              h(
                "button",
                {
                  type: "button",
                  className: `projects-discovery__chip ${
                    browseState.category === "all" ? "projects-discovery__chip--active" : ""
                  }`,
                  "aria-pressed": browseState.category === "all",
                  onClick: () => updateBrowseFilters({ category: "all" }),
                },
                t("projects.discovery.category_all", "Alle Kategorien")
              )
            ),
            activeBrowseChips.length > 0 &&
              h(
                "div",
                { className: "projects-discovery__facet-group" },
                h(
                  "span",
                  { className: "projects-discovery__facet-label" },
                  t("projects.discovery.active_filters", "Aktive Filter")
                ),
                h(
                  "div",
                  { className: "projects-discovery__chip-list" },
                  activeBrowseChips.map(item =>
                    h(
                      "button",
                      {
                        key: item.key,
                        type: "button",
                        className: "projects-discovery__chip projects-discovery__chip--active",
                        onClick: item.onClear,
                      },
                      `${item.label} ×`
                    )
                  )
                )
              ),
            h(ProjectFacetGroup, {
              label: t("projects.discovery.tags_label", "Beliebte Tags"),
              items: topTagItems,
              activeToken: browseState.tag,
              onSelect: token => toggleBrowseFacet("tag", token),
            }),
            h(ProjectFacetGroup, {
              label: t("projects.discovery.stack_label", "Stack-Fokus"),
              items: topStackItems,
              activeToken: browseState.stack,
              onSelect: token => toggleBrowseFacet("stack", token),
            })
          )
        )
      ),

    // HUD Overlay
    h(
      "div",
      {
        className: `hud-container ${isSceneReady ? "is-ready" : "is-pending"}`,
      },

      !isDetailRouteActive &&
        filteredProjects.length === 0 &&
        h(
          "div",
          {
            className: `hud-panel hud-panel--empty ${isSceneReady ? "visible" : ""}`,
          },
          h(
            "span",
            { className: "hud-meta-pill" },
            t("projects.discovery.results_count", "{{count}} Ergebnisse", {
              count: 0,
            })
          ),
          h(
            "h2",
            { className: "hud-title hud-title--empty" },
            t("projects.discovery.empty_title", "Keine Projekte passen zu dieser Auswahl")
          ),
          h(
            "p",
            { className: "hud-desc hud-desc--empty" },
            t(
              "projects.discovery.empty_text",
              "Passe Suche oder Filter an, um wieder Ergebnisse zu sehen."
            )
          ),
          h(
            "div",
            { className: "hud-actions" },
            h(
              "button",
              {
                type: "button",
                className: "btn btn-primary",
                onClick: resetBrowseFilters,
              },
              t("projects.discovery.clear", "Filter zurücksetzen")
            )
          )
        ),

      // Active Project Info Panel
      activeProject &&
        h(
          "div",
          {
            className: `hud-panel ${isSceneReady ? "visible" : ""}`,
            key: activeProject.id,
          },
          h(
            "div",
            { className: "hud-meta-row" },
            h(
              "span",
              { className: "hud-meta-pill" },
              t("projects.launch.source", "Curated app catalog")
            ),
            h("span", { className: "hud-meta-count" }, projectProgressLabel)
          ),
          h(
            "button",
            {
              type: "button",
              className: "hud-category hud-category--button",
              onClick: () =>
                jumpToBrowseCollection({
                  category: normalizeBrowseCategory(activeProject.category),
                }),
            },
            activeProject.category || "Project"
          ),
          h("h1", { className: "hud-title" }, activeProject.title),
          h("p", { className: "hud-desc" }, activeProject.description),

          activeProject.previewUrl &&
            h(
              "figure",
              { className: "hud-preview-card" },
              h("img", {
                className: "hud-preview-image",
                src: activeProject.previewUrl,
                alt: activeProject.previewAlt || `${activeProject.title} Vorschau`,
                width: 800,
                height: 600,
                loading: "eager",
                decoding: "async",
              })
            ),

          h(
            "div",
            { className: "hud-detail-grid" },
            h(ProjectDetailCard, { label: "Version", value: activeProject.version || "1.0.0" }),
            h(ProjectDetailCard, {
              label: "Update",
              value: activeProject.datePublished || "Aktuell",
            }),
            h(ProjectDetailCard, {
              label: "Preview",
              value: activeProject.appPath ? "Live Demo" : "Katalog",
            }),
            h(ProjectDetailCard, {
              label: "Code",
              value: activeProject.githubPath ? "GitHub" : "Privat",
            })
          ),

          // Dynamic Edge Likes/Claps
          h(LikeButton, {
            id: getProjectSlug(activeProject, activeProjectIndex),
            type: "project",
          }),

          Array.isArray(activeProject.techStack) &&
            activeProject.techStack.length > 0 &&
            h(
              "section",
              { className: "hud-info-section" },
              h("span", { className: "hud-section-label" }, "Tech Stack"),
              h(
                "div",
                { className: "hud-pill-list" },
                activeProject.techStack.map(entry =>
                  h(
                    "button",
                    {
                      type: "button",
                      className: "hud-pill hud-pill--button",
                      key: `stack-${entry}`,
                      onClick: () =>
                        jumpToBrowseCollection({
                          stack: normalizeBrowseToken(entry),
                        }),
                    },
                    entry
                  )
                )
              )
            ),

          Array.isArray(activeProject.tags) &&
            activeProject.tags.length > 0 &&
            h(
              "section",
              { className: "hud-info-section" },
              h("span", { className: "hud-section-label" }, "Tags"),
              h(
                "div",
                { className: "hud-pill-list hud-pill-list--muted" },
                activeProject.tags.slice(0, 8).map(tag =>
                  h(
                    "button",
                    {
                      type: "button",
                      className: "hud-pill hud-pill--muted hud-pill--button",
                      key: tag,
                      onClick: () =>
                        jumpToBrowseCollection({
                          tag: normalizeBrowseToken(tag),
                        }),
                    },
                    tag
                  )
                )
              )
            ),

          // Case Study expandable section
          activeProject.caseStudy &&
            h(
              "div",
              { className: "hud-case-study" },
              h(
                "button",
                {
                  type: "button",
                  className: `btn btn-outline hud-case-study-toggle hud-case-study-toggle--compact ${showCaseStudy ? "is-open" : ""}`,
                  onClick: () => setShowCaseStudy(v => !v),
                },
                showCaseStudy ? "✕ Case Study schließen" : "📋 Case Study"
              ),
              showCaseStudy &&
                h(
                  "div",
                  { className: "hud-case-study-content" },
                  h(
                    "div",
                    { className: "hud-cs-block" },
                    h("strong", null, "⚡ Problem"),
                    h("p", null, activeProject.caseStudy.problem)
                  ),
                  h(
                    "div",
                    { className: "hud-cs-block" },
                    h("strong", null, "💡 Lösung"),
                    h("p", null, activeProject.caseStudy.solution)
                  ),
                  h(
                    "div",
                    { className: "hud-cs-block" },
                    h("strong", null, "🛠 Tech Stack"),
                    h("p", null, activeProject.caseStudy.techStack.join(" · "))
                  ),
                  h(
                    "div",
                    { className: "hud-cs-block" },
                    h("strong", null, "📊 Ergebnis"),
                    h("p", null, activeProject.caseStudy.results)
                  )
                )
            ),

          Array.isArray(activeProject.relatedProjects) &&
            activeProject.relatedProjects.length > 0 &&
            h(
              "section",
              { className: "hud-info-section hud-related" },
              h("span", { className: "hud-section-label" }, "Related Apps"),
              h(
                "div",
                { className: "hud-related-list" },
                activeProject.relatedProjects.map(project =>
                  h(
                    "a",
                    {
                      key: project.name,
                      href: buildProjectDetailPath(project.name),
                      className: "hud-related-link",
                      onClick: event => {
                        event.preventDefault();
                        openProjectDetail(project);
                      },
                    },
                    h("span", { className: "hud-related-label" }, project.title),
                    h("span", { className: "hud-related-meta" }, relatedMatchLabel(project))
                  )
                )
              )
            ),

          h(
            "div",
            { className: "hud-actions" },
            isDetailRouteActive &&
              h(
                "button",
                {
                  type: "button",
                  className: "btn btn-outline",
                  onClick: closeDetailView,
                },
                t("projects.discovery.back_to_collection", "Zur Sammlung")
              ),
            !isDetailRouteActive &&
              h(
                "button",
                {
                  type: "button",
                  className: "btn btn-outline",
                  onClick: () => openProjectDetail(activeProject),
                },
                t("projects.discovery.open_detail", "Produktprofil öffnen")
              ),
            activeProject.appPath &&
              h(
                "a",
                {
                  href: toAbsoluteAppUrl(activeProject.appPath),
                  onClick: event => openAppPopup(event, activeProject),
                  className: "btn btn-primary",
                },
                "Preview öffnen"
              ),

            activeProject.githubPath &&
              h(
                "a",
                {
                  href: activeProject.githubPath,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className: "btn btn-outline",
                },
                "GitHub ansehen"
              )
          )
        ),

      // Scroll Indicator
      isThreeSceneEnabled &&
        h(
          "div",
          { className: "scroll-hint" },
          t("projects.launch.scroll_hint", "SCROLL TO EXPLORE")
        )
    )
  );
};

export const initReactProjectsApp = () => {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;

  try {
    const root = createRoot(rootEl);
    root.render(h(ErrorBoundary, null, h(App)));
  } catch {
    // Failed to initialize React app - show error in UI
    if (rootEl) {
      const launchScreen = document.createElement("div");
      launchScreen.className = "launch-screen launch-screen--error";

      const launchCard = document.createElement("div");
      launchCard.className = "launch-card";

      const title = document.createElement("h2");
      title.textContent = "App konnte nicht geladen werden";

      launchCard.appendChild(title);
      launchScreen.appendChild(launchCard);
      rootEl.replaceChildren(launchScreen);
    }
  }
};
