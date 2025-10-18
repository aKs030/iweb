#!/usr/bin/env node
/*
  Dead Code Scanner v5.0 (Enhanced Edition)
  
  Features:
  - 🚀 Parallel processing for better performance
  - 📊 Multiple output formats (Console, JSON, HTML, Markdown)
  - ⚙️ Configuration file support (.deadcoderc)
  - 🎯 Extended pattern recognition (React, Vue, Tailwind)
  - 💾 Cache system for faster re-scans
  - 🔍 Severity levels for findings
  - 🎨 Color-coded console output
  - 📈 Detailed statistics and insights
  - 🔧 Auto-fix suggestions
*/

import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ===== CONFIGURATION =====
const DEFAULT_CONFIG = {
  rootDir: ROOT,
  includeExtensions: [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".svg",
    ".gif",
    ".ico",
    ".css",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".html",
    ".vue",
    ".woff",
    ".woff2",
    ".ttf",
    ".mp4",
    ".webm",
    ".json",
    ".xml",
  ],
  codeExtensions: [
    ".html",
    ".css",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".vue",
    ".json",
    ".xml",
  ],
  ignoreDirs: [
    "node_modules",
    ".git",
    ".vscode",
    "dist",
    "build",
    ".cache",
    ".deadcode-cache",
    "reports",
  ],
  ignoreFiles: [
    "package-lock.json",
    "yarn.lock",
    ".DS_Store",
    "package.json",
    ".prettierrc.json",
    ".deadcoderc.json",
    ".eslintrc.json",
    "tsconfig.json",
  ],

  cssWhitelist: [
    "active",
    "open",
    "fade",
    "visible",
    "hidden",
    "disabled",
    "selected",
    "current",
    "focus",
    "hover",
    "checked",
    "error",
    "success",
    "warning",
    "loading",
    "show",
    "hide",
  ],

  jsWhitelist: [
    "init",
    "cleanup",
    "main",
    "default",
    "render",
    "update",
    "destroy",
    "setup",
    "mount",
    "unmount",
  ],

  outputFormat: "console", // console, json, html, markdown
  outputFile: null,
  useCache: true,
  cacheDir: ".deadcode-cache",
  parallel: true,
  maxParallel: 10,
  verbose: false,
  showSuggestions: true,
  severityThreshold: "low", // low, medium, high
};

// ===== COLORS FOR CONSOLE =====
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// ===== CONFIGURATION LOADER =====
async function loadConfig() {
  const configPaths = [
    path.join(ROOT, ".deadcoderc"),
    path.join(ROOT, ".deadcoderc.json"),
    path.join(ROOT, "deadcode.config.json"),
  ];

  for (const configPath of configPaths) {
    try {
      const content = await fs.readFile(configPath, "utf8");
      const userConfig = JSON.parse(content);
      return { ...DEFAULT_CONFIG, ...userConfig };
    } catch {
      continue;
    }
  }

  return DEFAULT_CONFIG;
}

// ===== CACHE SYSTEM =====
class Cache {
  constructor(config) {
    this.config = config;
    this.cacheDir = path.join(config.rootDir, config.cacheDir);
    this.cacheFile = path.join(this.cacheDir, "scan-cache.json");
  }

  async getFileHash(filePath) {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash("md5").update(content).digest("hex");
    } catch {
      return null;
    }
  }

  async load() {
    if (!this.config.useCache) return null;

    try {
      const content = await fs.readFile(this.cacheFile, "utf8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async save(data) {
    if (!this.config.useCache) return;

    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.writeFile(this.cacheFile, JSON.stringify(data, null, 2));
    } catch (err) {
      console.warn(
        colorize(`⚠️ Could not save cache: ${err.message}`, "yellow")
      );
    }
  }

  async isFileModified(filePath, cachedHash) {
    const currentHash = await this.getFileHash(filePath);
    return currentHash !== cachedHash;
  }
}

