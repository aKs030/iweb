# 3D Models Directory

Compressed `.glb` / `.gltf` models for deployment live here.
Uncompressed source files go in `source/` (gitignored).

## Directory Structure

```
content/assets/models/
├── source/              ← uncompressed originals (gitignored, NOT deployed)
│   ├── robot.glb
│   └── satellite.glb
├── robot-draco.glb      ← Draco-compressed (deployed)
├── robot-meshopt.glb    ← Meshopt-compressed (deployed)
└── README.md
```

## Quick Start

```bash
# 1. Place uncompressed model in source/
cp ~/Downloads/robot.glb content/assets/models/source/

# 2. Compress (requires gltf-pipeline and/or gltfpack)
npm run models:compress

# 3. Done — compressed files appear in this directory
```

## Compression Script

The project includes `scripts/compress-models.mjs`:

```bash
npm run models:compress              # compress all source models
npm run models:compress:dry          # preview without writing files
node scripts/compress-models.mjs --file robot.glb        # single file
node scripts/compress-models.mjs --codec draco           # Draco only
node scripts/compress-models.mjs --codec meshopt          # Meshopt only
node scripts/compress-models.mjs --clean                  # remove old outputs first
```

### Prerequisites (one-time global installs)

```bash
npm install -g gltf-pipeline   # Draco compression
npm install -g gltfpack         # Meshopt compression
```

## Codec Comparison

| Feature           | Draco           | Meshopt             |
| ----------------- | --------------- | ------------------- |
| Compression ratio | 70–95 %         | 60–80 %             |
| Decode speed      | Moderate        | Very fast           |
| Animation support | Geometry only   | Full (morph + skel) |
| Streaming         | No              | Yes                 |
| Best for          | Static geometry | Animated characters |

## Loading in Code

```js
import { loadCompressedModel } from '/content/core/model-loader.js';

// Automatically detects Draco or Meshopt and applies the right decoder
const gltf = await loadCompressedModel(
  '/content/assets/models/robot-draco.glb',
);
scene.add(gltf.scene);
```

## Naming Convention

- `source/<name>.glb` — uncompressed original (do NOT deploy)
- `<name>-draco.glb` — Draco-compressed (deploy)
- `<name>-meshopt.glb` — Meshopt-compressed (deploy)

Deploy only the compressed variants. The model-loader handles decompression transparently.

## HTTP Headers

GLB/glTF files are served with correct MIME types via `_headers`:

| Extension | Content-Type        |
| --------- | ------------------- |
| `.glb`    | `model/gltf-binary` |
| `.gltf`   | `model/gltf+json`   |
