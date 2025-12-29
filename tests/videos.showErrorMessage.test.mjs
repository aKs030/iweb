import assert from "node:assert/strict";
import { showErrorMessage, showInfoMessage } from "../pages/videos/videos.js";

console.log("Running showErrorMessage tests...");

// Minimal DOM mock (global document) used by showErrorMessage
const origDocument = globalThis.document;
const container = { nodes: [], insertBefore(node, ref) { this.nodes.unshift(node); } };
const statusEl = { textContent: '' };
const fakeDoc = {
  querySelector(sel) {
    if (sel === '.videos-main .container') return container;
    return null;
  },
  createElement(type) {
    return { nodeName: type.toUpperCase(), className: undefined, textContent: undefined };
  },
  getElementById(id) {
    if (id === 'videos-status') return statusEl;
    return null;
  }
};

globalThis.document = fakeDoc;

// 1) Generic error message
showErrorMessage(new Error('boom'));
assert.ok(container.nodes.length === 1, 'error node inserted');
assert.ok(container.nodes[0].textContent.includes('Fehler beim Laden'), 'contains base message');
assert.strictEqual(statusEl.textContent, container.nodes[0].textContent, 'status updated');

// 2) 403 with blocked referrer hint
container.nodes = [];
showErrorMessage({ status: 403, body: 'API_KEY_HTTP_REFERRER_BLOCKED' });
assert.ok(container.nodes.length === 1, 'error node inserted for 403');
assert.ok(container.nodes[0].textContent.includes('API-Zugriff verweigert'), '403 message included');

// 3) 400 invalid API key
container.nodes = [];
showErrorMessage({ status: 400, body: 'API_KEY_INVALID' });
assert.ok(container.nodes.length === 1, 'error node inserted for 400');
assert.ok(container.nodes[0].textContent.includes('API-Key'), '400 message hint included');

// 4) Info message
container.nodes = [];
showInfoMessage('Keine Uploads');
assert.ok(container.nodes.length === 1, 'info node inserted');
assert.ok(container.nodes[0].className === 'video-note', 'note class used');
assert.strictEqual(statusEl.textContent, 'Keine Uploads');

// restore
globalThis.document = origDocument;
console.log('showErrorMessage tests passed');