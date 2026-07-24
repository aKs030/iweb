import { readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const roots = ["content", "pages", "functions"];
const budgets = {
  ".js": { total: 1_650_000, single: 70_000 },
  ".css": { total: 450_000, single: 45_000 },
};

async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(path)));
    else files.push(path);
  }
  return files;
}

const allFiles = (await Promise.all(roots.map(directory => collect(join(root, directory))))).flat();
const failures = [];

for (const [extension, limits] of Object.entries(budgets)) {
  const matching = allFiles.filter(path => extname(path) === extension);
  const sizes = await Promise.all(
    matching.map(async path => ({ path, bytes: (await stat(path)).size }))
  );
  const total = sizes.reduce((sum, file) => sum + file.bytes, 0);
  if (total > limits.total) {
    failures.push(`${extension}: total ${total} B exceeds ${limits.total} B`);
  }
  for (const file of sizes) {
    if (file.bytes > limits.single) {
      failures.push(`${relative(root, file.path)}: ${file.bytes} B exceeds ${limits.single} B`);
    }
  }
  console.warn(`${extension}: ${total} B total across ${sizes.length} files`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  globalThis.process.exitCode = 1;
}
