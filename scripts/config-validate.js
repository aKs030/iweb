#!/usr/bin/env node
// Validate content/config/site-config.js entries (basic regex checks)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE_CFG_PATH = path.join(__dirname, '..', 'content', 'config', 'site-config.js');

function loadSiteConfig() {
  const src = fs.readFileSync(SITE_CFG_PATH, 'utf8');
  const marker = 'export const SITE_CONFIG =';
  const idx = src.indexOf(marker);
  if (idx < 0) throw new Error('site-config.js format not recognized');
  const after = src.slice(idx + marker.length);
  const firstBrace = after.indexOf('{');
  let i = firstBrace;
  let depth = 0;
  for (; i < after.length; i++) {
    const ch = after[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const objectText = after.slice(firstBrace, i + 1);
        const wrapper = `(function(){ return (${objectText}); })()`;
        const sandbox = {};
        const res = vm.runInNewContext(wrapper, sandbox, { filename: SITE_CFG_PATH });
        return res;
      }
    }
  }
  throw new Error('Could not parse site-config object');
}

function validate() {
  const cfg = loadSiteConfig();
  const errors = [];
  const gtmRe = /^GT(M)?-[A-Z0-9]+$/i;
  const ga4Re = /^G-[A-Z0-9]+$/i;
  const awRe = /^AW-[0-9]+$/i;

  for (const [host, v] of Object.entries(cfg)) {
    if (host === 'default') continue;
    if (!v.gtm || !gtmRe.test(v.gtm)) errors.push(`${host}: invalid or missing gtm (${v.gtm})`);
    if (!v.ga4 || !ga4Re.test(v.ga4)) errors.push(`${host}: invalid or missing ga4 (${v.ga4})`);
    if (!v.aw || !awRe.test(v.aw)) errors.push(`${host}: invalid or missing aw (${v.aw})`);
    // aw_label optional
    if (v.aw_label && typeof v.aw_label !== 'string')
      errors.push(`${host}: aw_label must be a string`);
  }

  const { error, info } = require('./log');
  if (errors.length) {
    error('site-config validation failed:\n' + errors.map((e) => ' - ' + e).join('\n'));
    process.exit(1);
  }
  info('site-config validation passed');
}

validate();
