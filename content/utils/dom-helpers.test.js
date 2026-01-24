/**
 * Tests for DOM Helper Utilities
 * Tests head manipulation and link/meta upserts
 * 
 * @module dom-helpers.test
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { upsertHeadLink, upsertMeta } from './dom-helpers.js';

describe('DOM Helpers', () => {
  beforeEach(() => {
    // Clean up head before each test
    document.head.innerHTML = '';
  });

  afterEach(() => {
    // Clean up head after each test
    document.head.innerHTML = '';
  });

  describe('upsertHeadLink', () => {
    test('should create a new link element', () => {
      const link = upsertHeadLink({
        rel: 'stylesheet',
        href: '/styles.css',
      });

      expect(link).toBeTruthy();
      expect(link.rel).toBe('stylesheet');
      expect(link.href).toContain('/styles.css');
      expect(document.head.contains(link)).toBe(true);
    });

    test('should return existing link if already present', () => {
      const link1 = upsertHeadLink({
        rel: 'stylesheet',
        href: '/styles.css',
      });

      const link2 = upsertHeadLink({
        rel: 'stylesheet',
        href: '/styles.css',
      });

      expect(link1).toBe(link2);
      expect(document.head.querySelectorAll('link').length).toBe(1);
    });

    test('should handle link with "as" attribute', () => {
      const link = upsertHeadLink({
        rel: 'preload',
        href: '/script.js',
        as: 'script',
      });

      expect(link.as).toBe('script');
      expect(link.rel).toBe('preload');
    });

    test('should handle crossOrigin attribute', () => {
      const link = upsertHeadLink({
        rel: 'stylesheet',
        href: 'https://example.com/styles.css',
        crossOrigin: 'anonymous',
      });

      expect(link.crossOrigin).toBe('anonymous');
    });

    test('should handle id attribute', () => {
      const link = upsertHeadLink({
        rel: 'stylesheet',
        href: '/styles.css',
        id: 'main-styles',
      });

      expect(link.id).toBe('main-styles');
    });

    test('should handle dataset attributes', () => {
      const link = upsertHeadLink({
        rel: 'stylesheet',
        href: '/styles.css',
        dataset: {
          theme: 'dark',
          version: '1.0',
        },
      });

      expect(link.dataset.theme).toBe('dark');
      expect(link.dataset.version).toBe('1.0');
    });

    test('should handle custom attributes', () => {
      const link = upsertHeadLink({
        rel: 'stylesheet',
        href: '/styles.css',
        attrs: {
          media: 'print',
          title: 'Print Styles',
        },
      });

      expect(link.getAttribute('media')).toBe('print');
      expect(link.getAttribute('title')).toBe('Print Styles');
    });

    test('should handle onload callback', () => {
      let loaded = false;
      const link = upsertHeadLink({
        rel: 'stylesheet',
        href: '/styles.css',
        onload: () => {
          loaded = true;
        },
      });

      expect(link.onload).toBeTruthy();
      link.onload();
      expect(loaded).toBe(true);
    });

    test('should return null if href is missing', () => {
      const link = upsertHeadLink({
        rel: 'stylesheet',
      });

      expect(link).toBeNull();
    });

    test('should return null if rel is missing', () => {
      const link = upsertHeadLink({
        href: '/styles.css',
      });

      expect(link).toBeNull();
    });

    test('should handle empty options', () => {
      const link = upsertHeadLink();
      expect(link).toBeNull();
    });

    test('should differentiate links with different "as" attributes', () => {
      const link1 = upsertHeadLink({
        rel: 'preload',
        href: '/resource.js',
        as: 'script',
      });

      const link2 = upsertHeadLink({
        rel: 'preload',
        href: '/resource.js',
        as: 'style',
      });

      expect(link1).not.toBe(link2);
      expect(document.head.querySelectorAll('link').length).toBe(2);
    });
  });

  describe('upsertMeta', () => {
    test('should create a new meta element with name', () => {
      const meta = upsertMeta({
        name: 'description',
        content: 'Test description',
      });

      expect(meta).toBeTruthy();
      expect(meta.getAttribute('name')).toBe('description');
      expect(meta.getAttribute('content')).toBe('Test description');
      expect(document.head.contains(meta)).toBe(true);
    });

    test('should create a new meta element with property', () => {
      const meta = upsertMeta({
        property: 'og:title',
        content: 'Test Title',
      });

      expect(meta).toBeTruthy();
      expect(meta.getAttribute('property')).toBe('og:title');
      expect(meta.getAttribute('content')).toBe('Test Title');
    });

    test('should update existing meta element with name', () => {
      const meta1 = upsertMeta({
        name: 'description',
        content: 'First description',
      });

      const meta2 = upsertMeta({
        name: 'description',
        content: 'Updated description',
      });

      expect(meta1).toBe(meta2);
      expect(meta2.getAttribute('content')).toBe('Updated description');
      expect(document.head.querySelectorAll('meta').length).toBe(1);
    });

    test('should update existing meta element with property', () => {
      const meta1 = upsertMeta({
        property: 'og:title',
        content: 'First Title',
      });

      const meta2 = upsertMeta({
        property: 'og:title',
        content: 'Updated Title',
      });

      expect(meta1).toBe(meta2);
      expect(meta2.getAttribute('content')).toBe('Updated Title');
    });

    test('should handle missing name and property', () => {
      const meta = upsertMeta({
        content: 'Test content',
      });

      // Should still create element but with undefined name
      expect(meta).toBeTruthy();
    });

    test('should handle missing content', () => {
      const meta = upsertMeta({
        name: 'description',
      });

      expect(meta).toBeTruthy();
      expect(meta.getAttribute('content')).toBe('undefined');
    });

    test('should prefer property over name', () => {
      const meta = upsertMeta({
        name: 'description',
        property: 'og:description',
        content: 'Test',
      });

      expect(meta.getAttribute('property')).toBe('og:description');
      expect(meta.getAttribute('name')).toBeNull();
    });

    test('should handle empty options', () => {
      const meta = upsertMeta({});
      expect(meta).toBeTruthy();
    });
  });
});
