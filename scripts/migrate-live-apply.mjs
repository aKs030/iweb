import { spawn } from "node:child_process";

const db = process.env.MIGRATION_DATABASE || "portfolio-likes";
const out = process.env.MIGRATION_OUT || "./.tmp/live-d1-snapshot.sql";
const useRemote = process.env.MIGRATION_REMOTE !== "0";
const args = [
  "--yes",
  "wrangler",
  "d1",
  "execute",
  db,
  ...(useRemote ? ["--remote"] : []),
  "--file",
  out,
];

await new Promise((resolve, reject) => {
  const child = spawn("npx", args, { stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", code => {
    if (code === 0) resolve();
    else reject(new Error(`wrangler d1 execute fehlgeschlagen: ${code}`));
  });
});
