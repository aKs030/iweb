import assert from "node:assert/strict";
import { orchestrateHead } from "../content/components/head/head-complete.js";

console.log("Running orchestrator tests...");

function createElement(type) {
  return {
    nodeName: type.toUpperCase(),
    name: undefined,
    property: undefined,
    content: undefined,
    rel: undefined,
    href: undefined,
    id: undefined,
    sizes: undefined,
    textContent: undefined,
    setAttribute(k, v) {
      if (k === 'name') this.name = v;
      if (k === 'property') this.property = v;
      if (k === 'content') this.content = v;
      if (k === 'rel') this.rel = v;
      if (k === 'href') this.href = v;
      if (k === 'id') this.id = v;
      if (k === 'type') this.type = v;
      if (k === 'sizes') this.sizes = v;
    },
  };
}

function makeDoc() {
  const head = {
    nodes: [],
    querySelector(sel) {
      if (sel.startsWith('meta[')) {
        const nameMatch = sel.match(/meta\[name="(.+)"\]/);
        const propMatch = sel.match(/meta\[property="(.+)"\]/);
        if (nameMatch) return this.nodes.find((n) => n.name === nameMatch[1]) || null;
        if (propMatch) return this.nodes.find((n) => n.property === propMatch[1]) || null;
      }
      if (sel.startsWith('link')) {
        const relMatch = sel.match(/link\[rel="(.+)"\]/);
        if (relMatch) return this.nodes.find((n) => n.rel === relMatch[1]) || null;
      }
      if (sel.startsWith('script')) {
        const idMatch = sel.match(/#(.+)/);
        if (idMatch) return this.nodes.find((n) => n.id === idMatch[1]) || null;
      }
      return null;
    },
    getElementById(id) { return this.nodes.find((n) => n.id === id) || null; },
    appendChild(n) {
      this.nodes.push(n);
    },
  };
  return { head, createElement, getElementById: (id) => head.nodes.find((n) => n.id === id) || null };
} 

// Setup environment
globalThis.location = { pathname: '/about/', href: 'https://site/about/', hostname: 'site', origin: 'https://site' };

// Replace setTimeout to run immediately for predictability
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (cb, delay) => { cb(); return 1; };

const ROUTES = {
  default: { title: 'Home', description: 'Home page', type: 'ProfilePage', image: '' },
  '/about/': { title: 'About', description: 'About me', type: 'AboutPage', image: '/img-about.png' },
};
const BASE = 'https://site';
const BRAND = { name: 'Site Owner' };

const doc = makeDoc();
const result = orchestrateHead(doc, { BASE_URL: BASE, BRAND_DATA: BRAND, ROUTES, BUSINESS_FAQS: [] });

// Validate page meta push
const event = globalThis.dataLayer?.find((i) => i.event === 'pageMetadataReady');
assert.ok(event, 'pageMetadataReady pushed');
assert.strictEqual(event.page_meta.page_title, 'About');

// Validate core meta
const desc = doc.head.querySelector('meta[name="description"]');
assert.ok(desc);
assert.strictEqual(desc.content, 'About me');

// Validate manifest link
const manifest = doc.head.querySelector('link[rel="manifest"]');
assert.ok(manifest);
assert.strictEqual(manifest.href, '/manifest.json');

// Validate canonical set by applyCanonicalLinks
const canonical = doc.head.querySelector('link[rel="canonical"]');
assert.ok(canonical);
assert.strictEqual(canonical.href, 'https://site/about/');

// Validate that schema script was injected
const script = doc.head.nodes.find((n) => n.nodeName === 'SCRIPT' && n.id === 'head-complete-ldjson');
assert.ok(script, 'ld+json script injected');

// Validate icons
const icon32 = doc.head.nodes.find((n) => n.rel === 'icon' && n.sizes === '32x32');
assert.ok(icon32, '32x32 icon injected');
assert.strictEqual(icon32.href, `${BASE}/content/assets/img/icons/icon-32.png`);
const apple = doc.head.nodes.find((n) => n.rel === 'apple-touch-icon');
assert.ok(apple, 'apple touch icon injected');
assert.strictEqual(apple.href, `${BASE}/content/assets/img/icons/apple-touch-icon.png`);
const shortcut = doc.head.nodes.find((n) => n.rel === 'shortcut icon');
assert.ok(shortcut, 'shortcut icon injected');
assert.strictEqual(shortcut.href, `${BASE}/content/assets/img/icons/favicon.ico`);

// restore
globalThis.setTimeout = realSetTimeout;

console.log('orchestrator tests passed');
