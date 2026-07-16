import { useEffect } from "react";
import { BASE_URL } from "#config/constants.js";
import { injectSchema } from "#core/seo/index.js";
import { PROJECTS_HOME_PATH, buildProjectDetailPath } from "#core/project-paths.js";
import { getProjectSlug, toAbsoluteAppUrl } from "../utils/project-browse.js";

const DEFAULT_TITLE = "Projekte | Abdulkerim Sesli";
const DEFAULT_DESCRIPTION =
  "Entdecke interaktive Web-Experimente und produktionsnahe Apps mit Fokus auf Performance, UI-Systeme und spielerische Interfaces.";
function buildProjectNodes(projects, projectsListId) {
  const seenSlugs = new Set();

  return projects.flatMap((project, index) => {
    const slug = getProjectSlug(project, index);
    if (seenSlugs.has(slug)) return [];
    seenSlugs.add(slug);

    const canonicalUrl = `${BASE_URL}${buildProjectDetailPath(slug)}`;
    const name = project.title || project.name || `Projekt ${index + 1}`;
    const appUrl = toAbsoluteAppUrl(project.appPath);

    return [
      {
        "@type": "SoftwareApplication",
        "@id": `${canonicalUrl}#app`,
        name,
        description: project.description,
        applicationCategory: project.category === "game" ? "GameApplication" : "WebApplication",
        applicationSubCategory: project.category || undefined,
        operatingSystem: "Any",
        url: canonicalUrl,
        ...(appUrl ? { sameAs: appUrl } : {}),
        ...(project.image ? { image: [project.image] } : {}),
        ...(Array.isArray(project.tags) && project.tags.length
          ? { keywords: project.tags.join(", ") }
          : {}),
        ...(project.version ? { softwareVersion: project.version } : {}),
        author: {
          "@type": "Person",
          name: "Abdulkerim Sesli",
          url: `${BASE_URL}/`,
        },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
        },
        isPartOf: { "@id": projectsListId },
      },
    ];
  });
}

function buildProjectsSchema(projects) {
  const projectsListId = `${BASE_URL}/projekte/#projects-list`;
  const projectNodes = buildProjectNodes(projects, projectsListId);
  const listNode = {
    "@type": "ItemList",
    "@id": projectsListId,
    name: "Projekte von Abdulkerim Sesli",
    numberOfItems: projectNodes.length,
    itemListElement: projectNodes.map((node, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@id": node["@id"],
        name: node.name,
        url: node.url,
      },
    })),
  };

  return [listNode, ...projectNodes];
}

export function useProjectSeo({
  projects,
  activeProject,
  activeProjectPath,
  activeCategoryLabel,
  activeTagLabel,
  activeStackLabel,
  isDetailRouteActive,
  isInitialRouteResolved,
  setSceneReady,
}) {
  useEffect(() => {
    if (projects.length === 0) {
      document.getElementById("projects-schema-ldjson")?.remove();
      setSceneReady(false);
      return;
    }

    injectSchema(buildProjectsSchema(projects), {
      scriptId: "projects-schema-ldjson",
    });
  }, [projects, setSceneReady]);

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
            : DEFAULT_TITLE;
    document.title = nextTitle;

    const descriptionTag = document.querySelector('meta[name="description"]');
    if (descriptionTag instanceof HTMLMetaElement) {
      descriptionTag.content =
        (isDetailRouteActive && activeProject.description) || DEFAULT_DESCRIPTION;
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink instanceof HTMLLinkElement) {
      canonicalLink.href = `${BASE_URL}${
        isDetailRouteActive ? activeProjectPath : PROJECTS_HOME_PATH
      }`;
    }

    if (
      isDetailRouteActive &&
      (window.location.pathname !== activeProjectPath || window.location.search)
    ) {
      window.history.replaceState(null, "", activeProjectPath);
    }
  }, [
    activeCategoryLabel,
    activeProject,
    activeProjectPath,
    activeStackLabel,
    activeTagLabel,
    isDetailRouteActive,
    isInitialRouteResolved,
  ]);
}
