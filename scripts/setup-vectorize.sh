#!/bin/bash
# Setup Vectorize Index for semantic search
# Uses Workers AI @cf/baai/bge-base-en-v1.5 (768 dimensions)

echo "🚀 Setting up Vectorize index..."

# Create Vectorize index
npx wrangler vectorize create website-search-index \
  --dimensions=768 \
  --metric=cosine

echo "✅ Vectorize index created!"
echo ""
echo "Next steps:"
echo "1. Add binding to wrangler.toml:"
echo "   [[vectorize]]"
echo "   binding = \"VECTORIZE\""
echo "   index_name = \"website-search-index\""
echo ""
echo "2. Run crawler to index content:"
echo "   npm run crawl:index"
