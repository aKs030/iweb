import { useMemo } from "react";
import { collectFacetCounts, filterProjects, findFacetLabel } from "../utils/project-browse.js";

export function useProjectCatalog(projects, browseState, deferredQuery) {
  const categoryItems = useMemo(() => collectFacetCounts(projects, "category"), [projects]);
  const tagItems = useMemo(() => collectFacetCounts(projects, "tags"), [projects]);
  const stackItems = useMemo(() => collectFacetCounts(projects, "techStack"), [projects]);
  const filteredProjects = useMemo(
    () => filterProjects(projects, { ...browseState, query: deferredQuery }),
    [browseState, deferredQuery, projects]
  );
  const catalogStats = useMemo(
    () =>
      projects.reduce(
        (stats, project) => {
          stats.total += 1;
          if (project?.hasLivePreview) stats.live += 1;
          if (project?.hasCaseStudy) stats.caseStudies += 1;
          if (project?.hasSource) stats.source += 1;
          return stats;
        },
        { total: 0, live: 0, caseStudies: 0, source: 0 }
      ),
    [projects]
  );

  return {
    categoryItems,
    filteredProjects,
    catalogStats,
    topTagItems: tagItems.slice(0, 6),
    topStackItems: stackItems.slice(0, 6),
    activeCategoryLabel:
      browseState.category !== "all" ? findFacetLabel(categoryItems, browseState.category) : "",
    activeTagLabel: browseState.tag ? findFacetLabel(tagItems, browseState.tag) : "",
    activeStackLabel: browseState.stack ? findFacetLabel(stackItems, browseState.stack) : "",
  };
}
