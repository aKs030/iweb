import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injectTemplates } from './template-injector.js';

test('injectTemplates', async (t) => {
  await t.test('injects head template', () => {
    const html =
      '<html><head><!-- INJECT:BASE-HEAD --></head><body></body></html>';
    const templates = { head: '<meta charset="utf-8">' };
    const result = injectTemplates(html, templates);
    assert.equal(
      result,
      '<html><head><meta charset="utf-8"></head><body></body></html>',
    );
  });

  await t.test('injects loader template', () => {
    const html = '<html><body><!-- INJECT:BASE-LOADER --></body></html>';
    const templates = { loader: '<div id="loader"></div>' };
    const result = injectTemplates(html, templates);
    assert.equal(result, '<html><body><div id="loader"></div></body></html>');
  });

  await t.test('injects both templates', () => {
    const html =
      '<html><head><!-- INJECT:BASE-HEAD --></head><body><!-- INJECT:BASE-LOADER --></body></html>';
    const templates = { head: '<meta>', loader: '<div>' };
    const result = injectTemplates(html, templates);
    assert.equal(result, '<html><head><meta></head><body><div></body></html>');
  });

  await t.test('handles whitespace in markers', () => {
    const html = '<!--INJECT:BASE-HEAD--> <!--  INJECT:BASE-LOADER  -->';
    const templates = { head: 'H', loader: 'L' };
    const result = injectTemplates(html, templates);
    assert.equal(result, 'H L');
  });

  await t.test('does nothing if templates are missing', () => {
    const html = '<!-- INJECT:BASE-HEAD -->';
    const result = injectTemplates(html, {});
    assert.equal(result, html);
  });

  await t.test('does nothing if markers are missing', () => {
    const html = '<html></html>';
    const templates = { head: '<meta>' };
    const result = injectTemplates(html, templates);
    assert.equal(result, html);
  });

  await t.test('replaces multiple occurrences', () => {
    const html = '<!-- INJECT:BASE-HEAD --> <!-- INJECT:BASE-HEAD -->';
    const templates = { head: 'H' };
    const result = injectTemplates(html, templates);
    assert.equal(result, 'H H');
  });
});
