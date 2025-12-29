import assert from "node:assert/strict";
import { applyCanonicalLinks } from "../content/components/head/head-complete.js";

console.log("Running applyCanonicalLinks tests...");

// Minimal mock document/head
function createElement(type) {
  return {
    nodeName: type.toUpperCase(),
    rel: undefined,
    href: undefined,
    hreflang: undefined,
    setAttribute(name, value) {
      if (name === 'rel') this.rel = value;
      if (name === 'href') this.href = value;
      if (name === 'hreflang') this.hreflang = value;
    },
    getAttribute(name) {
      if (name === 'rel') return this.rel;
      if (name === 'href') return this.href;
      if (name === 'hreflang') return this.hreflang;
      return undefined;
    },
  };
}

function makeDoc(initial = []) {
  const head = {
    nodes: [...initial],
    querySelector(sel) {
      if (sel === 'link[rel="canonical"]') return this.nodes.find((n) => n.rel === 'canonical') || null;
      const m = sel.match(/link\[rel="alternate"\]\[hreflang="(.+)"\]/);
      if (m) {
        const lang = m[1];
        return this.nodes.find((n) => n.rel === 'alternate' && n.hreflang === lang) || null;
      }
      return null;
    },
    appendChild(node) {
      this.nodes.push(node);
    },
  };

  return { head, createElement };
} 

// 1) No existing canonical -> should insert
{
  const doc = makeDoc();
  applyCanonicalLinks(doc, [{ lang: 'de', href: 'https://site.de/about/' }, { lang: 'x-default', href: 'https://site.de/about/' }], 'https://site.de/about/');
  const canonical = doc.head.querySelector('link[rel="canonical"]');
  assert.ok(canonical, 'canonical inserted');
  assert.strictEqual(canonical.href, 'https://site.de/about/');
}

// 2) Existing canonical -> should update
{
  const baseLink = { rel: 'canonical', href: 'https://old/' };
  const doc = makeDoc([baseLink]);
  applyCanonicalLinks(doc, [], 'https://site.de/new/');
  const canonical = doc.head.querySelector('link[rel="canonical"]');
  assert.strictEqual(canonical.href, 'https://site.de/new/');
}

// 3) Alternates inserted
{
  const doc = makeDoc();
  applyCanonicalLinks(doc, [{ lang: 'de', href: 'https://site.de/about/' }], 'https://site.de/about/');
  const alt = doc.head.querySelector('link[rel="alternate"][hreflang="de"]');
  assert.ok(alt, 'alternate inserted');
  assert.strictEqual(alt.href, 'https://site.de/about/');
}

console.log('applyCanonicalLinks tests passed');
