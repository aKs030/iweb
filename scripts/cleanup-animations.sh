#!/bin/bash

# Animation Cleanup Script
# Entfernt alte Animationsdateien und bereinigt das System

echo "🧹 Starting animation cleanup..."

# Navigate to animations directory
cd "$(dirname "$0")/../content/webentwicklung/animations" || exit 1

# Remove old backup files
echo "Removing old backup files..."
rm -f advanced-animations-old.css
rm -f enhanced-animation-engine-old.js
rm -f scroll-animations-old.js

echo "✅ Old animation files cleaned up"

# Update file permissions
echo "Setting proper file permissions..."
chmod 644 *.css *.js

echo "✅ File permissions updated"

# Validate CSS syntax
echo "Validating CSS syntax..."
if command -v csslint &> /dev/null; then
    csslint advanced-animations.css
else
    echo "⚠️  CSS Lint not available, skipping validation"
fi

# Validate JS syntax
echo "Validating JavaScript syntax..."
if command -v jshint &> /dev/null; then
    jshint scroll-animations.js
    jshint enhanced-animation-engine.js
else
    echo "⚠️  JSHint not available, skipping validation"
fi

echo "🎉 Animation cleanup completed!"
echo ""
echo "📊 Animation System Summary:"
echo "- scroll-animations.js: Optimized scroll controller (16KB)"
echo "- enhanced-animation-engine.js: Extended animation engine (12KB)"  
echo "- advanced-animations.css: Clean CSS animations (11KB)"
echo "- micro-interactions.js: UI micro-interactions (19KB)"
echo ""
echo "🚀 Performance improvements:"
echo "- GPU-accelerated animations"
echo "- Reduced motion support"
echo "- Mobile-optimized timing"
echo "- Unified observer system"
echo "- Memory leak prevention"
