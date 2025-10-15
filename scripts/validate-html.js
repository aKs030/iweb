#!/usr/bin/env node

import { readFile } from "fs/promises";
import { glob } from "glob";
import { HtmlValidate } from "html-validate";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

const htmlvalidate = new HtmlValidate({
  extends: ["html-validate:recommended"],
  rules: {
    "void-style": "off", // Allow self-closing tags
    "no-trailing-whitespace": "off", // Allow trailing whitespace
    "element-required-attributes": "off", // Allow missing attributes
    "meta-refresh": "off", // Allow meta refresh
    "no-inline-style": "off", // Allow inline styles
    "script-element": "off", // Allow script elements
  },
});

async function validateSingleFile(file, filePath, isQuiet) {
  try {
    const content = await readFile(filePath, "utf8");
    const report = htmlvalidate.validateString(content, filePath);

    if (report.valid) {
      if (!isQuiet) {
        console.log(`✅ ${file} - Valide`);
      }
      return { errors: 0, warnings: 0 };
    } else {
      console.log(`❌ ${file} - Fehler gefunden:`);

      let fileErrors = 0;
      let fileWarnings = 0;

      // Handle both array and single result
      const results = Array.isArray(report.results) ? report.results : [report];

      for (const result of results) {
        const messages = result.messages || [];
        for (const message of messages) {
          const severity = message.severity === 2 ? "ERROR" : "WARNING";
          const icon = message.severity === 2 ? "🚨" : "⚠️";

          console.log(
            `   ${icon} [${severity}] Zeile ${message.line}:${message.column} - ${message.message} (${message.ruleId})`
          );

          if (message.severity === 2) {
            fileErrors++;
          } else {
            fileWarnings++;
          }
        }
      }
      console.log();
      return { errors: fileErrors, warnings: fileWarnings };
    }
  } catch (error) {
    console.error(`❌ Fehler beim Lesen von ${file}:`, error.message);
    return { errors: 1, warnings: 0 };
  }
}

async function validateHtmlFiles() {
  try {
    const args = new Set(process.argv.slice(2));
    const isQuiet = args.has("--quiet") || args.has("--ci");
    const includeReports = args.has("--include-reports");
    const isVerbose = args.has("--verbose");

    if (isVerbose) {
      console.log("🔊 HTML Validate läuft im Verbose-Modus\n");
    }

    const patterns = ["index.html", "pages/**/*.html", "content/**/*.html"];
    const ignore = [
      "node_modules/**",
      ".git/**",
      "content/webentwicklung/lib/**",
      "docs/**",
      includeReports ? null : "reports/**",
    ].filter(Boolean);

    const matchedFiles = (
      await Promise.all(
        patterns.map((pattern) =>
          glob(pattern, {
            cwd: projectRoot,
            ignore,
            nodir: true,
          })
        )
      )
    ).flat();

    const htmlFiles = [...new Set(matchedFiles)].sort();

    console.log(`\n🔍 HTML Validation für ${htmlFiles.length} Dateien...\n`);

    let totalErrors = 0;
    let totalWarnings = 0;

    for (const file of htmlFiles) {
      const filePath = join(projectRoot, file);
      const result = await validateSingleFile(
        file,
        filePath,
        isQuiet && !isVerbose
      );
      totalErrors += result.errors;
      totalWarnings += result.warnings;
    }

    console.log("\n📊 Zusammenfassung:");
    console.log(`   Dateien geprüft: ${htmlFiles.length}`);
    console.log(`   Fehler: ${totalErrors}`);
    console.log(`   Warnungen: ${totalWarnings}`);

    if (totalErrors > 0) {
      console.log("\n❌ HTML Validation fehlgeschlagen!");
      process.exit(1);
    } else {
      console.log("\n✅ Alle HTML-Dateien sind valide!");
    }
  } catch (error) {
    console.error("❌ Unerwarteter Fehler:", error);
    process.exit(1);
  }
}

validateHtmlFiles();
