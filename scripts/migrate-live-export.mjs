import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = String(process.env.MIGRATION_SOURCE_URL || "https://www.abdulkerimsesli.de")
  .trim()
  .replace(/\/+$/, "");
const token = String(process.env.ADMIN_TOKEN || "").trim();
const out = process.env.MIGRATION_OUT || "./.tmp/live-d1-snapshot.sql";

if (!token) {
  console.error("ADMIN_TOKEN fehlt.");
  process.exit(2);
}

const response = await fetch(`${base}/api/admin`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Accept: "application/sql",
  },
  body: JSON.stringify({ action: "export-snapshot" }),
});
const sql = await response.text();

if (!response.ok) {
  console.error(sql.slice(0, 1000));
  process.exit(1);
}

await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, sql, "utf8");
process.stdout.write(`Snapshot geschrieben nach: ${out}\n`);
