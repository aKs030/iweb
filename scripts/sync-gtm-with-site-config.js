#!/usr/bin/env node
// Sync GTM container JSONs with content/config/site-config.js
// - Finds host entries in site-config.js by loading the JS file via a safe VM evaluation
// - Matches GTM publicId values to hosts (site-config .. .gtm)
// - Ensures container name includes host and consistent suffix
// - Ensures GA/AW variables are dataLayer based and use the expected DL names

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { info, warn, error } = require('./log');

const ROOT = path.resolve(__dirname, '..');
const SITE_CFG_PATH = path.join(ROOT, 'content', 'config', 'site-config.js');
const GTM_FILES = [
  path.join(ROOT, 'gtm-container-abdulkerimsesli.json'),
  path.join(ROOT, 'gtm-container-meine-webseite.json'),
];

function loadSiteConfig() {
  // Read file and extract object literal by counting braces to avoid relying on ESM import.
  const src = fs.readFileSync(SITE_CFG_PATH, 'utf8');
  const marker = 'export const SITE_CONFIG =';
  const idx = src.indexOf(marker);
  if (idx < 0) throw new Error('site-config.js format not recognized');
  const after = src.slice(idx + marker.length);
  const firstBrace = after.indexOf('{');
  if (firstBrace < 0) throw new Error('Could not find opening brace for object');
  let i = firstBrace;
  let depth = 0;
  for (; i < after.length; i++) {
    const ch = after[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        // include the closing brace
        const objectText = after.slice(firstBrace, i + 1);
        // Evaluate the object text in a VM with limited globals
        const wrapper = `(function(){ return (${objectText}); })()`;
        const sandbox = {};
        try {
          const res = vm.runInNewContext(wrapper, sandbox, { filename: SITE_CFG_PATH });
          return res;
        } catch (err) {
          throw new Error('Failed to evaluate site-config.js object: ' + err.message);
        }
      }
    }
  }
  throw new Error('Could not parse site-config object');
}

function ensureDataLayerVariable(varObj, expectedName) {
  // Ensure variable is dataLayer with the name pointing to expectedName
  if (varObj.type === 'dataLayer') {
    const p = varObj.parameter && varObj.parameter[0];
    if (p && p.key === 'name' && p.value === expectedName) return false; // no change
    varObj.type = 'dataLayer';
    varObj.parameter = [{ key: 'name', type: 'TEMPLATE', value: expectedName }];
    return true;
  }
  // was constant or other type -> convert
  varObj.type = 'dataLayer';
  varObj.parameter = [{ key: 'name', type: 'TEMPLATE', value: expectedName }];
  return true;
}

function syncContainer(filePath, siteConfig) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    error('Failed to parse ' + filePath + ': ' + e.message);
    return false;
  }

  const publicId = json?.containerVersion?.container?.publicId;
  const containerObj = json.containerVersion.container;
  let hostMatch = null;

  // find host in siteConfig that has gtm === publicId
  for (const [host, cfg] of Object.entries(siteConfig)) {
    if (host === 'default') continue;
    if (cfg && cfg.gtm === publicId) {
      hostMatch = host;
      break;
    }
  }

  // Update name
  const oldName = containerObj.name || '';
  const desiredName = hostMatch
    ? `${hostMatch} - GA4 + Ads (${publicId})`
    : `${oldName} (unmapped)`;

  let changed = false;
  if (oldName !== desiredName) {
    containerObj.name = desiredName;
    changed = true;
  }

  // Ensure variables for GA4/AW are dataLayer mapped
  const vars = json.containerVersion.variable || [];
  let updatedVars = 0;
  // map of variable names in container to expected DL variable
  const mapping = {
    GA4_MEASUREMENT_ID: 'ga4_measurement_id',
    AW_CONVERSION_ID: 'ads_conversion_id',
    AW_CONVERSION_LABEL: 'ads_conversion_label',
  };

  for (const v of vars) {
    if (mapping[v.name]) {
      const ok = ensureDataLayerVariable(v, mapping[v.name]);
      if (ok) {
        updatedVars++;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  }

  return { filePath, publicId, hostMatch, updatedVars, changed };
}

async function main() {
  info('Loading site-config...');
  const siteConfig = await loadSiteConfig();
  info('Loaded sites: ' + Object.keys(siteConfig).join(', '));

  const results = [];
  for (const f of GTM_FILES) {
    if (!fs.existsSync(f)) {
      warn('File not found, skipping: ' + f);
      continue;
    }
    const res = syncContainer(f, siteConfig);
    results.push(res);
  }

  info('Sync results:');
  results.forEach((r) => {
    info(
      `- ${path.basename(r.filePath)}: publicId=${r.publicId}, hostMatch=${
        r.hostMatch || 'none'
      }, updatedVars=${r.updatedVars}, changed=${r.changed}`
    );
  });
}

main().catch((err) => {
  error('Sync script failed: ' + (err && err.message ? err.message : String(err)));
  process.exit(1);
});
