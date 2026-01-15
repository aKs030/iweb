#!/usr/bin/env node
// Validate content/config/site-config.js entries (basic regex checks)
const path = require('path');

const SITE_CFG_PATH = path.join(
  __dirname,
  '..',
  'content',
  'config',
  'site-config.js',
);

const { loadSiteConfig } = require('./site-config-utils');

function loadSiteConfigLocal() {
  return loadSiteConfig(SITE_CFG_PATH);
}

function validate() {
  const cfg = loadSiteConfigLocal();
  const errors = [];
  const gtmRe = /^GT(M)?-[A-Z0-9]+$/i;
  const ga4Re = /^G-[A-Z0-9]+$/i;
  const awRe = /^AW-[0-9]+$/i;

  for (const [host, v] of Object.entries(cfg)) {
    if (host === 'default') continue;
    if (!v.gtm || !gtmRe.test(v.gtm))
      errors.push(`${host}: invalid or missing gtm (${v.gtm})`);
    if (!v.ga4 || !ga4Re.test(v.ga4))
      errors.push(`${host}: invalid or missing ga4 (${v.ga4})`);
    if (!v.aw || !awRe.test(v.aw))
      errors.push(`${host}: invalid or missing aw (${v.aw})`);
    // aw_label optional
    if (v.aw_label && typeof v.aw_label !== 'string')
      errors.push(`${host}: aw_label must be a string`);
  }

  const { error, info } = require('./log');
  if (errors.length) {
    error(
      'site-config validation failed:\n' +
        errors.map((e) => ' - ' + e).join('\n'),
    );
    process.exit(1);
  }
  info('site-config validation passed');
}

validate();
