#!/usr/bin/env node
/*
Simple Cloudflare proxy to run sensitive Cloudflare API calls server-side.
Usage:
  CF_API_TOKEN=<token> CF_ZONE_ID=<zone> CF_PROXY_SECRET=<optional-secret> node server/cf-proxy.js

Endpoints:
  POST /api/cf/purge  -> body: { purge_everything: true } or { files: [url,...] }

Security:
  - The script expects CF_API_TOKEN & CF_ZONE_ID as env vars (do NOT commit them)
  - Optionally set CF_PROXY_SECRET env var and pass the same header "x-proxy-secret" on requests

Note: This is intended for local testing / small deployments. For production, run behind an auth layer.
*/

import http from 'http'
import express from 'express'

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3001
const CF_API_TOKEN = process.env.CF_API_TOKEN
const CF_ZONE_ID = process.env.CF_ZONE_ID
const PROXY_SECRET = process.env.CF_PROXY_SECRET

if (!CF_API_TOKEN || !CF_ZONE_ID) {
  console.error('Missing CF_API_TOKEN or CF_ZONE_ID env variables. Exiting.')
  process.exit(1)
}

function checkSecret(req) {
  if (!PROXY_SECRET) return true
  const header = (req.headers['x-proxy-secret'] || '')
  return header === PROXY_SECRET
}

app.post('/api/cf/purge', async (req, res) => {
  if (!checkSecret(req)) return res.status(403).json({ error: 'Forbidden' })

  const body = req.body || {}
  const endpoint = `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`

  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    const json = await r.json()
    return res.status(r.status).json(json)
  } catch (e) {
    console.error('Cloudflare purge error', e)
    return res.status(500).json({ error: 'Cloudflare request failed' })
  }
})

app.get('/api/cf/verify', async (req, res) => {
  if (!checkSecret(req)) return res.status(403).json({ error: 'Forbidden' })
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' }
    })
    const json = await r.json()
    return res.status(r.status).json(json)
  } catch (e) {
    console.error('Cloudflare verify error', e)
    return res.status(500).json({ error: 'Cloudflare request failed' })
  }
})

app.listen(PORT, () => {
  console.log(`Cloudflare proxy listening on http://localhost:${PORT}`)
  console.log('Endpoints: POST /api/cf/purge  GET /api/cf/verify')
})
