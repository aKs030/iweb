import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, '..');

export function resolveRootPath(...segments) {
  return path.join(ROOT_DIR, ...segments);
}

export async function updateFileIfChanged(filePath, nextContent) {
  let currentContent = '';

  try {
    currentContent = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (currentContent === nextContent) {
    return false;
  }

  await writeFile(filePath, nextContent, 'utf8');
  return true;
}

export async function runGenerator(main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
