#!/usr/bin/env node

/**
 * Three.js Feature Analysis & Tree-shaking Guide
 *
 * Dieses Script analysiert welche Three.js Features tatsächlich genutzt werden
 * und gibt Empfehlungen für Custom Three.js Builds.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Analysiere welche Three.js Features in der Codebase genutzt werden
 */
function analyzeThreeJSUsage() {
  const threeEarthDir = path.join(
    process.cwd(),
    "content/components/particles/earth"
  );
  const mainFile = path.join(
    process.cwd(),
    "content/components/particles/three-earth-system.js"
  );

  const threePatterns = [
    "THREE\\.Scene",
    "THREE\\.Camera|THREE\\.PerspectiveCamera|THREE\\.OrthographicCamera",
    "THREE\\.WebGLRenderer",
    "THREE\\.Mesh",
    "THREE\\.Geometry|THREE\\.BufferGeometry",
    "THREE\\.Material|THREE\\.MeshPhongMaterial|THREE\\.MeshBasicMaterial",
    "THREE\\.Light|THREE\\.PointLight|THREE\\.AmbientLight|THREE\\.DirectionalLight",
    "THREE\\.Texture|THREE\\.TextureLoader",
    "THREE\\.Vector3|THREE\\.Vector2",
    "THREE\\.Raycaster",
    "THREE\\.Object3D",
    "THREE\\.Group",
    "THREE\\.Sphere|THREE\\.SphereGeometry",
  ];

  const usedFeatures = new Set();

  // Scan all JavaScript files in earth/ directory
  const files = fs.readdirSync(threeEarthDir).filter((f) => f.endsWith(".js"));
  files.push(path.basename(mainFile));

  files.forEach((file) => {
    const filePath =
      file === path.basename(mainFile)
        ? mainFile
        : path.join(threeEarthDir, file);

    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, "utf-8");

    threePatterns.forEach((pattern) => {
      if (new RegExp(pattern).test(content)) {
        usedFeatures.add(pattern);
      }
    });
  });

  return usedFeatures;
}

/**
 * Estimate bundle size savings with different optimization levels
 */
function estimateSavings(usedFeatureCounts) {
  const baseSize = 1276.8; // KiB (three.module.js)

  return {
    "No optimization": {
      size: baseSize,
      savings: 0,
      description: "Unminified three.module.js",
    },
    "esbuild minification": {
      size: baseSize * 0.31,
      savings: 69,
      description: "Minify existing module (current npm run build)",
    },
    "Terser aggressive": {
      size: baseSize * 0.28,
      savings: 72,
      description: "Terser with aggressive minification",
    },
    "Custom build (estimated)": {
      size: baseSize * 0.15,
      savings: 85,
      description: "Custom Three.js build with ~3-5 features",
    },
    "Custom build + Brotli": {
      size: baseSize * 0.1,
      savings: 90,
      description: "Custom build + Brotli compression",
    },
  };
}

function main() {
  console.log("📊 Three.js Feature Analysis\n");
  console.log("=".repeat(60) + "\n");

  // Analyze usage
  const usedFeatures = analyzeThreeJSUsage();

  console.log("✅ Detected Three.js Features:\n");
  Array.from(usedFeatures)
    .sort()
    .forEach((feature) => {
      console.log(`  • ${feature}`);
    });

  console.log(`\n✨ Total: ${usedFeatures.size} feature patterns detected\n`);

  // Show savings estimates
  console.log("=".repeat(60));
  console.log("📈 Bundle Size Optimization Estimates\n");

  const savings = estimateSavings(usedFeatures.size);
  Object.entries(savings).forEach(([method, stats]) => {
    const percent = (stats.savings / 100).toFixed(0);
    console.log(`${method}`);
    console.log(
      `  Size: ${stats.size.toFixed(0)} KiB (${stats.savings}% smaller)`
    );
    console.log(`  ${stats.description}\n`);
  });

  console.log("=".repeat(60));
  console.log("🔧 Recommended Next Steps\n");

  console.log("1. For immediate improvements (no build complexity):");
  console.log("   ✓ Run: npm run build");
  console.log("   ✓ This minifies critical files with esbuild\n");

  console.log("2. For production (recommended):");
  console.log("   ✓ Run: npm run build:brotli");
  console.log("   ✓ Deploy .br files alongside original files\n");

  console.log("3. For maximum compression (requires development time):");
  console.log("   ✓ Create custom Three.js build with only needed features");
  console.log("   ✓ Estimated additional savings: 15-20% of current bundle\n");

  console.log("📚 Custom Three.js Build Guide:");
  console.log(
    "   https://threejs.org/docs/#manual/en/introduction/Building-lightweight-apps\n"
  );
}

if (require.main === module) {
  main();
}

module.exports = { analyzeThreeJSUsage, estimateSavings };
