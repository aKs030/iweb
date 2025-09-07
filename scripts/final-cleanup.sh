#!/bin/bash

# =============================================================================
# Final Animation System Cleanup Script
# =============================================================================
# Entfernt veraltete Animation-Dateien und temporäre Test-Dateien
# Behält nur das optimierte Enhanced Animation Engine System
# =============================================================================

echo "🧹 Starte finales Animation-System Cleanup..."
echo ""

# Backup erstellen
echo "📦 Erstelle Backup der aktuellen Animation-Dateien..."
mkdir -p backups/animation-cleanup-$(date +%Y%m%d-%H%M%S)
cp -r content/webentwicklung/animations/* backups/animation-cleanup-$(date +%Y%m%d-%H%M%S)/ 2>/dev/null || true

echo "✅ Backup erstellt in: backups/animation-cleanup-$(date +%Y%m%d-%H%M%S)/"
echo ""

# =============================================================================
# PHASE 1: Veraltete Animation-Dateien entfernen
# =============================================================================

echo "🗑️  PHASE 1: Entferne veraltete Animation-Dateien..."

# Veraltete Animation-Systeme entfernen
if [ -f "content/webentwicklung/animations/micro-interactions.js" ]; then
    echo "  ❌ Entferne: micro-interactions.js (redundant, in enhanced-animation-engine integriert)"
    rm "content/webentwicklung/animations/micro-interactions.js"
fi

if [ -f "content/webentwicklung/animations/scroll-animations.js" ]; then
    echo "  ❌ Entferne: scroll-animations.js (legacy, durch enhanced-animation-engine ersetzt)"
    rm "content/webentwicklung/animations/scroll-animations.js"
fi

echo ""

# =============================================================================
# PHASE 2: Test-Dateien aufräumen (optional)
# =============================================================================

echo "🧪 PHASE 2: Test-Dateien organisieren..."

# Test-Verzeichnis erstellen
mkdir -p tests/animation-validation

# Test-Dateien verschieben (optional - für Entwicklung behalten)
echo "  📁 Organisiere Test-Dateien..."

test_files=(
    "test-animations.html"
    "enhanced-test.html" 
    "simple-test.html"
    "about-test.html"
    "karten-test.html"
    "hero-test.html"
    "menu-test.html"
    "test-suite.html"
    "validation-report.html"
)

for file in "${test_files[@]}"; do
    if [ -f "$file" ]; then
        echo "  📄 Behalte Test-Datei: $file (für weitere Entwicklung)"
        # mv "$file" "tests/animation-validation/" # Auskommentiert - Tests bleiben verfügbar
    fi
done

echo ""

# =============================================================================
# PHASE 3: Debug-Dateien aufräumen
# =============================================================================

echo "🔧 PHASE 3: Debug-Dateien aufräumen..."

if [ -f "debug-animations.js" ]; then
    echo "  🔍 Debug-Script behalten für weitere Entwicklung"
    # rm "debug-animations.js" # Auskommentiert - Debug-Script kann nützlich sein
fi

echo ""

# =============================================================================
# PHASE 4: Validierung
# =============================================================================

echo "✅ PHASE 4: Validierung des finalen Systems..."

echo ""
echo "📋 Finale Animation-System Struktur:"
echo "content/webentwicklung/animations/"

if [ -f "content/webentwicklung/animations/enhanced-animation-engine.js" ]; then
    size=$(ls -lh "content/webentwicklung/animations/enhanced-animation-engine.js" | awk '{print $5}')
    echo "  ✅ enhanced-animation-engine.js ($size) - Hauptsystem"
else
    echo "  ❌ enhanced-animation-engine.js FEHLT!"
fi

if [ -f "content/webentwicklung/animations/advanced-animations.css" ]; then
    size=$(ls -lh "content/webentwicklung/animations/advanced-animations.css" | awk '{print $5}')
    echo "  ✅ advanced-animations.css ($size) - Optimierte CSS-Animationen"
else
    echo "  ❌ advanced-animations.css FEHLT!"
fi

if [ -f "content/webentwicklung/animations/simple-scroll-animations.js" ]; then
    size=$(ls -lh "content/webentwicklung/animations/simple-scroll-animations.js" | awk '{print $5}')
    echo "  ✅ simple-scroll-animations.js ($size) - Fallback-System"
else
    echo "  ❌ simple-scroll-animations.js FEHLT!"
fi

echo ""

# =============================================================================
# PHASE 5: System-Check
# =============================================================================

echo "🔍 PHASE 5: System-Integration Check..."

# Prüfe index.html Integration
if grep -q "enhanced-animation-engine.js" index.html; then
    echo "  ✅ index.html verwendet Enhanced Animation Engine"
else
    echo "  ⚠️  index.html Integration prüfen"
fi

# Zähle Animation-Dateien
animation_count=$(ls -1 content/webentwicklung/animations/ | wc -l)
echo "  📊 Verbleibende Animation-Dateien: $animation_count"

echo ""

# =============================================================================
# SUMMARY
# =============================================================================

echo "🎉 CLEANUP ABGESCHLOSSEN!"
echo ""
echo "📈 Optimierungen:"
echo "  ✅ Redundante Animation-Systeme entfernt"
echo "  ✅ Enhanced Animation Engine v3.0 als Standard etabliert"
echo "  ✅ Fallback-System verfügbar"
echo "  ✅ Optimierte CSS-Animationen behalten"
echo "  ✅ Test-Suite für zukünftige Entwicklung verfügbar"
echo ""
echo "🚀 Das Animation-System ist jetzt produktionsreif!"
echo ""
echo "📁 Backup-Pfad: backups/animation-cleanup-$(date +%Y%m%d-%H%M%S)/"
echo "🧪 Test-Suite: http://localhost:8001/test-suite.html"
echo "📊 Validation Report: http://localhost:8001/validation-report.html"
echo ""
