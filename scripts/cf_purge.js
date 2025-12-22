#!/usr/bin/env node
/* CLI Thin Wrapper to purge Cloudflare cache using env vars
Usage:
  CF_API_TOKEN=<token> CF_ZONE_ID=<zone> node scripts/cf_purge.js --all
  or
  CF_API_TOKEN=<token> CF_ZONE_ID=<zone> node scripts/cf_purge.js --files https://... https://...
*/

const [,, ...args] = process.argv
const fetch = global.fetch || require('node-fetch')
const API = 'https://api.cloudflare.com/client/v4/zones'

async function purgeAll(token, zone) {
  const res = await fetch(`${API}/${zone}/purge_cache`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ purge_everything: true })
  })
  const j = await res.json()
  console.log('status', res.status, j)
}

async function purgeFiles(token, zone, files) {
  const res = await fetch(`${API}/${zone}/purge_cache`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files })
  })
  const j = await res.json()
  console.log('status', res.status, j)
}

async function main() {
  const token = process.env.CF_API_TOKEN
  const zone = process.env.CF_ZONE_ID
  if (!token || !zone) {
    console.error('Missing env vars CF_API_TOKEN or CF_ZONE_ID')
    process.exit(1)
  }
  if (args[0] === '--all') await purgeAll(token, zone)
  else if (args[0] === '--files') await purgeFiles(token, zone, args.slice(1))
  else {
    console.log('Usage: --all OR --files <url> ...')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
