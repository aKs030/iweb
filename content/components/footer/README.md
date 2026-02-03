# Site Footer Component

Modern, scroll-based footer with automatic expand/collapse functionality and cookie management.

## Version 2.0.1

### Features

- **Scroll-based Auto-expand**: Footer expands when user reaches bottom of page (<100px)
- **Auto-collapse**: Footer collapses when scrolling up and away from bottom (>300px)
- **Cookie Management**: Integrated cookie banner and settings
- **Accessibility**: Full keyboard navigation and screen reader support
- **Responsive**: Optimized for all screen sizes
- **Performance**: Debounced scroll handler, memory-safe cleanup
- **Dynamic Loading**: Automatically injected by head-inline.js

### Architecture

#### Automatic Loading

The footer is **automatically created** by `head-inline.js` on all pages. No manual `<site-footer>` tags needed in HTML.

```javascript
// head-inline.js automatically creates footer
let siteFooter = document.querySelector('site-footer');
if (!siteFooter) {
  siteFooter = document.createElement('site-footer');
  document.body.appendChild(siteFooter);
}
```

#### Configuration

```javascript
const CONFIG = {
  FOOTER_PATH: '/content/components/footer/footer.html',
  SCROLL_DEBOUNCE_MS: 100,
  EXPAND_THRESHOLD: 100, // Distance from bottom to expand
  COLLAPSE_THRESHOLD: 300, // Distance from bottom to collapse
  TRANSITION_DURATION: 300, // Animation duration
};
```

### Homepage Integration (Section 4)

On the homepage, a dedicated **Section 4** provides space for the expanded footer:

```html
<section id="section4" class="section section4" data-footer-section="true">
  <div class="footer-spacer"></div>
</section>
```

This prevents the footer from overlapping Section 3 content.

### Manual Controls

- Click minimized footer bar to toggle
- Press `Escape` to close expanded footer
- Click outside footer to close
- Touch gestures supported on mobile

### Files

- `SiteFooter.js` - Web Component logic
- `footer.css` - Styles
- `footer.html` - Template
- `README.md` - This file

### Key Improvements (v2.0.1)

✅ **Memory-safe**: All event listeners properly cleaned up  
✅ **No memory leaks**: Scroll handlers and timeouts removed on disconnect  
✅ **CSS Specificity fixed**: `.hidden` uses `!important` to prevent conflicts  
✅ **Event deduplication**: Prevents multiple listener registration  
✅ **Scrollability check**: Disabled on non-scrollable pages  
✅ **Section 4 integration**: Clean separation on homepage

### Browser Support

- Modern browsers with ES6+ support
- Web Components (Custom Elements v1)
- IntersectionObserver not required (scroll-based)

### Performance

- Debounced scroll events (100ms)
- Passive event listeners where possible
- Content-visibility for off-screen content
- No unnecessary DOM queries
