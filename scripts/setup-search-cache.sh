#!/bin/bash

# Setup Script für Search Cache KV Namespace
# Erstellt KV Namespaces für Production und Preview

echo "🔧 Setting up Search Cache KV Namespaces..."
echo ""

# Production Namespace erstellen
echo "📦 Creating Production KV Namespace..."
PROD_OUTPUT=$(wrangler kv namespace create "SEARCH_CACHE" 2>&1)
PROD_ID=$(echo "$PROD_OUTPUT" | grep -o 'id = "[^"]*"' | head -1 | cut -d'"' -f2)

if [ -z "$PROD_ID" ]; then
  echo "❌ Failed to create Production namespace"
  echo "$PROD_OUTPUT"
  exit 1
fi

echo "✅ Production Namespace ID: $PROD_ID"
echo ""

# Preview Namespace erstellen
echo "📦 Creating Preview KV Namespace..."
PREVIEW_OUTPUT=$(wrangler kv namespace create "SEARCH_CACHE" --preview 2>&1)
PREVIEW_ID=$(echo "$PREVIEW_OUTPUT" | grep -o 'id = "[^"]*"' | head -1 | cut -d'"' -f2)

if [ -z "$PREVIEW_ID" ]; then
  echo "❌ Failed to create Preview namespace"
  echo "$PREVIEW_OUTPUT"
  exit 1
fi

echo "✅ Preview Namespace ID: $PREVIEW_ID"
echo ""

# wrangler.toml aktualisieren
echo "📝 Updating wrangler.toml..."

# Backup erstellen
cp wrangler.toml wrangler.toml.backup

# Production ID ersetzen
sed -i.tmp "s/id = \"placeholder_id\"  # Replace with actual KV namespace ID after creation/id = \"$PROD_ID\"/g" wrangler.toml

# Temporäre Dateien entfernen
rm -f wrangler.toml.tmp

echo "✅ wrangler.toml updated"
echo ""

echo "🎉 Setup complete!"
echo ""
echo "📋 Summary:"
echo "  Production KV ID: $PROD_ID"
echo "  Preview KV ID: $PREVIEW_ID"
echo ""
echo "⚠️  Note: You need to manually update the preview KV ID in wrangler.toml"
echo "   Look for the second 'placeholder_id' in env.preview section"
echo ""
echo "🚀 Next steps:"
echo "  1. Review wrangler.toml changes"
echo "  2. Commit and push: npm run push"
echo "  3. Test search API with caching"
