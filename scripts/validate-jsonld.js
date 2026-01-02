#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const files = [
  path.resolve(__dirname, "..", "index.html"),
  path.resolve(__dirname, "..", "pages", "about", "index.html"),
  path.resolve(__dirname, "..", "sitemap-images.xml"),
];
let ok = true;
const scriptRegex =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
files.forEach((file) => {
  try {
    const content = fs.readFileSync(file, "utf8");
    let match;
    let idx = 0;
    while ((match = scriptRegex.exec(content)) !== null) {
      idx += 1;
      const raw = match[1].trim();
      try {
        JSON.parse(raw);
        console.log(
          `OK: ${path.relative(process.cwd(), file)} script#${idx} parsed`
        );
      } catch (e) {
        ok = false;
        console.error(
          `ERROR: ${path.relative(
            process.cwd(),
            file
          )} script#${idx} failed to parse:`
        );
        console.error(e.message);
        const snippet =
          raw.substring(0, 500) + (raw.length > 500 ? "... (truncated)" : "");
        console.error(snippet);
      }
    }
    if (idx === 0)
      console.log(
        `NOTICE: ${path.relative(process.cwd(), file)} no ld+json scripts found`
      );
  } catch (e) {
    ok = false;
    console.error(`ERROR: Unable to read ${file}: ${e.message}`);
  }
});
process.exit(ok ? 0 : 1);
