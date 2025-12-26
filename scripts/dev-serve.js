// Simple dev server to serve project with intelligent rewrites
// - Serves files from project root
// - If /foo/ requested and not found, tries /pages/foo/index.html
// - Adds basic content-type headers

const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 8081
const ROOT = path.resolve(process.cwd())

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
  } catch {
    return false
  }
}

const tryFile = (urlPath) => {
  // Normalize and prevent directory traversal
  let safePath = path.normalize(urlPath).replace(/^\/+/, '')
  safePath = safePath.split('?')[0].split('#')[0]
  const candidate = path.join(ROOT, safePath)

  // Resolve symlinks and ensure the path is within ROOT
  let full
  try {
    const resolved = fs.realpathSync(candidate)
    if (resolved === ROOT || resolved.startsWith(ROOT + path.sep)) {
      full = resolved
    } else {
      return null
    }
  } catch {
    return null
  }

  if (fileExists(full)) return full

  // If it's a directory or no extension, try index.html
  const indexCandidate = path.join(full, 'index.html')
  let asIndex
  try {
    const resolvedIndex = fs.realpathSync(indexCandidate)
    if (resolvedIndex === ROOT || resolvedIndex.startsWith(ROOT + path.sep)) {
      asIndex = resolvedIndex
    } else {
      return null
    }
  } catch {
    return null
  }

  if (fileExists(asIndex)) return asIndex
  return null
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url || '/')
  // First try the path as-is
  console.warn('Request for', urlPath)
  let f = tryFile(urlPath)
  console.warn(' tryFile(urlPath) ->', f)
  if (!f) {
    // Try within /pages/<path>
    const candidate = path.posix.join('pages', urlPath)
    console.warn(' trying candidate', candidate)
    f = tryFile(candidate)
    console.warn(' tryFile(candidate) ->', f)
  }

  if (f) {
    const stream = fs.createReadStream(f)
    console.warn('Serving file', f)
    res.writeHead(200, { 'Content-Type': mime(f) })
    stream.pipe(res)
  } else {
    console.warn('No matching file for', urlPath)
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }
})

server.listen(PORT, () => {
  console.warn(`Dev server listening on http://127.0.0.1:${PORT}`)
  console.warn('Serving from:', ROOT)
})
