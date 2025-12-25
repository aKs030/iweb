// Simple dev server to serve project with intelligent rewrites
// - Serves files from project root
// - If /foo/ requested and not found, tries /pages/foo/index.html
// - Adds basic content-type headers

const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 8081
const ROOT = process.cwd()

const mime = (p) => {
  const ext = path.extname(p).toLowerCase()
  const map = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp'
  }
  return map[ext] || 'application/octet-stream'
}

const fileExists = (p) => {
  try {
    const s = fs.statSync(p)
    return s.isFile()
  } catch (e) {
    return false
  }
}

const tryFile = (urlPath) => {
  // Normalize and prevent directory traversal
  let safePath = path.normalize(urlPath).replace(/^\/+/, '')
  safePath = safePath.split('?')[0].split('#')[0]
  const full = path.join(ROOT, safePath)
  if (fileExists(full)) return full
  // If it's a directory or no extension, try index.html
  const asIndex = path.join(full, 'index.html')
  if (fileExists(asIndex)) return asIndex
  return null
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url || '/')
  // First try the path as-is
  console.log('Request for', urlPath)
  let f = tryFile(urlPath)
  console.log(' tryFile(urlPath) ->', f)
  if (!f) {
    // Try within /pages/<path>
    const candidate = path.posix.join('pages', urlPath)
    console.log(' trying candidate', candidate)
    f = tryFile(candidate)
    console.log(' tryFile(candidate) ->', f)
  }

  if (f) {
    const stream = fs.createReadStream(f)
    console.log('Serving file', f)
    res.writeHead(200, { 'Content-Type': mime(f) })
    stream.pipe(res)
  } else {
    console.log('No matching file for', urlPath)
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }
})

server.listen(PORT, () => {
  console.log(`Dev server listening on http://127.0.0.1:${PORT}`)
  console.log('Serving from:', ROOT)
})
