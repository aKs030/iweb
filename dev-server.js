const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;
const root = path.resolve(__dirname);

// Explizite lokale Rewrites für /impressum/ und /datenschutz/
app.get(["/impressum", "/impressum/"], (req, res) => {
  const file = path.join(root, "content/components/footer/impressum.html");
  if (fs.existsSync(file)) return res.sendFile(file);
  return res.status(404).send("Not found");
});
app.get(["/datenschutz", "/datenschutz/"], (req, res) => {
  const file = path.join(root, "content/components/footer/datenschutz.html");
  if (fs.existsSync(file)) return res.sendFile(file);
  return res.status(404).send("Not found");
});

// Serve static files from project root
app.use(express.static(root, { extensions: ["html"] }));

// Explicit rewrites for nicer local routes
// Attempt to parse _redirects (Netlify/Cloudflare-style) and register rules
const redirectsPath = path.join(root, "_redirects");
const redirectRules = [];

function normalizeSpace(s) {
  return (s || "").trim();
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (fs.existsSync(redirectsPath)) {
  const raw = fs.readFileSync(redirectsPath, "utf8");
  const lines = raw.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    // Split by whitespace, but keep target tokens that may contain :splat
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const src = normalizeSpace(parts[0]);
    const dest = normalizeSpace(parts[1]);
    const status = parts[2] ? normalizeSpace(parts[2]) : "200";

    // Convert Netlify-style glob to a regex / express style
    if (src.includes("*") || src.includes(":splat")) {
      // create regex: replace '*' with '(.*)' and escape other chars
      const pattern = src
        .replace(/:[a-zA-Z0-9_-]+/g, "(.*)")
        .replace(/\*/g, "(.*)");
      // ensure it matches full path
      const regex = new RegExp("^" + pattern.replace(/\//g, "\\/") + "$");
      redirectRules.push({ type: "pattern", src, dest, status, regex });
    } else {
      redirectRules.push({ type: "exact", src, dest, status });
    }
  }
}

// Register redirect/rewrite handlers in the same order as in _redirects
for (const r of redirectRules) {
  // choose route matcher (exact -> literal, pattern -> prebuilt regex)
  const routeMatcher =
    r.type === "exact" ? new RegExp("^" + escapeRegExp(r.src) + "$") : r.regex;

  app.get(routeMatcher, (req, res) => {
    const m = req.path.match(routeMatcher) || [];
    const splat = m[1] || "";

    // resolve destination (replace :splat and * placeholders)
    const destResolved = r.dest.replace(/:splat|\*/g, () => splat);

    const statusCode = parseInt(r.status, 10) || 200;

    // If it's a rewrite (200), serve local file if available
    if (statusCode >= 200 && statusCode < 300) {
      if (destResolved.startsWith("/")) {
        const candidate = path.join(root, destResolved.replace(/^\/+/, ""));
        try {
          const st = fs.statSync(candidate);
          if (st.isFile()) return res.sendFile(candidate);
          if (st.isDirectory()) {
            const idx = path.join(candidate, "index.html");
            try {
              const s2 = fs.statSync(idx);
              if (s2.isFile()) return res.sendFile(idx);
            } catch (e) {
              // no index.html
            }
          }
        } catch (e) {
          // not found -> continue to next handler
        }
      }
      // If rewrite target not a local file, fall back to 404
      return res.status(404).send("Not found");
    }

    // Otherwise treat as redirect (301/302 etc.)
    // For local dests (starting with '/'), send redirect preserving destResolved
    return res.redirect(statusCode, destResolved);
  });
}

// Fallback: if request matches a folder with index.html under pages, serve it
app.get("/*", (req, res, next) => {
  const urlPath = req.path.replace(/\/+$/, "");
  const candidate = path.join(root, "pages", urlPath, "index.html");
  if (fs.existsSync(candidate)) return res.sendFile(candidate);
  return next();
});

// Default 404 handler
app.use((req, res) => res.status(404).send("Not found"));

app.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`);
  console.log("Rewrites: /projekte, /gallery, /videos, /blog, /about");
});
