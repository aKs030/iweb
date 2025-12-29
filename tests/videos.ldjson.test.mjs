import assert from 'node:assert/strict';
import { renderVideoCard } from '../pages/videos/videos.js';

console.log('Running ldjson tests...');

// Minimal DOM mock
const container = { innerHTML: '', appendChild(node) { this.last = node; } };
const grid = container;

const videoItem = { snippet: { resourceId: { videoId: 'vx' }, title: 'Test Video', description: '', thumbnails: { high: { url: 'https://i.ytimg.com/vi/vx/hqdefault.jpg' } }, publishedAt: '2025-01-01' } };

// Provide a fake detailsMap
const details = {};

// Mock document.createElement to return objects with properties used by renderVideoCard
globalThis.document = {
  createElement(type) {
    const el = { nodeName: type.toUpperCase(), className: '', innerHTML: '', dataset: {}, style: {}, child: null, appendChild(child) { this.child = child; }, setAttribute(name, value) { this[name] = value; }, getAttribute(name) { return this[name]; }, addEventListener() {}, querySelector() { return null; } };
    return el;
  },
  querySelector() { return null; }
};

// Run render
renderVideoCard(grid, videoItem, details);

// Check last appended script includes publisher suffix
const script = grid.last.child;
assert.ok(script && script.type === 'application/ld+json', 'script added');
assert.ok(script.textContent.includes('Test Video'), 'contains title');
assert.ok(script.textContent.includes('Abdulkerim'), 'contains publisher suffix');

console.log('ldjson tests passed');