import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'content-data.json');
const OUTPUT_FILE = path.join(__dirname, 'seed.sql');

try {
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  const items = JSON.parse(data);

  let sql = `
-- Auto-generated seed file
DELETE FROM search_index;
`;

  items.forEach((item) => {
    const id = escape(item.id);
    const title = escape(item.title);
    const description = escape(item.description);
    const url = escape(item.url);
    const category = escape(item.category);
    const keywords = escape((item.keywords || []).join(' '));
    const priority = parseInt(item.priority || 0, 10);

    sql += `INSERT INTO search_index (id, title, description, url, category, keywords, priority) VALUES ('${id}', '${title}', '${description}', '${url}', '${category}', '${keywords}', ${priority});\n`;
  });

  fs.writeFileSync(OUTPUT_FILE, sql);
  console.log(`✅ Seed file generated at: ${OUTPUT_FILE}`);
  console.log(
    `Run: wrangler d1 execute search-db --file=${OUTPUT_FILE} --local`,
  );
} catch (err) {
  console.error('Error generating seed file:', err);
  process.exit(1);
}

function escape(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "''");
}
