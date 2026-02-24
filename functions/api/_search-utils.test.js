import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, extractTitle } from './_search-url.js';

describe('normalizeUrl', () => {
  it('handles empty input', () => {
    assert.equal(normalizeUrl(''), '/');
    assert.equal(normalizeUrl(null), '/');
    assert.equal(normalizeUrl(undefined), '/');
  });

  it('removes domain', () => {
    assert.equal(normalizeUrl('https://example.com/foo'), '/foo');
    assert.equal(normalizeUrl('http://localhost:8788/bar'), '/bar');
  });

  it('handles index.html', () => {
    assert.equal(normalizeUrl('/foo/index.html'), '/foo');
    assert.equal(normalizeUrl('/index.html'), '/');
  });

  it('removes query parameters', () => {
    assert.equal(normalizeUrl('/foo?bar=baz'), '/foo');
  });

  it('removes .html extension', () => {
    assert.equal(normalizeUrl('/page.html'), '/page');
  });

  it('keeps app deep links', () => {
    assert.equal(normalizeUrl('/projekte?app=snake'), '/projekte/?app=snake');
    assert.equal(
      normalizeUrl('https://site.com/projekte/index.html?app=quiz&foo=bar'),
      '/projekte/?app=quiz',
    );
  });
});

describe('extractTitle', () => {
  it('extracts title from simple filename', () => {
    assert.equal(extractTitle('my-page.html', '/my-page'), 'My Page');
  });

  it('handles root path', () => {
    assert.equal(extractTitle('index.html', '/'), 'Startseite');
  });

  it('handles top-level directory mapping', () => {
    assert.equal(
      extractTitle('index.html', '/projekte/'),
      'Projekte Übersicht',
    );
  });

  it('handles nested paths', () => {
    assert.equal(extractTitle('my-post.html', '/blog/my-post'), 'My Post');
  });

  it('handles app query parameters', () => {
    assert.equal(
      extractTitle('index.html', '/projekte/?app=super-tool'),
      'Super Tool',
    );
  });

  it('falls back to filename if URL is missing/empty', () => {
    assert.equal(extractTitle('some-file.html', ''), 'Some File');
  });
});
