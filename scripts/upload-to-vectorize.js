/**
 * Upload vectors to Vectorize using wrangler
 * Reads crawled-content.json and generates embeddings, then uploads via wrangler
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const CRAWLED_FILE = 'scripts/crawled-content.json';
const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || '652ca9f4abc93203c1ecd059dc00d1da';
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const INDEX_NAME = 'website-search-index';

if (!API_TOKEN) {
  console.error('❌ CLOUDFLARE_API_TOKEN not set');
  process.exit(1);
}

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
    const error = await response.text();
    throw new Error(`Embedding failed: ${response.status} ${error}`);
  }

  const result = await response.json();
  return result.result.data[0];
}

async function uploadVectors() {
  console.log('📊 Loading crawled content...\n');
  const content = JSON.parse(readFileSync(CRAWLED_FILE, 'utf-8'));

  console.log(`📄 Processing ${content.length} pages\n`);

  for (const [index, page] of content.entries()) {
    console.log(`[${index + 1}/${content.length}] ${page.url}`);

    try {
      // Generate embedding
      const textToEmbed = `${page.title} ${page.description} ${page.content}`;
      const embedding = await generateEmbedding(textToEmbed);

      // Create NDJSON file for this vector
      const vector = {
        id: `page-${index}`,
        values: embedding,
        metadata: {
          url: page.url,
          title: page.title,
          description: page.description,
          category: page.category,
        },
      };

      const ndjsonFile = `scripts/vector-${index}.ndjson`;
      writeFileSync(ndjsonFile, JSON.stringify(vector) + '\n');

      // Upload using wrangler
      const cmd = `npx wrangler vectorize insert ${INDEX_NAME} --file=${ndjsonFile}`;
      execSync(cmd, { stdio: 'inherit' });

      // Clean up
      execSync(`rm ${ndjsonFile}`);

      console.log(`  ✅ Uploaded\n`);
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
    }
  }

  console.log('✅ Upload complete!');
}

uploadVectors().catch(console.error);
