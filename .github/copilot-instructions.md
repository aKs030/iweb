# GitHub Copilot / AI-Agent Instructions for this repo

Kurz, präzise Hinweise damit ein AI-Coding-Agent schnell produktiv werden kann.

## Projektübersicht

- Statische, modulare PWA/Portfolio-Seite (keine SPA-Build-Toolchain).
- Komponenten leben in `content/` (utils, components, config). Seiten liegen unter `pages/<slug>/index.html`.
- Interaktive Visuals mit Three.js (`content/components/particles/three-earth-system.js`).
- Leichtgewichtige React-Widgets als vendor-Scripts (`content/vendor/*`), z. B. Gallery (`pages/gallery/gallery-app.js`) — kein Bundler, ESM-Imports direkt im Browser.

## Schnelleentwickler-Workflows (wichtig)

- Lokaler Dev-Server: npm install && npm run dev
  - Startet `dev-server.js` (standard Port: 3000). Du kannst Port mit `PORT=8081 npm run dev` überschreiben.
  - Dev-Server interpretiert `_redirects` (Netlify/Cloudflare-Style) und macht Rewrites/Redirects; 200-Rewrites versuchen, lokale Dateien zu serven.
- Lint: `npm run lint` (ESLint). README erwähnt `format`/`prepare`/`test:playwright`, diese Skripte existieren aktuell **nicht** in `package.json` — siehe „Empfohlene Tasks“ weiter unten.
- Playwright in CI: `.github/workflows/playwright.yml` ruft `npm run test:playwright` auf, das Skript fehlt lokal; zum Ausführen lokal: `npx playwright test`.
- YouTube API: `scripts/install-youtube-key.js` -> setzt `YT_KEY` env var und erzeugt `content/config/videos-part-*.js`. Die Laufzeit-Loader-Logik ist in `content/config/videos-config-loader.js` (setzt `window.YOUTUBE_API_KEY` oder `window.YOUTUBE_USE_MOCK`).

## Typische Code-/Architektur-Patterns zu kennen

- ESM überall: `import ... from './...';` — keine bundler-spezifischen Konfigurationen.
- Test-/CI-freundliche Module: Viele Komponenten exportieren saubere, testbare Helfer (z. B. `content/components/head/head-complete.js`, `content/main.js`).
- Test-Feature-Flags: `?test` Queryparam, `ENV.isTest` in `content/main.js`, `globalThis.__FORCE_THREE_EARTH` (Debug/Test-Zwang für WebGL).
- Lazy Sections: `section[data-section-src]` wird dynamisch geladen durch SectionLoader in `content/main.js`.
- Global configuration via `globalThis` (z. B. `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID`, `announce` helper) — ändern mit Vorsicht.

## Sicherheit / CSP

- CSP- und iframe-Notizen finden sich in `SECURITY-CSP.md` (YouTube-Embeds → `youtube-nocookie.com`).

## Integrationspunkte / externe Abhängigkeiten

- YouTube Data API (optional) — handled client-side via split key parts.
- Google generative language (Gemini) usage in `content/components/robot-companion/gemini-service.js` — server-side API key is expected when used from a server.
- Playwright (CI), Puppeteer ist als devDependency vorhanden (möglicherweise für Scripts/Tests).

## Files to inspect for concrete examples

- Dev server & rewrites: `dev-server.js` (route fallbacks + `_redirects` parsing)
- Main runtime & SectionLoader: `content/main.js`
- Video config & API key handling: `content/config/videos-config-loader.js`, `scripts/install-youtube-key.js`
- Three.js Earth: `content/components/particles/three-earth-system.js`
- SEO / head helpers (testable): `content/components/head/head-complete.js`
- Gallery (React vendor usage): `pages/gallery/gallery-app.js`

## Recommendations for AI agents / PR candidates

- Small, safe fixes:
  - Add missing npm scripts (e.g., `format`, `format:check`, `prepare`, `test:playwright`) to `package.json` and update `README.md` to match actual behavior.
  - Add `test:playwright` → `npx playwright test` and a `build` script if introducing a production bundling step (esbuild suggested if needed).
  - Sync docs: Update README to reflect actual dev port (dev-server logs 3000 by default).
- Tests & CI:
  - If adding Playwright tests, add `npm run test:playwright` and ensure `npx playwright install` runs in CI (workflow already includes this).
  - Use `?mockVideos=1` or set `window.YOUTUBE_USE_MOCK` in tests to avoid flakiness from external API calls.
- When modifying runtime behavior prefer to:
  - Keep pure helpers small and testable (as current files do).
  - Avoid introducing global mutation; if necessary, document the `globalThis` keys you use.

---

Wenn du möchtest, kann ich:

- die neue Datei jetzt committen (erledigt), und/oder
- gleich die fehlenden npm-Skripte & README-Inkonsistenzen als PR anlegen ✅

Ist etwas unklar oder soll ich einen bestimmten Bereich (z.B. Playwright-Skript + Beispieltest) direkt implementieren?
