#!/usr/bin/env node
/* build-og-images.mjs
   Scans known OG image folders and outputs a JSON mapping file with width/height
   Output: content/utils/og-image-dimensions.json (path keys are web-accessible, e.g. /content/assets/img/og/og-home.png)

   This implementation avoids external dependencies by reading PNG/JPEG/SVG headers directly.
   Usage: node scripts/build-og-images.mjs
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = process.cwd();

const walkDir = (dir, arr = []) => {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) walkDir(full, arr);
    else arr.push(full);
  }
  return arr;
};

const isImage = (f) => /\.(png|jpe?g|svg)$/i.test(f);

const outPath = path.join(ROOT, "content", "utils", "og-image-dimensions.json");
const results = {};

const files = [];
if (fs.existsSync(path.join(ROOT, "content", "assets", "img", "og"))) {
  walkDir(path.join(ROOT, "content", "assets", "img", "og"), files);
}
// also include other image folders
if (fs.existsSync(path.join(ROOT, "content", "assets", "img"))) {
  walkDir(path.join(ROOT, "content", "assets", "img"), files);
}

for (const f of files) {
  if (!isImage(f)) continue;
  try {
    const ext = path.extname(f).toLowerCase();
    let dims = null;
    const buf = fs.readFileSync(f);
    if (ext === ".png") {
      // PNG: width/height in IHDR at bytes 16-24 (big-endian)
      if (buf.length >= 24 && buf.toString("ascii", 12, 16) === "IHDR") {
        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        dims = { width, height };
      }
    } else if (ext === ".jpg" || ext === ".jpeg") {
      // JPEG: scan for SOF0/2 markers
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        // SOF0=0xC0, SOF2=0xC2
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buf.readUInt16BE(i + 5);
          const width = buf.readUInt16BE(i + 7);
          dims = { width, height };
          break;
        }
        i += 2 + len;
      }
    } else if (ext === ".svg") {
      const text = buf.toString("utf8");
      // try width/height attributes
      const wMatch = text.match(/width\s*=\s*"([0-9.]+)"/i);
      const hMatch = text.match(/height\s*=\s*"([0-9.]+)"/i);
      if (wMatch && hMatch) {
        dims = {
          width: Math.round(Number.parseFloat(wMatch[1])),
          height: Math.round(Number.parseFloat(hMatch[1])),
        };
      } else {
        const vb = text.match(/viewBox\s*=\s*"([0-9.\s]+)"/i);
        if (vb) {
          const parts = vb[1].trim().split(/\s+/);
          if (parts.length === 4) {
            const width = Math.round(Number.parseFloat(parts[2]));
            const height = Math.round(Number.parseFloat(parts[3]));
            dims = { width, height };
          }
        }
      }
    }

    if (dims?.width && dims?.height) {
      const webPath =
        "/" + path.posix.join(path.relative(ROOT, f)).replaceAll("\\", "/");
      results[webPath] = { width: dims.width, height: dims.height };
    }
  } catch (e) {
    console.warn("Skipping", f, e.message);
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log("Wrote", outPath, "with", Object.keys(results).length, "entries");
