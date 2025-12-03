#!/usr/bin/env bash
set -euo pipefail

# Fetch vendorized libraries used by the project and write to content/vendor
mkdir -p ./content/vendor

# React UMD (production)
curl -L -o ./content/vendor/react.production.min.js "https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"

# ReactDOM UMD (production)
curl -L -o ./content/vendor/react-dom.production.min.js "https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"

# HTM (ES Module)
curl -L -o ./content/vendor/htm.module.js "https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.module.js"

# Three.js (ES Module)
curl -L -o ./content/vendor/three.module.js "https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.module.js"

# Display summary
echo "Vendor files written to ./content/vendor/"
ls -la ./content/vendor
