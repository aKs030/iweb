/**
 * Projects Page Loader
 * @version 6.0.0
 */

import { initReactProjectsApp } from "./app.js";
import { AppLoadManager } from "../content/core/load-manager.js";

const initPage = () => {
  try {
    initReactProjectsApp();
    AppLoadManager.hideLoader(100);
  } catch (error) {
    AppLoadManager.hideLoader(500);
    const root = document.getElementById("root");
    if (root && !root.firstElementChild && !root.textContent.trim()) {
      const errorPanel = document.createElement("div");
      errorPanel.className = "project-load-error";

      const title = document.createElement("h2");
      title.textContent = "Fehler beim Laden";

      const details = document.createElement("p");
      const label = document.createElement("strong");
      label.textContent = "Details:";
      const detailText = document.createElement("span");
      detailText.id = "error-detail";
      detailText.textContent = error.message;
      details.append(label, " ", detailText);

      const reloadButton = document.createElement("button");
      reloadButton.className = "project-load-error__button";
      reloadButton.type = "button";
      reloadButton.dataset.action = "reload-page";
      reloadButton.textContent = "Seite neu laden";
      reloadButton.addEventListener("click", () => window.location.reload());

      errorPanel.append(title, details, reloadButton);
      root.replaceChildren(errorPanel);
    }
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage, { once: true });
} else {
  initPage();
}
