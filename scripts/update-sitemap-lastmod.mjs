#!/usr/bin/env node

/**
 * Script to update sitemap.xml lastmod dates based on Git commit history
 * Usage: node scripts/update-sitemap-lastmod.mjs
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

function getLastModifiedDate(filePath) {
  try {
    // Get the last commit date for this file
    const gitLog = execSync(`git log -1 --format=%ci -- "${filePath}"`, {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();

    if (gitLog) {
      // Convert Git date format (ISO 8601) to YYYY-MM-DD
      const date = new Date(gitLog);
      return date.toISOString().split("T")[0];
    }
  } catch (error) {
    console.warn(`Could not get git date for ${filePath}:`, error.message);
  }

  // Fallback to current date
  return new Date().toISOString().split("T")[0];
}

function updateSitemap() {
  const sitemapPath = join(projectRoot, "sitemap.xml");
  let sitemapContent = readFileSync(sitemapPath, "utf8");

  // Find all URLs in sitemap and update their lastmod dates
  const urlRegex = /<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g;

  sitemapContent = sitemapContent.replace(
    urlRegex,
    (match, url, currentLastmod) => {
      // Extract the path from the URL (remove domain)
      const urlObj = new URL(url);
      let filePath = urlObj.pathname;

      // Remove trailing slash for directory index files
      if (filePath.endsWith("/")) {
        filePath = filePath.slice(0, -1);
      }

      // Map URL paths to actual file paths
      if (filePath === "") {
        filePath = "index.html";
      } else if (filePath === "/datenschutz") {
        filePath = "datenschutz/index.html";
      } else if (filePath === "/impressum") {
        filePath = "impressum/index.html";
      } else if (filePath.startsWith("/pages/")) {
        filePath = filePath.substring(1); // Remove leading slash
        if (!filePath.endsWith(".html") && !filePath.includes("#")) {
          filePath += "/index.html";
        }
      } else if (!filePath.includes(".") && !filePath.includes("#")) {
        filePath = `pages${filePath}/index.html`;
      }

      const newLastmod = getLastModifiedDate(filePath);
      console.log(`Updating ${url}: ${currentLastmod} -> ${newLastmod}`);

      return match.replace(currentLastmod, newLastmod);
    },
  );

  writeFileSync(sitemapPath, sitemapContent, "utf8");
  console.log("Sitemap lastmod dates updated successfully!");
}

updateSitemap();
