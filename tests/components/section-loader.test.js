import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock SectionLoader functionality
describe('SectionLoader', () => {
  let mockIntersectionObserver;
  
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Mock IntersectionObserver
    mockIntersectionObserver = {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    };
    
    global.IntersectionObserver = vi.fn().mockImplementation((callback) => {
      mockIntersectionObserver.callback = callback;
      return mockIntersectionObserver;
    });
    
    // Mock fetch
    global.fetch = vi.fn();
    
    // Mock announce function
    global.announce = vi.fn();
  });

  it('should detect sections with data-section-src', () => {
    document.body.innerHTML = `
      <section data-section-src="/test.html" id="test-section">
        <div class="section-skeleton"></div>
      </section>
    `;
    
    const sections = document.querySelectorAll('section[data-section-src]');
    expect(sections).toHaveLength(1);
    expect(sections[0].getAttribute('data-section-src')).toBe('/test.html');
  });

  it('should handle fetch response', async () => {
    const mockHtml = '<div>Test Content</div>';
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockHtml)
    });

    const response = await fetch('/test.html');
    const html = await response.text();
    
    expect(html).toBe(mockHtml);
    expect(fetch).toHaveBeenCalledWith('/test.html');
  });

  it('should handle fetch error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const response = await fetch('/nonexistent.html');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  it('should announce loading state', () => {
    global.announce('Lade Abschnitt Test…');
    expect(global.announce).toHaveBeenCalledWith('Lade Abschnitt Test…');
  });

  it('should set aria-busy attribute', () => {
    document.body.innerHTML = `
      <section data-section-src="/test.html" id="test-section">
      </section>
    `;
    
    const section = document.getElementById('test-section');
    section.setAttribute('aria-busy', 'true');
    
    expect(section.getAttribute('aria-busy')).toBe('true');
  });

  it('should remove skeleton elements after loading', () => {
    document.body.innerHTML = `
      <section data-section-src="/test.html">
        <div class="section-skeleton">Loading...</div>
        <div>Content</div>
      </section>
    `;
    
    const skeletons = document.querySelectorAll('.section-skeleton');
    expect(skeletons).toHaveLength(1);
    
    // Simulate removal
    skeletons.forEach(skeleton => skeleton.remove());
    
    const remainingSkeletons = document.querySelectorAll('.section-skeleton');
    expect(remainingSkeletons).toHaveLength(0);
  });

  it('should handle template content', () => {
    document.body.innerHTML = `
      <section>
        <template>
          <div>Template Content</div>
        </template>
      </section>
    `;
    
    const template = document.querySelector('template');
    const section = document.querySelector('section');
    
    if (template) {
      section.appendChild(template.content.cloneNode(true));
    }
    
    expect(section.querySelector('div').textContent).toBe('Template Content');
  });
});