// ===== FILE COLLECTOR =====
async function collectFiles(config) {
  const includeExt = new Set(
    config.includeExtensions.map((e) => e.toLowerCase())
  );
  const ignoreDirs = new Set(config.ignoreDirs);
  const ignoreFiles = new Set(config.ignoreFiles);

  const pending = [config.rootDir];
  const files = [];

  while (pending.length) {
    const dir = pending.pop();
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (ignoreDirs.has(entry.name) || ignoreFiles.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (includeExt.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  return files;
}

// ===== PARALLEL PROCESSOR =====
async function processInParallel(items, processor, maxParallel = 10) {
  const results = [];
  const chunks = [];

  for (let i = 0; i < items.length; i += maxParallel) {
    chunks.push(items.slice(i, i + maxParallel));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map((item) =>
        processor(item).catch((err) => {
          console.warn(
            colorize(`⚠️ Error processing ${item}: ${err.message}`, "yellow")
          );
          return null;
        })
      )
    );
    results.push(...chunkResults.filter((r) => r !== null));
  }

  return results;
}

// ===== TEXT READER =====
async function readText(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

// ===== PATH UTILITIES =====
function toWebPath(abs, root) {
  const fromRepo = path.relative(path.resolve(root), abs);
  return "/" + fromRepo.split(path.sep).join("/");
}

// ===== REFERENCE INDEX BUILDER =====
async function buildReferenceIndex(files, config) {
  const refs = new Set();
  const codeExt = new Set(config.codeExtensions.map((e) => e.toLowerCase()));
  const codeFiles = files.filter((f) =>
    codeExt.has(path.extname(f).toLowerCase())
  );

  const processor = async (file) => {
    const txt = await readText(file);
    if (!txt) return [];

    const localRefs = [];

    // Enhanced patterns for v5.0
    const patterns = [
      // HTML/JSX attributes
      /(?:href|src|data-src|data-background)\s*=\s*["']([^"']+)["']/g,
      // Meta tag content attributes (Open Graph, Twitter Cards, etc.)
      /(?:property|name)\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']+)["']/gi,
      /(?:property|name)\s*=\s*["']twitter:image["'][^>]*content\s*=\s*["']([^"']+)["']/gi,
      /content\s*=\s*["']([^"']*\/content\/img\/[^"']+)["']/g,
      // JSON-LD image references
      /"image"\s*:\s*["']([^"']+\.(?:webp|png|jpg|jpeg|svg|gif))["']/g,
      // Manifest.json icon references
      /"src"\s*:\s*["']([^"']+\/icons\/[^"']+)["']/g,
      // CSS url()
      /url\(\s*["']?([^"'\)]+)["']?\s*\)/g,
      // JavaScript imports
      /import\s+(?:[^"';]*["']([^"']+)["']|[^"';]*from\s+["']([^"']+)["'])/g,
      // Dynamic imports
      /import\(\s*["']([^"']+)["']\s*\)/g,
      // fetch/axios
      /(?:fetch|axios\.(?:get|post|put|delete))\(\s*["']([^"']+)["']/g,
      // require()
      /require\(\s*["']([^"']+)["']\s*\)/g,
      // Background images in style attributes
      /style\s*=\s*["'][^"']*background(?:-image)?\s*:\s*url\(["']?([^"'\)]+)["']?\)/g,
      // Generic absolute paths
      /["'](\/[\w\-./]+\.(?:png|jpg|jpeg|webp|svg|gif|ico|css|js|woff2?|mp4|webm))["']/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(txt))) {
        let ref = match[1] || match[2];
        if (!ref || ref.startsWith("data:")) continue;

        // Extrahiere lokalen Pfad von vollständigen URLs (z.B. https://abdulkerimsesli.de/content/img/x.webp -> /content/img/x.webp)
        if (ref.startsWith("http")) {
          try {
            const url = new URL(ref);
            // Nur URLs der eigenen Domain berücksichtigen
            if (
              url.hostname === "abdulkerimsesli.de" ||
              url.hostname === "localhost"
            ) {
              ref = url.pathname;
            } else {
              continue; // Externe URLs ignorieren
            }
          } catch {
            continue; // Ungültige URLs ignorieren
          }
        }

        localRefs.push(ref);
      }
    }

    return localRefs;
  };

  const allRefs = config.parallel
    ? await processInParallel(codeFiles, processor, config.maxParallel)
    : await Promise.all(codeFiles.map(processor));

  allRefs.flat().forEach((ref) => refs.add(ref));
  return refs;
}

// ===== ASSET ANALYZER =====
function analyzeAssets(files, refs, config) {
  const codeExt = new Set(config.codeExtensions.map((e) => e.toLowerCase()));
  const candidates = new Map();

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!codeExt.has(ext)) {
      const webPath = toWebPath(file, config.rootDir);
      candidates.set(webPath, file);
    }
  }

  const unused = [];

  for (const [webPath, absPath] of candidates) {
    let isUsed = false;

    // Check exact match
    if (refs.has(webPath) || refs.has(webPath.slice(1))) {
      isUsed = true;
    }

    // Check basename presence
    if (!isUsed) {
      const basename = path.basename(webPath);
      for (const ref of refs) {
        if (typeof ref === "string" && ref.includes(basename)) {
          isUsed = true;
          break;
        }
      }
    }

    if (!isUsed) {
      unused.push({
        type: "asset",
        path: webPath,
        absPath: absPath,
        severity: getSeverity(absPath),
      });
    }
  }

  return unused;
}

async function getSeverity(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let size = 0;
  try {
    const stats = await fs.stat(filePath);
    size = stats.size;
  } catch {
    // File might not exist or be inaccessible
    return "low";
  }

  // High severity: Large files or critical assets
  if (size > 500 * 1024 || [".js", ".css"].includes(ext)) {
    return "high";
  }

  // Medium severity: Medium files
  if (size > 50 * 1024) {
    return "medium";
  }

  return "low";
}

// ===== CSS ANALYZER v5.0 =====
async function analyzeCSSClasses(files, config) {
  const cssFiles = files.filter((f) => f.endsWith(".css"));
  const codeFiles = files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return config.codeExtensions.includes(ext);
  });

  const definedClasses = new Set();
  const classLocations = new Map();
  const whitelist = new Set(config.cssWhitelist);

  // Extract CSS classes with PostCSS
  for (const cssFile of cssFiles) {
    const content = await readText(cssFile);
    const fileRel = path.relative(config.rootDir, cssFile);

    try {
      const root = postcss.parse(content, { from: cssFile });

      root.walkRules((rule) => {
        try {
          selectorParser((selectors) => {
            selectors.walkClasses((classNode) => {
              const className = classNode.value;

              // Skip invalid classes
              if (/^\d/.test(className) || className.length === 1) return;
              if (
                [
                  "css",
                  "js",
                  "html",
                  "woff",
                  "woff2",
                  "ttf",
                  "sh",
                  "md",
                ].includes(className)
              ) {
                return;
              }

              definedClasses.add(className);
              if (!classLocations.has(className)) {
                classLocations.set(className, []);
              }
              if (!classLocations.get(className).includes(fileRel)) {
                classLocations.get(className).push(fileRel);
              }
            });
          }).processSync(rule.selector);
        } catch {
          // Skip invalid selectors
        }
      });
    } catch (err) {
      if (config.verbose) {
        console.warn(
          colorize(`⚠️ CSS parse error in ${fileRel}: ${err.message}`, "yellow")
        );
      }
    }
  }

  // Find class usages
  const usedClasses = new Set();

  for (const file of codeFiles) {
    const content = await readText(file);

    // Enhanced patterns for v5.0
    const patterns = [
      // HTML/JSX class attributes
      /class(?:Name)?\s*=\s*["']([^"']+)["']/g,
      /class(?:Name)?\s*=\s*{["']([^"']+)["']}/g,
      // classList operations
      /classList\.(?:add|remove|toggle|contains)\s*\(\s*["']([^"']+)["']\s*\)/g,
      // querySelector with classes
      /querySelector(?:All)?\s*\(\s*["']\.([a-zA-Z_][\w-]*)["']\s*\)/g,
      // Tailwind/Utility class detection
      /["']([a-z]+-\d+|[a-z]+-[a-z]+-\d+)["']/g,
      // Template literals
      /className\s*=\s*`([^`]+)`/g,
      // Vue :class bindings
      /:class\s*=\s*["'{]([^"'}]+)["'}]/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content))) {
        const classStr = match[1];
        if (classStr) {
          classStr.split(/\s+/).forEach((cls) => {
            if (cls && cls.length > 1) {
              usedClasses.add(cls);

              // Handle Tailwind responsive variants (e.g., md:flex -> flex)
              const baseClass = cls.split(":").pop();
              if (baseClass) usedClasses.add(baseClass);
            }
          });
        }
      }
    }

    // Extract from string literals (potential dynamic classes)
    const stringMatches = content.matchAll(/["']([a-zA-Z_][\w-]*)["']/g);
    for (const match of stringMatches) {
      const candidate = match[1];
      if (candidate.includes("-") && definedClasses.has(candidate)) {
        usedClasses.add(candidate);
      }
    }
  }

  // Find unused classes
  const unusedClasses = [];
  for (const className of definedClasses) {
    if (!usedClasses.has(className) && !whitelist.has(className)) {
      // Check for partial matches (e.g., footer-* variants)
      let partialMatch = false;
      for (const used of usedClasses) {
        if (used.startsWith(className) || className.startsWith(used)) {
          partialMatch = true;
          break;
        }
      }

      if (!partialMatch) {
        unusedClasses.push({
          type: "css-class",
          name: className,
          files: classLocations.get(className) || [],
          severity: "medium",
          suggestion: `Remove .${className} from ${classLocations.get(className)?.[0] || "CSS files"}`,
        });
      }
    }
  }

  return unusedClasses;
}

// ===== JAVASCRIPT ANALYZER v5.0 =====
async function analyzeJSFunctions(files, config) {
  const jsFiles = files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return (
      [".js", ".jsx", ".ts", ".tsx"].includes(ext) &&
      !f.includes("node_modules") &&
      !f.includes(".min.js")
    );
  });

  const definedFunctions = new Map();
  const whitelist = new Set(config.jsWhitelist);

  // Extract function definitions
  for (const jsFile of jsFiles) {
    const content = await readText(jsFile);
    const fileName = path.relative(config.rootDir, jsFile);

    const patterns = [
      /function\s+([a-zA-Z0-9_$]+)\s*\(/g,
      /const\s+([a-zA-Z0-9_$]+)\s*=\s*function/g,
      /const\s+([a-zA-Z0-9_$]+)\s*=\s*\([^)]*\)\s*=>/g,
      /let\s+([a-zA-Z0-9_$]+)\s*=\s*\([^)]*\)\s*=>/g,
      /var\s+([a-zA-Z0-9_$]+)\s*=\s*function/g,
      /async\s+function\s+([a-zA-Z0-9_$]+)\s*\(/g,
      /function\*\s+([a-zA-Z0-9_$]+)\s*\(/g,
      // React hooks
      /const\s+use([A-Z][a-zA-Z0-9]*)\s*=/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content))) {
        const funcName = match[1];

        // Skip event handlers and private functions
        if (
          funcName.startsWith("_") ||
          funcName.includes("Handler") ||
          funcName.includes("Listener") ||
          funcName.startsWith("on") ||
          funcName.startsWith("handle") ||
          funcName.length <= 1
        ) {
          continue;
        }

        if (!definedFunctions.has(funcName)) {
          definedFunctions.set(funcName, []);
        }
        definedFunctions.get(funcName).push(fileName);
      }
    }
  }

  // Find function usages
  const usedFunctions = new Set();

  for (const jsFile of jsFiles) {
    const content = await readText(jsFile);

    for (const funcName of definedFunctions.keys()) {
      const patterns = [
        new RegExp(`\\b${funcName}\\s*\\(`, "g"),
        new RegExp(`\\b${funcName}\\s*,`, "g"),
        new RegExp(`\\b${funcName}\\s*}`, "g"),
        new RegExp(`addEventListener\\([^,]+,\\s*${funcName}`, "g"),
        new RegExp(`removeEventListener\\([^,]+,\\s*${funcName}`, "g"),
        new RegExp(`(?:setTimeout|setInterval)\\(${funcName}`, "g"),
        new RegExp(`(?:then|catch|finally)\\(${funcName}\\)`, "g"),
        new RegExp(`export.*\\b${funcName}\\b`, "g"),
        new RegExp(`{\\s*${funcName}\\s*[,}]`, "g"), // Destructuring
      ];

      for (const pattern of patterns) {
        if (pattern.test(content)) {
          usedFunctions.add(funcName);
          break;
        }
      }
    }
  }

  // Find unused functions
  const unusedFunctions = [];
  for (const [funcName, locations] of definedFunctions) {
    if (!usedFunctions.has(funcName) && !whitelist.has(funcName)) {
      unusedFunctions.push({
        type: "js-function",
        name: funcName,
        files: locations,
        severity: "low",
        suggestion: `Consider removing ${funcName}() from ${locations[0]}`,
      });
    }
  }

  return unusedFunctions;
}

// ===== STATISTICS CALCULATOR =====
async function calculateStatistics(findings, files) {
  let totalSize = 0;
  const assetFindings = findings.filter((f) => f.type === "asset");

  for (const finding of assetFindings) {
    try {
      const stat = await fs.stat(finding.absPath);
      totalSize += stat.size;
      finding.size = stat.size;
    } catch {
      finding.size = 0;
    }
  }

  return {
    totalFiles: files.length,
    totalFindings: findings.length,
    unusedAssets: assetFindings.length,
    unusedClasses: findings.filter((f) => f.type === "css-class").length,
    unusedFunctions: findings.filter((f) => f.type === "js-function").length,
    totalUnusedSize: totalSize,
    totalUnusedSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    severityBreakdown: {
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
    },
  };
}

// ===== OUTPUT FORMATTERS =====
async function outputConsole(findings, stats, config) {
  console.log("\n" + colorize("═".repeat(70), "cyan"));
  console.log(colorize("🔍 Dead Code Scanner v5.0 - Results", "bright"));
  console.log(colorize("═".repeat(70), "cyan") + "\n");

  // Statistics
  console.log(colorize("📊 Statistics:", "bright"));
  console.log(`   Total files scanned: ${colorize(stats.totalFiles, "cyan")}`);
  console.log(`   Total findings: ${colorize(stats.totalFindings, "yellow")}`);
  console.log(`   Unused assets: ${colorize(stats.unusedAssets, "red")}`);
  console.log(`   Unused CSS classes: ${colorize(stats.unusedClasses, "red")}`);
  console.log(
    `   Unused JS functions: ${colorize(stats.unusedFunctions, "red")}`
  );
  console.log(
    `   Potential space saving: ${colorize(stats.totalUnusedSizeMB + " MB", "green")}\n`
  );

  console.log(colorize("🎯 Severity Breakdown:", "bright"));
  console.log(
    `   ${colorize("●", "red")} High: ${stats.severityBreakdown.high}`
  );
  console.log(
    `   ${colorize("●", "yellow")} Medium: ${stats.severityBreakdown.medium}`
  );
  console.log(
    `   ${colorize("●", "blue")} Low: ${stats.severityBreakdown.low}\n`
  );

  // Group findings by type
  const assets = findings.filter((f) => f.type === "asset");
  const classes = findings.filter((f) => f.type === "css-class");
  const functions = findings.filter((f) => f.type === "js-function");

  // Display Assets
  if (assets.length > 0) {
    console.log(colorize("🧹 Unused Assets:", "bright"));
    const grouped = new Map();

    for (const asset of assets.slice(0, 20)) {
      const dir = path.dirname(asset.path);
      if (!grouped.has(dir)) grouped.set(dir, []);
      grouped.get(dir).push(asset);
    }

    for (const [dir, items] of grouped) {
      console.log(colorize(`\n📁 ${dir}`, "blue"));
      for (const item of items) {
        const sizeMB = ((item.size || 0) / 1024).toFixed(2);
        const severityColor =
          item.severity === "high"
            ? "red"
            : item.severity === "medium"
              ? "yellow"
              : "gray";
        console.log(
          `   ${colorize("●", severityColor)} ${item.path} ${colorize(`(${sizeMB} KB)`, "gray")}`
        );
      }
    }

    if (assets.length > 20) {
      console.log(
        colorize(`\n   ... and ${assets.length - 20} more\n`, "gray")
      );
    }
  }

  // Display CSS Classes
  if (classes.length > 0) {
    console.log(colorize("\n🎨 Unused CSS Classes:", "bright"));
    for (const cls of classes.slice(0, 20)) {
      console.log(`   ${colorize("●", "yellow")} .${cls.name}`);
      console.log(colorize(`      in: ${cls.files.join(", ")}`, "gray"));
      if (config.showSuggestions && cls.suggestion) {
        console.log(colorize(`      💡 ${cls.suggestion}`, "cyan"));
      }
    }

    if (classes.length > 20) {
      console.log(
        colorize(`\n   ... and ${classes.length - 20} more\n`, "gray")
      );
    }
  }

  // Display JS Functions
  if (functions.length > 0) {
    console.log(colorize("\n🔧 Unused JavaScript Functions:", "bright"));
    for (const func of functions.slice(0, 20)) {
      console.log(`   ${colorize("●", "blue")} ${func.name}()`);
      console.log(colorize(`      in: ${func.files.join(", ")}`, "gray"));
      if (config.showSuggestions && func.suggestion) {
        console.log(colorize(`      💡 ${func.suggestion}`, "cyan"));
      }
    }

    if (functions.length > 20) {
      console.log(
        colorize(`\n   ... and ${functions.length - 20} more\n`, "gray")
      );
    }
  }

  if (findings.length === 0) {
    console.log(
      colorize("🎉 No dead code found - Your project is clean!", "green")
    );
  }

  console.log("\n" + colorize("═".repeat(70), "cyan") + "\n");
}

async function outputJSON(findings, stats, config) {
  const output = {
    version: "5.0",
    timestamp: new Date().toISOString(),
    statistics: stats,
    findings: findings,
  };

  const json = JSON.stringify(output, null, 2);

  if (config.outputFile) {
    await fs.writeFile(config.outputFile, json);
    console.log(
      colorize(`✅ JSON report saved to: ${config.outputFile}`, "green")
    );
  } else {
    console.log(json);
  }
}

async function outputHTML(findings, stats, config) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dead Code Scanner Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { font-size: 2em; margin-bottom: 10px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px; }
    .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; }
    .stat-card h3 { color: #666; font-size: 0.9em; text-transform: uppercase; margin-bottom: 10px; }
    .stat-card .value { font-size: 2em; font-weight: bold; color: #333; }
    .findings { padding: 0 30px 30px; }
    .finding-group { margin-bottom: 30px; }
    .finding-group h2 { color: #333; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #eee; }
    .finding { background: #f8f9fa; padding: 15px; margin-bottom: 10px; border-radius: 5px; border-left: 4px solid #ffc107; }
    .finding.high { border-left-color: #dc3545; }
    .finding.medium { border-left-color: #ffc107; }
    .finding.low { border-left-color: #17a2b8; }
    .finding-name { font-weight: bold; color: #333; margin-bottom: 5px; }
    .finding-detail { color: #666; font-size: 0.9em; }
    .suggestion { background: #e3f2fd; padding: 10px; margin-top: 10px; border-radius: 3px; color: #1976d2; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 Dead Code Scanner Report</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="stats">
      <div class="stat-card">
        <h3>Files Scanned</h3>
        <div class="value">${stats.totalFiles}</div>
      </div>
      <div class="stat-card">
        <h3>Total Findings</h3>
        <div class="value">${stats.totalFindings}</div>
      </div>
      <div class="stat-card">
        <h3>Unused Assets</h3>
        <div class="value">${stats.unusedAssets}</div>
      </div>
      <div class="stat-card">
        <h3>Unused Classes</h3>
        <div class="value">${stats.unusedClasses}</div>
      </div>
      <div class="stat-card">
        <h3>Unused Functions</h3>
        <div class="value">${stats.unusedFunctions}</div>
      </div>
      <div class="stat-card">
        <h3>Space Saving</h3>
        <div class="value">${stats.totalUnusedSizeMB} MB</div>
      </div>
    </div>

    <div class="findings">
      ${findings.length === 0 ? '<p style="text-align:center;color:#28a745;font-size:1.5em;padding:40px;">🎉 No dead code found!</p>' : ""}
      
      ${
        findings.filter((f) => f.type === "asset").length > 0
          ? `
      <div class="finding-group">
        <h2>🧹 Unused Assets (${findings.filter((f) => f.type === "asset").length})</h2>
        ${findings
          .filter((f) => f.type === "asset")
          .slice(0, 50)
          .map(
            (f) => `
          <div class="finding ${f.severity}">
            <div class="finding-name">${f.path}</div>
            <div class="finding-detail">Size: ${((f.size || 0) / 1024).toFixed(2)} KB | Severity: ${f.severity}</div>
          </div>
        `
          )
          .join("")}
      </div>
      `
          : ""
      }

      ${
        findings.filter((f) => f.type === "css-class").length > 0
          ? `
      <div class="finding-group">
        <h2>🎨 Unused CSS Classes (${findings.filter((f) => f.type === "css-class").length})</h2>
        ${findings
          .filter((f) => f.type === "css-class")
          .slice(0, 50)
          .map(
            (f) => `
          <div class="finding ${f.severity}">
            <div class="finding-name">.${f.name}</div>
            <div class="finding-detail">Found in: ${f.files.join(", ")}</div>
            ${f.suggestion ? `<div class="suggestion">💡 ${f.suggestion}</div>` : ""}
          </div>
        `
          )
          .join("")}
      </div>
      `
          : ""
      }

      ${
        findings.filter((f) => f.type === "js-function").length > 0
          ? `
      <div class="finding-group">
        <h2>🔧 Unused JavaScript Functions (${findings.filter((f) => f.type === "js-function").length})</h2>
        ${findings
          .filter((f) => f.type === "js-function")
          .slice(0, 50)
          .map(
            (f) => `
          <div class="finding ${f.severity}">
            <div class="finding-name">${f.name}()</div>
            <div class="finding-detail">Found in: ${f.files.join(", ")}</div>
            ${f.suggestion ? `<div class="suggestion">💡 ${f.suggestion}</div>` : ""}
          </div>
        `
          )
          .join("")}
      </div>
      `
          : ""
      }
    </div>
  </div>
</body>
</html>
`;

  const outputPath =
    config.outputFile || path.join(config.rootDir, "dead-code-report.html");
  await fs.writeFile(outputPath, html);
  console.log(colorize(`✅ HTML report saved to: ${outputPath}`, "green"));
}

async function outputMarkdown(findings, stats, config) {
  let md = "# 🔍 Dead Code Scanner Report\n\n";
  md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
  md += "## 📊 Statistics\n\n";
  md += "| Metric | Value |\n";
  md += "|--------|-------|\n";
  md += `| Files Scanned | ${stats.totalFiles} |\n`;
  md += `| Total Findings | ${stats.totalFindings} |\n`;
  md += `| Unused Assets | ${stats.unusedAssets} |\n`;
  md += `| Unused CSS Classes | ${stats.unusedClasses} |\n`;
  md += `| Unused JS Functions | ${stats.unusedFunctions} |\n`;
  md += `| Space Saving | ${stats.totalUnusedSizeMB} MB |\n\n`;

  md += "## 🎯 Severity Breakdown\n\n";
  md += `- 🔴 High: ${stats.severityBreakdown.high}\n`;
  md += `- 🟡 Medium: ${stats.severityBreakdown.medium}\n`;
  md += `- 🔵 Low: ${stats.severityBreakdown.low}\n\n`;

  const assets = findings.filter((f) => f.type === "asset");
  if (assets.length > 0) {
    md += `## 🧹 Unused Assets (${assets.length})\n\n`;
    for (const asset of assets.slice(0, 50)) {
      md += `- \`${asset.path}\` - ${((asset.size || 0) / 1024).toFixed(2)} KB (${asset.severity})\n`;
    }
    md += "\n";
  }

  const classes = findings.filter((f) => f.type === "css-class");
  if (classes.length > 0) {
    md += `## 🎨 Unused CSS Classes (${classes.length})\n\n`;
    for (const cls of classes.slice(0, 50)) {
      md += `- \`.${cls.name}\` in ${cls.files.join(", ")}\n`;
      if (cls.suggestion) {
        md += `  - 💡 ${cls.suggestion}\n`;
      }
    }
    md += "\n";
  }

  const functions = findings.filter((f) => f.type === "js-function");
  if (functions.length > 0) {
    md += `## 🔧 Unused JavaScript Functions (${functions.length})\n\n`;
    for (const func of functions.slice(0, 50)) {
      md += `- \`${func.name}()\` in ${func.files.join(", ")}\n`;
      if (func.suggestion) {
        md += `  - 💡 ${func.suggestion}\n`;
      }
    }
    md += "\n";
  }

  if (findings.length === 0) {
    md += "## 🎉 Result\n\nNo dead code found - Your project is clean!\n";
  }

  const outputPath =
    config.outputFile || path.join(config.rootDir, "dead-code-report.md");
  await fs.writeFile(outputPath, md);
  console.log(colorize(`✅ Markdown report saved to: ${outputPath}`, "green"));
}

// ===== MAIN EXECUTION =====
(async function main() {
  try {
    const startTime = Date.now();

    console.log(
      colorize("\n🚀 Dead Code Scanner v5.0 (Enhanced Edition)", "bright")
    );
    console.log(colorize("━".repeat(50), "gray") + "\n");

    // Load configuration
    const config = await loadConfig();

    if (config.verbose) {
      console.log(colorize("⚙️ Configuration loaded", "cyan"));
    }

    // Initialize cache
    const cache = new Cache(config);

    // Collect files
    console.log(colorize("📁 Collecting files...", "cyan"));
    const files = await collectFiles(config);
    console.log(colorize(`   Found ${files.length} files\n`, "gray"));

    // Build reference index
    console.log(colorize("🔗 Building reference index...", "cyan"));
    const refs = await buildReferenceIndex(files, config);
    console.log(colorize(`   Found ${refs.size} references\n`, "gray"));

    // Analyze assets
    console.log(colorize("🔍 Analyzing assets...", "cyan"));
    const unusedAssets = analyzeAssets(files, refs, config);
    console.log(
      colorize(`   Found ${unusedAssets.length} unused assets\n`, "gray")
    );

    // Analyze CSS classes
    console.log(colorize("🎨 Analyzing CSS classes...", "cyan"));
    const unusedClasses = await analyzeCSSClasses(files, config);
    console.log(
      colorize(`   Found ${unusedClasses.length} unused classes\n`, "gray")
    );

    // Analyze JS functions
    console.log(colorize("🔧 Analyzing JavaScript functions...", "cyan"));
    const unusedFunctions = await analyzeJSFunctions(files, config);
    console.log(
      colorize(`   Found ${unusedFunctions.length} unused functions\n`, "gray")
    );

    // Combine findings
    const allFindings = [...unusedAssets, ...unusedClasses, ...unusedFunctions];

    // Calculate statistics
    const stats = await calculateStatistics(allFindings, files);

    // Output results
    switch (config.outputFormat) {
      case "json":
        await outputJSON(allFindings, stats, config);
        break;
      case "html":
        await outputHTML(allFindings, stats, config);
        break;
      case "markdown":
        await outputMarkdown(allFindings, stats, config);
        break;
      default:
        await outputConsole(allFindings, stats, config);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(colorize(`⏱️ Scan completed in ${elapsed}s`, "green"));

    // Save cache
    await cache.save({
      timestamp: Date.now(),
      findings: allFindings.length,
      stats,
    });
  } catch (error) {
    console.error(colorize(`\n❌ Fatal error: ${error.message}`, "red"));
    if (error.stack) {
      console.error(colorize(error.stack, "gray"));
    }
    process.exit(1);
  }
})();
