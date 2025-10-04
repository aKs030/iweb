/**
 * Theme System - Globale Theme-Initialisierung
 * Features: System-Theme-Erkennung, localStorage-Persistierung, FOUC-Vermeidung
 */

import { createLogger } from "../shared-utilities.js";

const log = createLogger("themeSystem");
let __themeInitialized = false;
function initializeGlobalTheme() {
  if (__themeInitialized) {
    log.debug("Theme System bereits initialisiert");
    return;
  }

  log.debug("Initialisiere Theme System");

  // Transition styles are provided by the external stylesheet
  // Ensure external transition CSS is loaded to avoid runtime-injected <style>
  const TRANSITION_CSS_HREF =
    "/content/webentwicklung/animations/theme-transitions.css";
  if (!document.querySelector(`link[href="${TRANSITION_CSS_HREF}"]`)) {
    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", TRANSITION_CSS_HREF);
    log.debug("Transition CSS nachgeladen");
  }

  // Theme basierend auf localStorage oder System-Präferenz setzen
  const savedTheme = localStorage.getItem("theme");
  let initialTheme;

  if (savedTheme && (savedTheme === "light" || savedTheme === "dark")) {
    initialTheme = savedTheme;
    log.debug(`Gespeichertes Theme verwendet: ${initialTheme}`);
  } else {
    // System-Präferenz prüfen
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    initialTheme = prefersDark ? "dark" : "light";
    localStorage.setItem("theme", initialTheme);
    log.debug(`System-Theme erkannt: ${initialTheme}`);
  }

  // Theme sofort anwenden (vor DOM-Ready um FOUC zu vermeiden)
  document.documentElement.setAttribute("data-theme", initialTheme);
  updateThemeMetaTags(initialTheme);

  __themeInitialized = true;
  log.info(`Theme System initialisiert: ${initialTheme}`);
}

/**
 * Aktualisiert Browser-Meta-Tags für Theme
 */
function updateThemeMetaTags(theme) {
  const themeColor = theme === "dark" ? "#0a0a0a" : "#ffffff";
  const statusBarStyle = theme === "dark" ? "black-translucent" : "default";

  // Theme-Color Meta-Tag
  let themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", themeColor);
  } else {
    themeColorMeta = document.createElement("meta");
    themeColorMeta.setAttribute("name", "theme-color");
    themeColorMeta.setAttribute("content", themeColor);
    document.head.appendChild(themeColorMeta);
  }

  // Apple Status Bar Style
  const statusBarMeta = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]'
  );
  if (statusBarMeta) {
    statusBarMeta.setAttribute("content", statusBarStyle);
  }
}

function setTheme(theme) {
  const validatedTheme = ["dark", "light"].includes(theme) ? theme : "dark";

  log.debug(`Theme wird gesetzt: ${theme} → ${validatedTheme}`);

  document.documentElement.setAttribute("data-theme", validatedTheme);
  localStorage.setItem("theme", validatedTheme);
  localStorage.setItem("theme-user-set", Date.now().toString());

  // Event für Theme-Änderung dispatchen
  const event = new CustomEvent("themeChanged", {
    detail: { theme: validatedTheme, source: "manual" },
  });
  document.dispatchEvent(event);

  return validatedTheme;
}

function getCurrentTheme() {
  return document.documentElement.getAttribute("data-theme") || "dark";
}

function toggleTheme() {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  return setTheme(newTheme);
}

function setupSystemThemeListener() {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  mediaQuery.addEventListener("change", (e) => {
    const lastUserChange = localStorage.getItem("theme-user-set");
    const now = Date.now();

    if (!lastUserChange || now - parseInt(lastUserChange) > 300000) {
      const systemTheme = e.matches ? "dark" : "light";
      setTheme(systemTheme);
    }
  });
}

// Einmalige Initialisierung
initializeGlobalTheme();

// System Listener einrichten
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      setupSystemThemeListener();
    },
    { once: true }
  );
} else {
  setupSystemThemeListener();
}

window.themeSystem = {
  setTheme,
  toggleTheme,
  getCurrentTheme,
  updateThemeMetaTags,
  reinitialize: initializeGlobalTheme,
};

export {
  getCurrentTheme,
  initializeGlobalTheme,
  setTheme,
  toggleTheme,
  updateThemeMetaTags,
};
