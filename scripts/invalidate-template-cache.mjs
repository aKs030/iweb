#!/usr/bin/env node
/**
 * Template-Cache Invalidierung
 *
 * Führe dieses Script aus, wenn base-head.html oder base-loader.html
 * geändert wurden, damit der KV-Cache sofort invalidiert wird.
 *
 * Usage:
 *   node scripts/invalidate-template-cache.mjs [--env production]
 */

import { execSync } from 'child_process';

const env = process.argv.includes('--env')
  ? process.argv[process.argv.indexOf('--env') + 1]
  : 'preview';

const KV_BINDING = 'SITEMAP_CACHE_KV';
const KEYS = ['template:base-head', 'template:base-loader'];

const envFlag = env === 'production' ? '--env production' : '';

console.log(`🗑️  Invalidiere Template-Cache in KV (${env})...`);

for (const key of KEYS) {
  try {
    execSync(
      `npx wrangler kv key delete --binding=${KV_BINDING} "${key}" ${envFlag}`,
      { stdio: 'inherit' },
    );
    console.log(`✅  Gelöscht: ${key}`);
  } catch {
    console.warn(`⚠️  Schlüssel nicht gefunden (bereits leer): ${key}`);
  }
}

console.log(
  '\n✨ Template-Cache invalidiert. Nächste Requests laden frische Templates.',
);
