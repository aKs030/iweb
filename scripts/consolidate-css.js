#!/usr/bin/env node

import { readFile, writeFile } from "fs/promises";
import { glob } from "glob";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

async function consolidateCss() {
  try {
    console.log("🔄 Konsolidiere CSS Custom Properties...\n");

    const rootCssPath = join(projectRoot, "content/webentwicklung/root.css");

    // Find all CSS files except root.css
    const cssFiles = await glob("**/*.css", {
      cwd: projectRoot,
      ignore: ["node_modules/**", ".git/**", "content/webentwicklung/root.css"],
    });

    let rootCssContent = await readFile(rootCssPath, "utf8");
    const customPropertyRegex = /^\s*--[\w-]+\s*:[^;]+;/gm;
    let totalMoved = 0;

    for (const file of cssFiles) {
      const filePath = join(projectRoot, file);
      const content = await readFile(filePath, "utf8");
      const matches = content.match(customPropertyRegex);

      if (matches && matches.length > 0) {
        console.log(`📄 ${file}: ${matches.length} Properties gefunden`);

        // Add properties to root.css if not already present
        for (const property of matches) {
          const propName = property.match(/--[\w-]+/)[0];

          if (!rootCssContent.includes(propName)) {
            // Find the :root section and add the property
            const rootSectionMatch = rootCssContent.match(/(:root\s*{[^}]*)/);
            if (rootSectionMatch) {
              const newRootSection =
                rootSectionMatch[1] + "\n  " + property.trim();
              rootCssContent = rootCssContent.replace(
                rootSectionMatch[1],
                newRootSection
              );
            } else {
              // Create :root section if it doesn't exist
              rootCssContent =
                `:root {\n  ${property.trim()}\n}\n\n` + rootCssContent;
            }
            totalMoved++;
          }
        }

        // Remove properties from original file
        const cleanedContent = content.replace(customPropertyRegex, "");
        await writeFile(filePath, cleanedContent, "utf8");
      }
    }

    // Write updated root.css
    await writeFile(rootCssPath, rootCssContent, "utf8");

    console.log("\n✅ Konsolidierung abgeschlossen!");
    console.log(`📊 ${totalMoved} Properties nach root.css verschoben`);
  } catch (error) {
    console.error("❌ Fehler bei der CSS Konsolidierung:", error);
    process.exit(1);
  }
}

consolidateCss();
