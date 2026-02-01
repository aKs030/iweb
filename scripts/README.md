# Scripts

Nützliche Scripts für Development, Build und Quality-Checks.

## 📋 Verfügbare Scripts

### setup-quality-tools.sh

**Zweck:** Installiert und konfiguriert alle Code-Quality-Tools

**Usage:**

```bash
./scripts/setup-quality-tools.sh
```

**Was wird gemacht:**

1. ✅ Prüft Knip-Installation
2. ✅ Installiert JSCPD (global)
3. ✅ Installiert Madge (global)
4. ✅ Installiert ES6-Plato (global)
5. ✅ Installiert Cost-of-Modules (global)
6. ✅ Erstellt Report-Verzeichnisse
7. ✅ Aktualisiert .gitignore
8. ✅ Führt Test-Runs durch

**Voraussetzungen:**

- Node.js 22+
- npm 10+
- Graphviz (für Madge SVG-Export)

**Installation Graphviz:**

```bash
# macOS
brew install graphviz

# Ubuntu/Debian
sudo apt-get install graphviz

# Windows
choco install graphviz
```

**Output:**

```
🚀 Setting up Code Quality Tools...
📦 Checking Knip...
✅ Knip already installed
📦 Installing JSCPD...
✅ JSCPD installed
...
✅ Setup complete!
```

## 🔧 Weitere Scripts (geplant)

### optimize-images.sh

**Zweck:** Bildoptimierung (WebP/AVIF)

### deploy-workers.sh

**Zweck:** Cloudflare Workers Deployment (bereits vorhanden in workers/)

### generate-sitemap.sh

**Zweck:** Sitemap-Generierung

### check-links.sh

**Zweck:** Broken Links finden

## 📚 Dokumentation

- **[QUALITY_TOOLS_SETUP.md](../docs/QUALITY_TOOLS_SETUP.md)** - Setup Guide
- **[CODE_QUALITY.md](../docs/CODE_QUALITY.md)** - Tool Documentation
- **[DEVELOPMENT.md](../DEVELOPMENT.md)** - Development Guide

## 💡 Tipps

### Script ausführbar machen

```bash
chmod +x scripts/*.sh
```

### Script debuggen

```bash
bash -x scripts/setup-quality-tools.sh
```

### Script in CI nutzen

```yaml
# .github/workflows/ci.yml
- name: Setup Quality Tools
  run: ./scripts/setup-quality-tools.sh
```

---

**Weitere Scripts:** Siehe `workers/deploy.sh` für Worker-Deployment
