import assert from "node:assert/strict";
import { buildCanonicalLinks } from "../content/components/head/head-complete.js";

console.log("Running buildCanonicalLinks tests...");

const BASE = "https://abdulkerimsesli.de";

// 1. forceProd => canonical to BASE
{
  const res = buildCanonicalLinks(true, "anyhost", "/about/", "http://localhost/about/", BASE, "/about/", "http://localhost");
  assert.strictEqual(res.effectiveCanonical, `${BASE}/about/`);
  assert.strictEqual(res.alternates[0].href, `${BASE}/about/`);
}

// 2. non-prod + dirty path (/pages/) => origin + cleanPath
{
  const res = buildCanonicalLinks(false, "localhost", "/pages/special/", "http://localhost/pages/special/", BASE, "/pages/special/", "http://localhost");
  assert.strictEqual(res.effectiveCanonical, `http://localhost/pages/special/`);
  assert.strictEqual(res.alternates[0].href, `http://localhost/pages/special/`);
}

// 3. non-prod + clean path => fallback to pageUrl
{
  const res = buildCanonicalLinks(false, "localhost", "/about/", "http://localhost/about/", BASE, "/about/", "http://localhost");
  assert.strictEqual(res.effectiveCanonical, `http://localhost/about/`);
}

console.log("buildCanonicalLinks tests passed");
