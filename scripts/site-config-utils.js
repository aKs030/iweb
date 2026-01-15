const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Load an ES module-style config file that uses `export const ...` by
// transforming exports to `module.exports` and evaluating in a VM.
// This keeps the loader synchronous and avoids enabling full ESM support.
function loadSiteConfig(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error('site-config not found: ' + abs);

  const src = fs.readFileSync(abs, 'utf8');

  // Replace `export const NAME =` with `module.exports.NAME =`
  const transformed = src.replace(/export\s+const\s+([A-Za-z0-9_]+)\s*=/g, 'module.exports.$1 =');

  // Debug: show a preview of the transformed code when running locally
  // (removed in final change)
  // console.log('TRANSFORMED_PREVIEW:\n', transformed.slice(0, 400));

  const sandbox = { module: { exports: {} }, exports: {} , require, __dirname: path.dirname(abs), __filename: abs, console };
  vm.createContext(sandbox);

  try {
    vm.runInContext(transformed, sandbox, { filename: abs });
  } catch (err) {
    throw new Error('Failed to evaluate site-config: ' + err.message);
  }

  if (!sandbox.module.exports.SITE_CONFIG) {
    throw new Error('SITE_CONFIG not found in ' + abs);
  }

  return sandbox.module.exports.SITE_CONFIG;
}

module.exports = { loadSiteConfig };