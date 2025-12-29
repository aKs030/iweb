import assert from "node:assert/strict";
import { buildPwaAssets } from "../content/components/head/head-complete.js";

console.log("Running buildPwaAssets tests...");

const BASE = "https://abdulkerimsesli.de";
const BRAND = { name: "Abdulkerim Sesli" };
const res = buildPwaAssets(BASE, BRAND);

assert.ok(res.links && Array.isArray(res.links), "links should be an array");
assert.ok(res.iconLinks && Array.isArray(res.iconLinks), "iconLinks should be an array");
assert.ok(res.metas && Array.isArray(res.metas), "metas should be an array");

// Check manifest link
assert.strictEqual(res.links[0].rel, "manifest");
assert.strictEqual(res.links[0].href, "/manifest.json");

// Check at least one icon with sizes exists
const sizedIcon = res.iconLinks.find((i) => i.sizes === "32x32");
assert.ok(sizedIcon, "should contain 32x32 icon");
assert.strictEqual(sizedIcon.href, `${BASE}/content/assets/img/icons/icon-32.png`);

// Check apple touch icon present
const apple = res.iconLinks.find((i) => i.rel === "apple-touch-icon");
assert.ok(apple?.href, "apple-touch-icon should be present");

// Check a meta present
const theme = res.metas.find((m) => m.name === "theme-color");
assert.ok(theme?.content === "#0d0d0d", "theme-color meta present");

console.log("buildPwaAssets tests passed");
