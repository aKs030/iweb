#!/bin/bash
# CSS Modernization Script

echo "🎨 CSS-Modernisierung wird durchgeführt..."

# 1. Color-function Modernisierung
echo "🔧 Modernisiere color-function Notation..."

# Backup erstellen
cp css/_global.css css/_global.css.backup
cp css/cookies.css css/cookies.css.backup

# rgba() zu color-mix() konvertieren (wichtigste Fälle)
sed -i '' 's/rgba(0, 0, 0, 0\.85)/color-mix(in srgb, black 85%, transparent)/g' css/_global.css
sed -i '' 's/rgba(255, 255, 255, 0\.6)/color-mix(in srgb, white 60%, transparent)/g' css/_global.css
sed -i '' 's/rgba(0, 0, 0, 1)/color-mix(in srgb, black 100%, transparent)/g' css/_global.css
sed -i '' 's/rgba(0, 0, 0, 0\.3)/color-mix(in srgb, black 30%, transparent)/g' css/_global.css
sed -i '' 's/rgba(0, 0, 0, 0\.25)/color-mix(in srgb, black 25%, transparent)/g' css/_global.css

# #ffffff zu #fff
sed -i '' 's/#ffffff/#fff/g' css/_global.css
sed -i '' 's/#555555/#555/g' css/cookies.css
sed -i '' 's/#666666/#666/g' css/cookies.css

# Alpha-values zu Prozent (häufigste Fälle)
sed -i '' 's/0\.6/60%/g' css/_global.css
sed -i '' 's/0\.3/30%/g' css/_global.css
sed -i '' 's/0\.25/25%/g' css/_global.css

echo "✅ CSS-Modernisierung abgeschlossen!"
echo "📋 Backups erstellt: _global.css.backup, cookies.css.backup"
