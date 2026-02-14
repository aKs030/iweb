/**
 * Vectorize Indexer
 * Uploads crawled content to Vectorize with embeddings
 * Uses Workers AI @cf/baai/bge-base-en-v1.5 for embeddings
 * @version 1.0.0
 */

import { readFileSync } from 'fs';

const CRAWLED_FILE = 'scripts/crawled-content.json';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const INDEX_NAME = 'website-search-index';

/**
 * Generate embeddings using Workers AI
 */
async function generateEmbedding(text) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/baai/bge-base-en-v1.5`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: [text] }),
    },
  );

  if (!response.ok) {
    throw new Error(`Embedding failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.result.data[0]; // Returns 768-dimensional vector
}

/**
 * Insert vectors into Vectorize
 */
async function insertVectors(vectors) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/${INDEX_NAME}/insert`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vectors }),
    },
  );

  if (!response.ok) {
    throw new Error(`Insert failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Index all crawled content
 */
async function indexContent() {
  console.log('📊 Starting indexing process...\n');

  // Load crawled content
  const content = JSON.parse(readFileSync(CRAWLED_FILE, 'utf-8'));
  console.log(`📄 Loaded ${content.length} pages\n`);

  const vectors = [];

  for (const [index, page] of content.entries()) {
    console.log(`[${index + 1}/${content.length}] Processing: ${page.url}`);

    try {
      // Combine title, description, and content for embedding
      const textToEmbed = `${page.title} ${page.description} ${page.content}`;

      // Generate embedding
      const embedding = await generateEmbedding(textToEmbed);

      // Prepare vector with metadata
      vectors.push({
        id: `page-${index}`,
        values: embedding,
        metadata: {
          url: page.url,
          title: page.title,
          description: page.description,
          category: page.category,
          timestamp: page.timestamp,
        },
      });

      console.log(`  ✅ Generated embedding (${embedding.length} dimensions)`);
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  // Insert vectors in batches (max 1000 per request)
  console.log(`\n📤 Uploading ${vectors.length} vectors to Vectorize...`);

  const BATCH_SIZE = 100;
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    console.log(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} vectors`,
    );

    try {
      await insertVectors(batch);
      console.log(`  ✅ Uploaded`);
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  console.log('\n✅ Indexing complete!');
  console.log(`📊 Total vectors indexed: ${vectors.length}`);
}

// Check environment variables
if (!ACCOUNT_ID || !API_TOKEN) {
  console.error('❌ Missing environment variables:');
  console.error('   CLOUDFLARE_ACCOUNT_ID');
  console.error('   CLOUDFLARE_API_TOKEN');
  process.exit(1);
}

indexContent().catch(console.error);
