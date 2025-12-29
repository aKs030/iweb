import assert from "node:assert/strict";
import { buildPageMeta } from "../content/components/head/head-complete.js";

console.log("Running buildPageMeta tests...");

const pageData = { title: "Hello", type: "ProfilePage", image: "/img.jpg" };
const pageUrl = "http://localhost/hello/";
const res = buildPageMeta(pageData, pageUrl, "/hello/");

assert.strictEqual(res.page_title, "Hello");
assert.strictEqual(res.page_path, "/hello/");
assert.strictEqual(res.page_url, pageUrl);
assert.strictEqual(res.page_type, "ProfilePage");
assert.strictEqual(res.page_image, "/img.jpg");
assert.strictEqual(res.page_lang, "de-DE");

console.log("buildPageMeta tests passed");
