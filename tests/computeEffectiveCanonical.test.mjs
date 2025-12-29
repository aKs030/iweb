import assert from "node:assert/strict";
import { computeEffectiveCanonical } from "../content/components/head/head-complete.js";

console.log("Running computeEffectiveCanonical tests...");

// 1) forceProdFlag true => production canonical
{
  const res = computeEffectiveCanonical(
    true,
    "any-host",
    "/about/",
    "http://localhost/about/",
    "https://abdulkerimsesli.de",
  );
  assert.strictEqual(res.effectiveCanonical, "https://abdulkerimsesli.de/about/");
}

// 2) non-prod + dirty path => use origin + cleanPath
{
  const res = computeEffectiveCanonical(
    false,
    "localhost",
    "/pages/special/",
    "http://localhost/pages/special/",
    "https://abdulkerimsesli.de",
    "/pages/special/",
    "http://localhost",
  );
  assert.strictEqual(res.effectiveCanonical, "http://localhost/pages/special/");
}

// 3) non-prod + clean path => fallback to pageUrl
{
  const res = computeEffectiveCanonical(
    false,
    "localhost",
    "/about/",
    "http://localhost/about/",
    "https://abdulkerimsesli.de",
    "/about/",
    "http://localhost",
  );
  assert.strictEqual(res.effectiveCanonical, "http://localhost/about/");
}

console.log("computeEffectiveCanonical tests passed");
