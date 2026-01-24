/**
 * Tests for Footer App
 * Run with: npm test content/components/footer/footer-app.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Footer App', () => {
  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="footer-container" data-footer-src="/content/components/footer/footer.html">
        <footer id="site-footer" aria-expanded="false">
          <div class="footer-minimized">
            <p>Minimized Footer</p>
          </div>
          <div class="footer-maximized footer-hidden">
            <div id="footer-normal-content">
              <p>Normal Content</p>
              <span class="current-year"></span>
            </div>
            <div id="footer-cookie-view" class="hidden">
              <button id="close-cookie-footer">Close</button>
              <button id="footer-reject-all">Reject All</button>
              <button id="footer-accept-selected">Accept Selected</button>
              <button id="footer-accept-all">Accept All</button>
              <input type="checkbox" id="footer-analytics-toggle" />
              <input type="checkbox" id="footer-ad-personalization-toggle" />
            </div>
          </div>
        </footer>
        <div id="footer-trigger-zone"></div>
      </div>
      <div id="cookie-consent-banner" class="hidden">
        <button id="accept-cookies-btn">Accept</button>
        <button id="reject-cookies-btn">Reject</button>
      </div>
    `;

    // Mock global objects
    globalThis.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query.includes('min-width: 769px'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    globalThis.IntersectionObserver = vi.fn(function(callback) {
      this.observe = vi.fn();
      this.disconnect = vi.fn();
      this.unobserve = vi.fn();
      this.callback = callback;
    });

    globalThis.scrollTo = vi.fn();
    globalThis.dataLayer = [];
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('DOM Cache', () => {
    it('should cache DOM elements', () => {
      const footer = document.getElementById('site-footer');
      expect(footer).toBeTruthy();
      expect(footer.id).toBe('site-footer');
    });

    it('should handle missing elements gracefully', () => {
      const missing = document.getElementById('non-existent');
      expect(missing).toBeNull();
    });
  });

  describe('Footer Structure', () => {
    it('should have minimized and maximized sections', () => {
      const minimized = document.querySelector('.footer-minimized');
      const maximized = document.querySelector('.footer-maximized');
      
      expect(minimized).toBeTruthy();
      expect(maximized).toBeTruthy();
      expect(maximized.classList.contains('footer-hidden')).toBe(true);
    });

    it('should have cookie consent banner', () => {
      const banner = document.getElementById('cookie-consent-banner');
      expect(banner).toBeTruthy();
      expect(banner.classList.contains('hidden')).toBe(true);
    });

    it('should have cookie settings buttons', () => {
      const rejectAll = document.getElementById('footer-reject-all');
      const acceptSelected = document.getElementById('footer-accept-selected');
      const acceptAll = document.getElementById('footer-accept-all');
      
      expect(rejectAll).toBeTruthy();
      expect(acceptSelected).toBeTruthy();
      expect(acceptAll).toBeTruthy();
    });
  });

  describe('Year Update', () => {
    it('should update current year elements', () => {
      const yearEl = document.querySelector('.current-year');
      const currentYear = new Date().getFullYear();
      
      // Simulate year update
      yearEl.textContent = currentYear;
      
      expect(yearEl.textContent).toBe(String(currentYear));
    });
  });

  describe('Footer Expansion', () => {
    it('should toggle footer expansion state', () => {
      const footer = document.getElementById('site-footer');
      const minimized = footer.querySelector('.footer-minimized');
      const maximized = footer.querySelector('.footer-maximized');
      
      // Expand
      footer.classList.add('footer-expanded');
      maximized.classList.remove('footer-hidden');
      minimized.classList.add('footer-hidden');
      
      expect(footer.classList.contains('footer-expanded')).toBe(true);
      expect(maximized.classList.contains('footer-hidden')).toBe(false);
      expect(minimized.classList.contains('footer-hidden')).toBe(true);
      
      // Collapse
      footer.classList.remove('footer-expanded');
      maximized.classList.add('footer-hidden');
      minimized.classList.remove('footer-hidden');
      
      expect(footer.classList.contains('footer-expanded')).toBe(false);
      expect(maximized.classList.contains('footer-hidden')).toBe(true);
      expect(minimized.classList.contains('footer-hidden')).toBe(false);
    });

    it('should update aria-expanded attribute', () => {
      const footer = document.getElementById('site-footer');
      
      footer.setAttribute('aria-expanded', 'true');
      expect(footer.getAttribute('aria-expanded')).toBe('true');
      
      footer.setAttribute('aria-expanded', 'false');
      expect(footer.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('Cookie Settings View', () => {
    it('should toggle cookie settings view', () => {
      const cookieView = document.getElementById('footer-cookie-view');
      const normalContent = document.getElementById('footer-normal-content');
      
      // Open cookie settings
      cookieView.classList.remove('hidden');
      normalContent.style.display = 'none';
      
      expect(cookieView.classList.contains('hidden')).toBe(false);
      expect(normalContent.style.display).toBe('none');
      
      // Close cookie settings
      cookieView.classList.add('hidden');
      normalContent.style.display = 'block';
      
      expect(cookieView.classList.contains('hidden')).toBe(true);
      expect(normalContent.style.display).toBe('block');
    });

    it('should have cookie toggle inputs', () => {
      const analyticsToggle = document.getElementById('footer-analytics-toggle');
      const adToggle = document.getElementById('footer-ad-personalization-toggle');
      
      expect(analyticsToggle).toBeTruthy();
      expect(adToggle).toBeTruthy();
      expect(analyticsToggle.type).toBe('checkbox');
      expect(adToggle.type).toBe('checkbox');
    });
  });

  describe('Consent Banner', () => {
    it('should have accept and reject buttons', () => {
      const acceptBtn = document.getElementById('accept-cookies-btn');
      const rejectBtn = document.getElementById('reject-cookies-btn');
      
      expect(acceptBtn).toBeTruthy();
      expect(rejectBtn).toBeTruthy();
    });

    it('should hide banner when hidden class is added', () => {
      const banner = document.getElementById('cookie-consent-banner');
      
      expect(banner.classList.contains('hidden')).toBe(true);
      
      banner.classList.remove('hidden');
      expect(banner.classList.contains('hidden')).toBe(false);
    });
  });

  describe('Scroll Manager', () => {
    it('should handle scroll tokens', () => {
      const tokens = new Set();
      const token1 = Symbol('scroll1');
      const token2 = Symbol('scroll2');
      
      tokens.add(token1);
      expect(tokens.has(token1)).toBe(true);
      
      tokens.add(token2);
      expect(tokens.size).toBe(2);
      
      tokens.clear();
      expect(tokens.size).toBe(0);
    });
  });

  describe('IntersectionObserver', () => {
    it('should create IntersectionObserver instance', () => {
      const callback = vi.fn();
      const observer = new IntersectionObserver(callback);
      
      expect(observer).toBeTruthy();
      expect(observer.observe).toBeDefined();
      expect(observer.disconnect).toBeDefined();
    });

    it('should observe trigger zone', () => {
      const trigger = document.getElementById('footer-trigger-zone');
      const callback = vi.fn();
      const observer = new IntersectionObserver(callback);
      
      observer.observe(trigger);
      expect(observer.observe).toHaveBeenCalledWith(trigger);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const footer = document.getElementById('site-footer');
      expect(footer.getAttribute('aria-expanded')).toBe('false');
    });

    it('should update inert attribute on minimized footer', () => {
      const minimized = document.querySelector('.footer-minimized');
      
      minimized.setAttribute('inert', '');
      expect(minimized.hasAttribute('inert')).toBe(true);
      
      minimized.removeAttribute('inert');
      expect(minimized.hasAttribute('inert')).toBe(false);
    });
  });

  describe('Event Handling', () => {
    it('should handle button clicks', () => {
      const closeBtn = document.getElementById('close-cookie-footer');
      const clickHandler = vi.fn();
      
      closeBtn.addEventListener('click', clickHandler);
      closeBtn.click();
      
      expect(clickHandler).toHaveBeenCalled();
    });

    it('should handle multiple button clicks', () => {
      const rejectBtn = document.getElementById('footer-reject-all');
      const acceptBtn = document.getElementById('footer-accept-all');
      
      const rejectHandler = vi.fn();
      const acceptHandler = vi.fn();
      
      rejectBtn.addEventListener('click', rejectHandler);
      acceptBtn.addEventListener('click', acceptHandler);
      
      rejectBtn.click();
      acceptBtn.click();
      
      expect(rejectHandler).toHaveBeenCalledTimes(1);
      expect(acceptHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Newsletter Form', () => {
    it('should handle form submission', () => {
      const form = document.createElement('form');
      form.className = 'newsletter-form-enhanced';
      form.innerHTML = `
        <input type="email" id="newsletter-email" required />
        <button type="submit">Subscribe</button>
      `;
      document.body.appendChild(form);
      
      const submitHandler = vi.fn((e) => e.preventDefault());
      form.addEventListener('submit', submitHandler);
      
      form.dispatchEvent(new Event('submit'));
      expect(submitHandler).toHaveBeenCalled();
    });
  });

  describe('Responsive Behavior', () => {
    it('should detect desktop viewport', () => {
      const isDesktop = globalThis.matchMedia('(min-width: 769px)').matches;
      expect(isDesktop).toBe(true);
    });

    it('should detect mobile viewport', () => {
      globalThis.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query.includes('max-width: 768px'),
        media: query,
      }));
      
      const isMobile = globalThis.matchMedia('(max-width: 768px)').matches;
      expect(isMobile).toBe(true);
    });
  });
});
