/**
 * Tests for Global State Management
 * 
 * @module global-state.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { setupBackwardCompatibility, GlobalState, createDeprecatedProxy } from './global-state.js';

describe('Global State Management', () => {
  beforeEach(() => {
    // Clear deprecation warnings before each test
    GlobalState.clearDeprecationWarnings();
  });
  
  afterEach(() => {
    // Clean up after each test
    GlobalState.clearDeprecationWarnings();
  });
  
  describe('window.AKS namespace', () => {
    it('should initialize window.AKS namespace', () => {
      expect(window.AKS).toBeDefined();
      expect(typeof window.AKS).toBe('object');
    });
    
    it('should have all expected properties', () => {
      expect(window.AKS).toHaveProperty('threeEarthCleanup');
      expect(window.AKS).toHaveProperty('threeEarthSystem');
      expect(window.AKS).toHaveProperty('forceThreeEarth');
      expect(window.AKS).toHaveProperty('announce');
      expect(window.AKS).toHaveProperty('SectionLoader');
      expect(window.AKS).toHaveProperty('mainDelegatedRemove');
      expect(window.AKS).toHaveProperty('robotCompanionTexts');
      expect(window.AKS).toHaveProperty('youtubeChannelId');
      expect(window.AKS).toHaveProperty('youtubeChannelHandle');
    });
    
    it('should have internal tracking properties', () => {
      expect(window.AKS._migrationWarningsShown).toBeInstanceOf(Set);
      expect(window.AKS._deprecationWarnings).toBeInstanceOf(Map);
    });
  });
  
  describe('GlobalState access helpers', () => {
    it('should get and set threeEarthCleanup', () => {
      const cleanup = () => {};
      GlobalState.threeEarthCleanup = cleanup;
      expect(GlobalState.threeEarthCleanup).toBe(cleanup);
    });
    
    it('should get and set announce', () => {
      const announce = () => {};
      GlobalState.announce = announce;
      expect(GlobalState.announce).toBe(announce);
    });
    
    it('should get and set SectionLoader', () => {
      const loader = { init: () => {} };
      GlobalState.SectionLoader = loader;
      expect(GlobalState.SectionLoader).toBe(loader);
    });
    
    it('should handle null values', () => {
      GlobalState.threeEarthCleanup = null;
      expect(GlobalState.threeEarthCleanup).toBeNull();
    });
  });
  
  describe('Backward compatibility', () => {
    beforeEach(() => {
      setupBackwardCompatibility();
      GlobalState.clearDeprecationWarnings();
    });
    
    it('should setup backward compatibility proxies', () => {
      // Set via new path
      window.AKS.threeEarthCleanup = 'test';
      
      // Access via old path should work
      expect(globalThis.__threeEarthCleanup).toBe('test');
    });
    
    it('should show deprecation warning on first access', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // First access
      const _value = globalThis.__threeEarthCleanup;
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEPRECATED]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('globalThis.__threeEarthCleanup')
      );
      
      consoleSpy.mockRestore();
    });
    
    it('should not show duplicate warnings', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Multiple accesses
      globalThis.__threeEarthCleanup;
      globalThis.__threeEarthCleanup;
      globalThis.__threeEarthCleanup;
      
      // Should only warn once
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      
      consoleSpy.mockRestore();
    });
    
    it('should track deprecation usage', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Access deprecated property
      globalThis.__threeEarthCleanup;
      
      const stats = GlobalState.getDeprecationStats();
      expect(stats.totalWarnings).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Feature: iweb-portfolio-improvements, Property 13: Backward Compatibility Preservation', () => {
    beforeEach(() => {
      setupBackwardCompatibility();
      GlobalState.clearDeprecationWarnings();
    });
    
    it('old paths return same values as new paths', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.constant(null),
            fc.constant(undefined),
            fc.object()
          ),
          (value) => {
            // Set via new path
            window.AKS.threeEarthCleanup = value;
            
            // Get via old path should return same value
            expect(globalThis.__threeEarthCleanup).toBe(value);
            
            // Set via old path
            globalThis.__threeEarthCleanup = value;
            
            // Get via new path should return same value
            expect(window.AKS.threeEarthCleanup).toBe(value);
          }
        ),
        { numRuns: 100 }
      );
      
      consoleSpy.mockRestore();
    });
    
    it('all deprecated paths maintain consistency', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const testValue = { test: 'value' };
      
      // Test all deprecated paths
      window.AKS.announce = testValue;
      expect(globalThis.announce).toBe(testValue);
      
      window.AKS.SectionLoader = testValue;
      expect(globalThis.SectionLoader).toBe(testValue);
      
      window.AKS.threeEarthSystem = testValue;
      expect(globalThis.threeEarthSystem).toBe(testValue);
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Feature: iweb-portfolio-improvements, Property 14: Deprecation Warning Emission', () => {
    beforeEach(() => {
      setupBackwardCompatibility();
      GlobalState.clearDeprecationWarnings();
    });
    
    it('first access emits warning, subsequent accesses do not', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          (accessCount) => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            // Clear warnings for this test
            GlobalState.clearDeprecationWarnings();
            
            // Access multiple times
            for (let i = 0; i < accessCount; i++) {
              globalThis.__threeEarthCleanup;
            }
            
            // Should only warn once
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith(
              expect.stringContaining('[DEPRECATED]')
            );
            
            consoleSpy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('different paths emit separate warnings', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Access different deprecated paths
      globalThis.__threeEarthCleanup;
      globalThis.announce;
      globalThis.SectionLoader;
      
      // Should warn for each unique path
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('createDeprecatedProxy', () => {
    it('should create a valid property descriptor', () => {
      let value = 'initial';
      const descriptor = createDeprecatedProxy(
        'test.old',
        'test.new',
        () => value,
        (v) => { value = v; }
      );
      
      expect(descriptor).toHaveProperty('get');
      expect(descriptor).toHaveProperty('set');
      expect(descriptor.configurable).toBe(true);
      expect(descriptor.enumerable).toBe(false);
    });
    
    it('should call getter and setter correctly', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      let value = 'initial';
      const descriptor = createDeprecatedProxy(
        'test.old',
        'test.new',
        () => value,
        (v) => { value = v; }
      );
      
      // Test getter
      expect(descriptor.get()).toBe('initial');
      
      // Test setter
      descriptor.set('updated');
      expect(value).toBe('updated');
      expect(descriptor.get()).toBe('updated');
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('getDeprecationStats', () => {
    beforeEach(() => {
      setupBackwardCompatibility();
      GlobalState.clearDeprecationWarnings();
    });
    
    it('should return deprecation statistics', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Access some deprecated properties
      globalThis.__threeEarthCleanup;
      globalThis.announce;
      
      const stats = GlobalState.getDeprecationStats();
      
      expect(stats).toHaveProperty('warnings');
      expect(stats).toHaveProperty('totalWarnings');
      expect(stats.totalWarnings).toBe(2);
      
      consoleSpy.mockRestore();
    });
    
    it('should track usage counts', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Access deprecated property multiple times
      globalThis.__threeEarthCleanup;
      globalThis.__threeEarthCleanup;
      globalThis.__threeEarthCleanup;
      
      const stats = GlobalState.getDeprecationStats();
      const warnings = new Map(stats.warnings);
      
      expect(warnings.get('globalThis.__threeEarthCleanup')).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('clearDeprecationWarnings', () => {
    it('should clear all warnings', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      setupBackwardCompatibility();
      
      // Access deprecated property
      globalThis.__threeEarthCleanup;
      
      // Clear warnings
      GlobalState.clearDeprecationWarnings();
      
      // Check stats
      const stats = GlobalState.getDeprecationStats();
      expect(stats.totalWarnings).toBe(0);
      
      consoleSpy.mockRestore();
    });
  });
});
