import { test } from 'node:test';
import assert from 'node:assert';
import { escapeHTML } from './html-sanitizer.js';

test('escapeHTML - basic escaping', () => {
  assert.strictEqual(escapeHTML('&'), '&amp;');
  assert.strictEqual(escapeHTML('<'), '&lt;');
  assert.strictEqual(escapeHTML('>'), '&gt;');
  assert.strictEqual(escapeHTML('"'), '&quot;');
  assert.strictEqual(escapeHTML("'"), '&#39;');
});

test('escapeHTML - mixed content', () => {
  assert.strictEqual(
    escapeHTML('<script>alert("xss")</script>'),
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
  );
  assert.strictEqual(escapeHTML('Hello & Welcome!'), 'Hello &amp; Welcome!');
});

test('escapeHTML - repeated characters', () => {
  assert.strictEqual(escapeHTML('<<<'), '&lt;&lt;&lt;');
  assert.strictEqual(escapeHTML('&&&'), '&amp;&amp;&amp;');
});

test('escapeHTML - no special characters', () => {
  assert.strictEqual(escapeHTML('Hello World'), 'Hello World');
  assert.strictEqual(escapeHTML('12345'), '12345');
});

test('escapeHTML - empty and invalid inputs', () => {
  assert.strictEqual(escapeHTML(''), '');
  assert.strictEqual(escapeHTML(null), '');
  assert.strictEqual(escapeHTML(undefined), '');
  assert.strictEqual(escapeHTML(123), '');
  assert.strictEqual(escapeHTML({}), '');
  assert.strictEqual(escapeHTML([]), '');
});

test('escapeHTML - long strings', () => {
  const longString = '<a>'.repeat(1000);
  const expected = '&lt;a&gt;'.repeat(1000);
  assert.strictEqual(escapeHTML(longString), expected);
});
