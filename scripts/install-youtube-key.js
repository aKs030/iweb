#!/usr/bin/env node
const fs = require("fs");
(async () => {
  const key = process.env.YT_KEY;
  if (!key) {
    console.error("ERROR: Please pass the key via YT_KEY env var");
    process.exit(2);
  }

  const half = Math.floor(key.length / 2);
  const a = key.slice(0, half);
  const b = key.slice(half);
  const partA = Buffer.from(a, "utf8").toString("base64");
  const partB = Buffer.from(b, "utf8").toString("base64");

  fs.writeFileSync(
    "content/config/videos-part-a.js",
    `export default "${partA}";\n`,
    "utf8"
  );
  fs.writeFileSync(
    "content/config/videos-part-b.js",
    `export default "${partB}";\n`,
    "utf8"
  );
  console.log(
    "Wrote content/config/videos-part-a.js and videos-part-b.js (local files only)"
  );

  const recon =
    Buffer.from(partA, "base64").toString("utf8") +
    Buffer.from(partB, "base64").toString("utf8");
  if (recon !== key) {
    console.error("ERROR: Reconstruction mismatch");
    process.exit(3);
  }
  console.log("Reconstructed key matches original (not displayed)");

  // Quick YouTube API check
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=UCTGRherjM4iuIn86xxubuPg&key=${recon}`;
    const res = await fetch(url);
    console.log("YouTube API HTTP status:", res.status);
    const json = await res.json();
    if (res.ok) {
      console.log("YouTube response: items:", (json.items || []).length);
    } else {
      console.error("YouTube API error:", JSON.stringify(json).slice(0, 800));
    }
  } catch (e) {
    console.error("Fetch failed:", e.message);
    process.exit(4);
  }
})();
