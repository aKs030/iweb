import { createElement as h } from "react";

function ReloadButton({ t }) {
  return h(
    "button",
    {
      type: "button",
      className: "btn btn-primary launch-retry",
      onClick: () => window.location.reload(),
    },
    t("projects.launch.retry", "Reload page")
  );
}

export function ProjectLaunchState({ state, lang, error, t }) {
  if (state === "loading") {
    return h(
      "div",
      { className: "launch-screen", "data-lang": lang, "aria-live": "polite" },
      h(
        "div",
        { className: "launch-card" },
        h("span", { className: "launch-badge" }, t("projects.launch.badge", "3D Project Archive")),
        h(
          "h1",
          { className: "launch-title" },
          t("projects.launch.title", "Preparing the project space")
        ),
        h(
          "p",
          { className: "launch-subtitle" },
          t(
            "projects.launch.subtitle",
            "The curated catalog is loading and being prepared for spatial navigation."
          )
        ),
        h(
          "div",
          { className: "launch-status" },
          h("span", { className: "launch-dot", "aria-hidden": "true" }),
          h("span", null, t("projects.launch.loading", "Loading projects · Preparing scene …"))
        ),
        h(
          "div",
          { className: "launch-skeleton", "aria-hidden": "true" },
          h("span", { className: "launch-skeleton__line launch-skeleton__line--wide" }),
          h("span", { className: "launch-skeleton__line" }),
          h(
            "div",
            { className: "launch-skeleton__tiles" },
            h("span", { className: "launch-skeleton__tile" }),
            h("span", { className: "launch-skeleton__tile" }),
            h("span", { className: "launch-skeleton__tile" })
          )
        ),
        h(
          "p",
          { className: "launch-hint" },
          t("projects.launch.hint", "Once ready, scroll to move through the projects.")
        )
      )
    );
  }

  const isError = state === "error";
  return h(
    "div",
    {
      className: "launch-screen launch-screen--error",
      "data-lang": lang,
      "aria-live": isError ? "assertive" : "polite",
    },
    h(
      "div",
      { className: "launch-card" },
      h(
        "h2",
        { className: "launch-title" },
        isError
          ? t("projects.launch.error_title", "Projects could not be loaded at startup")
          : t("error.no_content", "No projects available")
      ),
      isError && h("p", { className: "launch-error-copy" }, error),
      h(ReloadButton, { t })
    )
  );
}
