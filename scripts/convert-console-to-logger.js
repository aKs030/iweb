#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const root = process.cwd()
const targets = ['content', 'pages', 'scripts']
const sharedPath = path.join('content', 'utils', 'shared-utilities.js')

function walk(dir) {
  const files = []
  for (const name of fs.readdirSync(dir, {withFileTypes: true})) {
    if (name.name === 'node_modules' || name.name === 'vendor' || name.name === '.git') continue
    const p = path.join(dir, name.name)
    if (name.isDirectory()) files.push(...walk(p))
    else if (/\.(js|mjs|cjs|html)$/.test(name.name)) files.push(p)
  }
  return files
}

function ensureImportAndLogger(content, filePath, scope, inlineHtml = false) {
  let changed = false
  const importMarker = 'createLogger'
  if (!content.includes(importMarker)) {
    // For inline HTML modules we prefer the absolute site path to the utility
    const relPath = inlineHtml
      ? '/content/utils/shared-utilities.js'
      : path.relative(path.dirname(filePath), path.join(root, sharedPath)).replace(/\\/g, '/')
    const importPath = relPath.startsWith('.') || relPath.startsWith('/') ? relPath : './' + relPath
    // place import after existing imports or at top
    const importLine = `import { createLogger } from '${importPath}';\n`
    const importRegex = /(^import .*;$\n?)/m
    if (importRegex.test(content)) {
      content = content.replace(importRegex, m => m + importLine)
    } else {
      content = importLine + content
    }
    changed = true
  }

  // ensure `const log = createLogger('Scope')` exists
  const loggerName = 'const log = createLogger'
  if (!content.includes(loggerName)) {
    // insert after last import
    const lastImport = [...content.matchAll(/^import .*;$/gm)].pop()
    const decl = `\nconst log = createLogger('${scope}');\n`
    if (lastImport) {
      const idx = lastImport.index + lastImport[0].length
      content = content.slice(0, idx) + '\n' + decl + content.slice(idx)
    } else {
      content = decl + content
    }
    changed = true
  }
  return {content, changed}
}

function convertFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  if (!/console\.warn|console\.error/.test(raw)) return null
  let content = raw
  const scope = path.basename(filePath).replace(/\.[^.]+$/, '')
  const {content: withImport, changed} = ensureImportAndLogger(content, filePath, scope)
  content = withImport
  // replace log.warn -> log.warn and log.error -> log.error
  const replaced = content.replace(/console\.warn/g, 'log.warn').replace(/console\.error/g, 'log.error')
  if (replaced !== raw || changed) {
    fs.writeFileSync(filePath, replaced, 'utf8')
    return {filePath, modified: true}
  }
  return null
}

function convertHtmlInlineModules(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  // match <script ... type=module ...>...</script> without src attribute
  const moduleRegex = /<script\b(?![^>]*\bsrc=)[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gim
  let match
  let modified = false
  let out = raw
  while ((match = moduleRegex.exec(raw)) !== null) {
    const moduleContent = match[1]
    if (!/console\.warn|console\.error/.test(moduleContent)) continue
    // convert module content
    const scope = path.basename(filePath).replace(/\.[^.]+$/, '')
    const {content: newModuleRaw, changed: _changed} = ensureImportAndLogger(moduleContent, filePath, scope, true)
    let newModule = newModuleRaw
    newModule = newModule.replace(/console\.warn/g, 'log.warn').replace(/console\.error/g, 'log.error')
    if (newModule !== moduleContent || changed) {
      // replace the specific module block in output
      out = out.replace(moduleContent, newModule)
      modified = true
    }
  }
  if (modified) {
    fs.writeFileSync(filePath, out, 'utf8')
    return {filePath, modified: true}
  }
  return null
}

const results = []
for (const t of targets) {
  const dir = path.join(root, t)
  if (!fs.existsSync(dir)) continue
  const files = walk(dir)
  for (const f of files) {
    try {
      let res = null
      if (/\.html$/.test(f)) {
        res = convertHtmlInlineModules(f)
      } else {
        res = convertFile(f)
      }
      if (res) results.push(res.filePath)
    } catch (e) {
      log.error('Error processing', f, e)
    }
  }
}

log.warn('Conversion complete. Modified files:', results.length)
results.forEach(r => log.warn(' -', r))

if (results.length === 0) process.exit(0)
else process.exit(0)
