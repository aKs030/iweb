#!/usr/bin/env node
/*
  Dead Code Scanner (shallow):
  - Sucht nach unreferenzierten Dateien (Bilder, Fonts, CSS, JS, HTML Fragmente)
  - Indizes: Vorkommen in HTML, CSS (url(), @import), JS (import, fetch, src/href in strings)
  - Ignoriert node_modules, .git, reports, lockfiles
*/
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const INCLUDE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".gif",
  ".ico",
  ".css",
  ".js",
  ".html",
  ".woff2",
  ".mp4",
  ".webm",
  ".json",
]);
const CODE_EXT = new Set([".html", ".css", ".js", ".json"]);
const IGNORE_DIRS = new Set(["node_modules", ".git", ".vscode"]);

async function collectFiles(root) {
  const pending = [root];
  const files = [];
  while (pending.length) {
    const d = pending.pop();
    const ds = await fs.readdir(d, { withFileTypes: true });
    for (const ent of ds) {
      if (IGNORE_DIRS.has(ent.name)) continue;
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) pending.push(full);
      else {
        const ext = path.extname(ent.name).toLowerCase();
        if (INCLUDE_EXT.has(ext)) files.push(full);
      }
    }
  }
  return files;
}

async function readText(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

function toWebPath(abs) {
  // Our server root aligns with repo root; ensure leading slash
  const fromRepo = path.relative(path.resolve(ROOT), abs);
  return "/" + fromRepo.split(path.sep).join("/");
}

async function buildReferenceIndex(files) {
  const refs = new Set();
  const codeFiles = files.filter((f) =>
    CODE_EXT.has(path.extname(f).toLowerCase())
  );
  for (const f of codeFiles) {
    const txt = await readText(f);
    if (!txt) continue;
    // crude extraction of urls/paths
    const patterns = [
      /href\s*=\s*"([^"]+)"/g,
      /src\s*=\s*"([^"]+)"/g,
      /url\(\s*[\'\"]?([^\'\"\)]+)[\'\"]?\s*\)/g,
      /import\s+[^\'\";]*[\'\"]([^\'\"]+)[\'\"]/g,
      /from\s+[\'\"]([^\'\"]+)[\'\"]/g,
      /fetch\(\s*[\'\"]([^\'\"]+)[\'\"]/g,
    ];
    // generic absolute content path detection inside any quoted string
    const genericContent = /[\'\"](\/content\/[\w\-./]+)[\'\"]/g;
    let gm;
    while ((gm = genericContent.exec(txt))) {
      refs.add(gm[1]);
    }
    for (const re of patterns) {
      let m;
      while ((m = re.exec(txt))) {
        refs.add(m[1]);
      }
    }
  }
  return refs;
}

function normalizeCandidates(files) {
  const map = new Map();
  for (const f of files) {
    const web = toWebPath(f);
    map.set(web, f);
  }
  return map;
}

function likelyUnused(fileWebPath, refs) {
  // exact match or relative variants
  if (refs.has(fileWebPath)) return false;
  // also check without leading slash
  if (refs.has(fileWebPath.slice(1))) return false;
  // check basename presence (weak)
  const base = path.basename(fileWebPath);
  for (const r of refs) {
    if (typeof r === "string" && r.includes(base)) return false;
  }
  return true;
}

(async function main() {
  const all = await collectFiles(ROOT);
  const refs = await buildReferenceIndex(all);
  const candidates = normalizeCandidates(all);

  const unused = [];
  for (const [web, abs] of candidates) {
    const ext = path.extname(abs).toLowerCase();
    if (!CODE_EXT.has(ext)) {
      if (likelyUnused(web, refs)) unused.push({ web, abs });
    }
  }

  // Group by folder for readability
  const groups = new Map();
  for (const u of unused) {
    const dir = path.dirname(u.web);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(u);
  }

  if (unused.length === 0) {
    console.log("✅ Kein offensichtlicher ungenutzter Asset gefunden.");
    return;
  }

  console.log("🧹 Potenziell ungenutzte Assets (heuristisch):");
  for (const [dir, items] of groups) {
    console.log(`\n📁 ${dir}`);
    for (const it of items) {
      const stat = await fs.stat(it.abs).catch(() => null);
      const sizeKB = stat ? (stat.size / 1024).toFixed(2) : "n/a";
      console.log(`  - ${it.web}  (${sizeKB} KB)`);
    }
  }

  console.log(
    "\nℹ️ Hinweis: Heuristik kann false-positives enthalten (dynamisch referenzierte Dateien)."
  );
})();
