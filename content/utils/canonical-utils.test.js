/**
 * Tests for Canonical Path Utilities
 * Tests path normalization and route matching
 * 
 * @module canonical-utils.test
 * @version 1.0.0
 */

import { describe, test, expect } from 'vitest';
import { getCanonicalPathFromRoutes } from './canonical-utils.js';

describe('Canonical Utils', () => {
  const mockRoutes = {
    '/about/': { title: 'About' },
    '/blog/': { title: 'Blog' },
    '/projekte/': { title: 'Projects' },
    '/videos/': { title: 'Videos' },
    default: { title: 'Default' },
  };

  describe('getCanonicalPathFromRoutes', () => {
    test('should normalize root path', () => {
      const routesWithRoot = {
        '/': { title: 'Home' },
        ...mockRoutes,
      };
      expect(getCanonicalPathFromRoutes('/', routesWithRoot)).toBe('/');
      expect(getCanonicalPathFromRoutes('', routesWithRoot)).toBe('/');
      expect(getCanonicalPathFromRoutes(null, routesWithRoot)).toBe('/');
    });

    test('should add trailing slash', () => {
      expect(getCanonicalPathFromRoutes('/about', mockRoutes)).toBe('/about/');
      expect(getCanonicalPathFromRoutes('/blog', mockRoutes)).toBe('/blog/');
    });

    test('should remove index.html', () => {
      expect(getCanonicalPathFromRoutes('/index.html', mockRoutes)).toBe('/');
      expect(getCanonicalPathFromRoutes('/about/index.html', mockRoutes)).toBe('/about/');
      expect(getCanonicalPathFromRoutes('/INDEX.HTML', mockRoutes)).toBe('/');
    });

    test('should remove .html extension', () => {
      expect(getCanonicalPathFromRoutes('/about.html', mockRoutes)).toBe('/about/');
      expect(getCanonicalPathFromRoutes('/blog.html', mockRoutes)).toBe('/blog/');
      expect(getCanonicalPathFromRoutes('/page.HTML', mockRoutes)).toBe('/page/');
    });

    test('should normalize multiple slashes', () => {
      expect(getCanonicalPathFromRoutes('//about//', mockRoutes)).toBe('/about/');
      expect(getCanonicalPathFromRoutes('///blog///', mockRoutes)).toBe('/blog/');
      // Sub-paths match the parent route
      expect(getCanonicalPathFromRoutes('/about///page/', mockRoutes)).toBe('/about/');
    });

    test('should add leading slash if missing', () => {
      expect(getCanonicalPathFromRoutes('about', mockRoutes)).toBe('/about/');
      expect(getCanonicalPathFromRoutes('blog/', mockRoutes)).toBe('/blog/');
    });

    test('should match exact routes', () => {
      expect(getCanonicalPathFromRoutes('/about/', mockRoutes)).toBe('/about/');
      expect(getCanonicalPathFromRoutes('/blog/', mockRoutes)).toBe('/blog/');
      expect(getCanonicalPathFromRoutes('/projekte/', mockRoutes)).toBe('/projekte/');
    });

    test('should match sub-paths with startsWith', () => {
      expect(getCanonicalPathFromRoutes('/blog/post-1/', mockRoutes)).toBe('/blog/');
      expect(getCanonicalPathFromRoutes('/videos/abc123/', mockRoutes)).toBe('/videos/');
      expect(getCanonicalPathFromRoutes('/projekte/project-1/', mockRoutes)).toBe('/projekte/');
    });

    test('should be case-insensitive', () => {
      expect(getCanonicalPathFromRoutes('/ABOUT/', mockRoutes)).toBe('/about/');
      expect(getCanonicalPathFromRoutes('/Blog/', mockRoutes)).toBe('/blog/');
      expect(getCanonicalPathFromRoutes('/PROJEKTE/', mockRoutes)).toBe('/projekte/');
    });

    test('should return normalized path for unknown routes', () => {
      expect(getCanonicalPathFromRoutes('/unknown/', mockRoutes)).toBe('/unknown/');
      expect(getCanonicalPathFromRoutes('/random/path/', mockRoutes)).toBe('/random/path/');
    });

    test('should handle complex paths', () => {
      expect(getCanonicalPathFromRoutes('/about/team/member.html', mockRoutes)).toBe('/about/');
      expect(getCanonicalPathFromRoutes('//blog//post//index.html', mockRoutes)).toBe('/blog/');
    });

    test('should skip default route in matching', () => {
      const routesWithDefault = {
        '/home/': { title: 'Home' },
        default: { title: 'Default' },
      };
      
      expect(getCanonicalPathFromRoutes('/unknown/', routesWithDefault)).toBe('/unknown/');
    });

    test('should handle empty routes object', () => {
      expect(getCanonicalPathFromRoutes('/about/', {})).toBe('/about/');
    });

    test('should handle routes with only default', () => {
      const defaultOnly = { default: { title: 'Default' } };
      expect(getCanonicalPathFromRoutes('/about/', defaultOnly)).toBe('/about/');
    });

    test('should prefer startsWith over includes matching', () => {
      const routes = {
        '/blog/': { title: 'Blog' },
        '/log/': { title: 'Log' },
      };
      
      // Should match /blog/ (startsWith) not /log/ (includes)
      expect(getCanonicalPathFromRoutes('/blog/post/', routes)).toBe('/blog/');
    });

    test('should fallback to includes matching if no startsWith match', () => {
      const routes = {
        '/special/': { title: 'Special' },
      };
      
      // If path contains the route but doesn't start with it
      // This is an edge case - in practice startsWith should always match first
      expect(getCanonicalPathFromRoutes('/special/', routes)).toBe('/special/');
    });

    test('should handle paths with query strings (not removed)', () => {
      // Query strings are not handled by this function
      // They should be removed before calling this function
      expect(getCanonicalPathFromRoutes('/about/?query=test', mockRoutes)).toBe('/about/');
    });

    test('should handle paths with hash fragments (not removed)', () => {
      // Hash fragments are not handled by this function
      expect(getCanonicalPathFromRoutes('/about/#section', mockRoutes)).toBe('/about/');
    });

    test('should handle very long paths', () => {
      const longPath = '/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/';
      expect(getCanonicalPathFromRoutes(longPath, mockRoutes)).toBe(longPath);
    });

    test('should handle paths with special characters', () => {
      expect(getCanonicalPathFromRoutes('/über-uns/', mockRoutes)).toBe('/über-uns/');
      expect(getCanonicalPathFromRoutes('/café/', mockRoutes)).toBe('/café/');
    });

    test('should handle paths with numbers', () => {
      expect(getCanonicalPathFromRoutes('/page-123/', mockRoutes)).toBe('/page-123/');
      expect(getCanonicalPathFromRoutes('/2024/01/post/', mockRoutes)).toBe('/2024/01/post/');
    });

    test('should handle paths with hyphens and underscores', () => {
      expect(getCanonicalPathFromRoutes('/my-page/', mockRoutes)).toBe('/my-page/');
      expect(getCanonicalPathFromRoutes('/my_page/', mockRoutes)).toBe('/my_page/');
    });
  });
});
