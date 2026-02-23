import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, extractTitle } from './_search-utils.js';

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

describe('extractTitle', () => {
  it('extracts title from simple filename', () => {
    assert.equal(extractTitle('my-page.html', '/my-page'), 'My Page');
    assert.equal(
      extractTitle('hello-world.html', '/hello-world'),
      'Hello World',
    );
  });

  it('handles root path', () => {
    assert.equal(extractTitle('index.html', '/'), 'Startseite');
    assert.equal(extractTitle('', '/'), 'Startseite');
  });

  it('handles top-level directory mapping', () => {
    assert.equal(extractTitle('index.html', '/projekte'), 'Projekte Übersicht');
    assert.equal(extractTitle('index.html', '/blog'), 'Blog Übersicht');
  });

  it('handles nested paths', () => {
    assert.equal(extractTitle('my-post.html', '/blog/my-post'), 'My Post');
  });

  it('handles app query parameters', () => {
    assert.equal(
      extractTitle('index.html', '/projekte/?app=calculator'),
      'Calculator',
    );
    assert.equal(
      extractTitle('index.html', '/projekte/?app=memory-game'),
      'Memory Game',
    );
  });

  it('falls back to filename if URL is missing/empty', () => {
    assert.equal(extractTitle('some-page.html', ''), 'Some Page');
  });
});
