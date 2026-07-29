import { mkdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import process from "node:process";
import sharp from "sharp";

const [sourcePath, outputDirectory] = process.argv.slice(2);
if (!sourcePath || !outputDirectory) {
  throw new Error("Usage: node scripts/build-earth-detail-tiles.mjs <source.jpg> <output-dir>");
}

const columns = 8;
const rows = 4;
const width = 21_600;
const height = 10_800;
const tileWidth = width / columns;
const tileHeight = height / rows;

const metadata = await sharp(sourcePath).metadata();
if (metadata.width !== width || metadata.height !== height) {
  throw new Error(`Expected ${width}x${height}, received ${metadata.width}x${metadata.height}`);
}

await mkdir(outputDirectory, { recursive: true });

for (let row = 0; row < rows; row++) {
  for (let column = 0; column < columns; column++) {
    const filename = `r${row}-c${column}.webp`;
    const destination = join(outputDirectory, filename);
    await sharp(sourcePath)
      .extract({
        left: column * tileWidth,
        top: row * tileHeight,
        width: tileWidth,
        height: tileHeight,
      })
      .webp({ quality: 84, effort: 5, smartSubsample: true })
      .toFile(destination);
    const file = await stat(destination);
    process.stdout.write(`${basename(destination)} ${file.size}\n`);
  }
}
