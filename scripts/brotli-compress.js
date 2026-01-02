#!/usr/bin/env node

/**
 * Brotli Compression Script
 * Erzeugt .br-Dateien für große JavaScript-Bundles
 * Wird von Servern (Cloudflare, Nginx) genutzt um komprimierte Versionen zu serven
 *
 * @usage npm run build:brotli
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// Dateien die mit Brotli komprimiert werden sollen
const filesToCompress = [
  "content/vendor/three/three.module.js",
  "content/components/typewriter/TypeWriter.js",
  "content/components/footer/footer-complete.js",
  "content/components/particles/three-earth-system.js",
  "content/main.js",
];

// Brotli Kompression-Optionen (höchste Qualität für geringe Größe)
const brotliOptions = {
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: 11, // Max quality (very slow, best compression)
    [zlib.constants.BROTLI_PARAM_LGWIN]: 24, // Max window size
  },
};

/**
 * Compress a single file with Brotli
 */
async function compressFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  const brPath = fullPath + ".br";

  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return false;
  }

  return new Promise((resolve) => {
    const input = fs.createReadStream(fullPath);
    const output = fs.createWriteStream(brPath);

    const brotli = zlib.createBrotliCompress(brotliOptions);

    input
      .pipe(brotli)
      .pipe(output)
      .on("finish", () => {
        const originalStats = fs.statSync(fullPath);
        const compressedStats = fs.statSync(brPath);
        const ratio = (
          (1 - compressedStats.size / originalStats.size) *
          100
        ).toFixed(1);

        console.log(
          `✅ Compressed: ${filePath}`,
          `${(originalStats.size / 1024).toFixed(2)} KiB → ${(
            compressedStats.size / 1024
          ).toFixed(2)} KiB (${ratio}% reduction)`
        );
        resolve(true);
      })
      .on("error", (error) => {
        console.error(`❌ Compression failed for ${filePath}:`, error.message);
        resolve(false);
      });
  });
}

/**
 * Main compression function
 */
async function compress() {
  console.log("🗜️  Starting Brotli compression...\n");

  let successCount = 0;
  let failureCount = 0;

  for (const file of filesToCompress) {
    const success = await compressFile(file);
    if (success) successCount++;
    else failureCount++;
  }

  console.log("\n" + "=".repeat(60));
  console.log(
    `✨ Compression complete: ${successCount} successful, ${failureCount} failed`
  );
  console.log("=".repeat(60));

  if (successCount > 0) {
    console.log("\n✅ Brotli files created successfully!");
    console.log("\n📝 Server Configuration Guide:");
    console.log("");
    console.log(
      "For Cloudflare Workers or modern servers, add this to your headers:"
    );
    console.log("");
    console.log("  Content-Encoding: br");
    console.log("  Vary: Accept-Encoding");
    console.log("");
    console.log("For Nginx:");
    console.log("");
    console.log("  gzip on;");
    console.log("  gzip_static on; # Serve .gz files if available");
    console.log("  gzip_vary on;");
    console.log("");
    console.log("For Apache:");
    console.log("");
    console.log('  <FilesMatch "\\.js\\.br$">');
    console.log("    Header set Content-Encoding br");
    console.log('    Header set Content-Type "application/javascript"');
    console.log("  </FilesMatch>");
    console.log("");
    console.log("Deploy: Upload both .js and .js.br files to production");
  }
}

// Run compression
compress().catch((error) => {
  console.error("Fatal compression error:", error);
  process.exit(1);
});
