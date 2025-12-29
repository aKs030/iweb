import assert from "node:assert/strict";
import { upsertMeta, upsertLink } from "../content/components/head/head-complete.js";

console.log("Running upsert helpers tests...");

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
      return null;
    },
    appendChild(n) {
      this.nodes.push(n);
    },
  };
  return { head, createElement };
}

function createElement(type) {
  return {
    nodeName: type.toUpperCase(),
    name: undefined,
    property: undefined,
    content: undefined,
    rel: undefined,
    href: undefined,
    setAttribute(k, v) {
      if (k === 'name') this.name = v;
      if (k === 'property') this.property = v;
      if (k === 'content') this.content = v;
      if (k === 'rel') this.rel = v;
      if (k === 'href') this.href = v;
    },
  };
} 

// 1) upsertMeta inserts meta when missing
{
  const doc = makeDoc();
  upsertMeta(doc, 'description', 'blabla');
  const m = doc.head.querySelector('meta[name="description"]');
  assert.ok(m, 'meta inserted');
  assert.strictEqual(m.content, 'blabla');
}

// 2) upsertMeta updates existing
{
  const doc = makeDoc();
  const existing = { name: 'description', content: 'old' };
  doc.head.appendChild(existing);
  upsertMeta(doc, 'description', 'new');
  const m = doc.head.querySelector('meta[name="description"]');
  assert.strictEqual(m.content, 'new');
}

// 3) upsertMeta property
{
  const doc = makeDoc();
  upsertMeta(doc, 'og:title', 'Title', true);
  const m = doc.head.querySelector('meta[property="og:title"]');
  assert.ok(m);
  assert.strictEqual(m.content, 'Title');
}

// 4) upsertLink insert & update
{
  const doc = makeDoc();
  upsertLink(doc, 'canonical', 'https://site/');
  const l = doc.head.querySelector('link[rel="canonical"]');
  assert.ok(l);
  assert.strictEqual(l.href, 'https://site/');
  upsertLink(doc, 'canonical', 'https://site/new');
  assert.strictEqual(l.href, 'https://site/new');
}

console.log('upsert helpers tests passed');
