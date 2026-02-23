import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl } from './_search-utils.js';

describe('normalizeUrl', () => {
  it('handles empty input', () => {
    assert.equal(normalizeUrl(null), '/');
    assert.equal(normalizeUrl(undefined), '/');
    assert.equal(normalizeUrl(''), '/');
  });

  it('removes domain', () => {
    assert.equal(normalizeUrl('https://example.com/foo'), '/foo');
    assert.equal(normalizeUrl('http://www.test.de/bar'), '/bar');
  });

  it('handles index.html', () => {
    assert.equal(normalizeUrl('/index.html'), '/');
    assert.equal(normalizeUrl('https://site.com/sub/index.html'), '/sub');
  });

  it('removes query parameters', () => {
    assert.equal(normalizeUrl('/foo?bar=baz'), '/foo');
  });

  it('removes .html extension', () => {
    assert.equal(normalizeUrl('/page.html'), '/page');
    assert.equal(normalizeUrl('/section/sub.html'), '/section/sub');
  });

  it('keeps app deep links', () => {
    assert.equal(normalizeUrl('/projekte/?app=test'), '/projekte/?app=test');
    assert.equal(
      normalizeUrl('https://site.com/projekte/index.html?app=foo'),
      '/projekte/?app=foo',
    );
  });
});
