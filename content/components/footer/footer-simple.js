/**
 * Simple Footer System - Portfolio Essentials Only
 * Uses centralized ComponentLoader for initialization
 */

import { createLogger } from '/content/utils/shared-utilities.js';
import { componentLoader } from '/content/utils/component-loader.js';

const log = createLogger('FooterSimple');

// Simple footer HTML template
const FOOTER_HTML = `
<footer id="site-footer" class="site-footer">
  <div class="footer-content">
    <div class="footer-section">
      <h3>Kontakt</h3>
      <p>
        <strong>Abdulkerim Sesli</strong><br>
        Web Developer & Photographer<br>
        Berlin, Deutschland
      </p>
      <p>
        <a href="mailto:kontakt@abdulkerimsesli.de">kontakt@abdulkerimsesli.de</a>
      </p>
    </div>
    
    <div class="footer-section">
      <h3>Social Media</h3>
      <div class="social-links">
        <a href="https://github.com/aKs030" target="_blank" rel="noopener">GitHub</a>
        <a href="https://linkedin.com/in/abdulkerim-s" target="_blank" rel="noopener">LinkedIn</a>
        <a href="https://instagram.com/abdul.codes" target="_blank" rel="noopener">Instagram</a>
        <a href="https://www.youtube.com/@aks.030" target="_blank" rel="noopener">YouTube</a>
      </div>
    </div>
    
    <div class="footer-section">
      <h3>Navigation</h3>
      <nav class="footer-nav">
        <a href="/">Home</a>
        <a href="/about/">Über mich</a>
        <a href="/projekte/">Projekte</a>
        <a href="/gallery/">Fotografie</a>
        <a href="/videos/">Videos</a>
        <a href="/blog/">Blog</a>
      </nav>
    </div>
  </div>
  
  <div class="footer-bottom">
    <div class="footer-legal">
      <a href="/impressum/">Impressum</a>
      <a href="/datenschutz/">Datenschutz</a>
    </div>
    <div class="footer-copyright">
      <p>&copy; ${new Date().getFullYear()} Abdulkerim Sesli. Alle Rechte vorbehalten.</p>
    </div>
  </div>
</footer>
`;

// Simple CSS for the footer
const FOOTER_CSS = `
.site-footer {
  background: #0d0d0d;
  color: #ffffff;
  padding: 2rem 1rem 1rem;
  margin-top: 4rem;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.footer-section h3 {
  color: #07a1ff;
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.footer-section p {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

.footer-section a {
  color: #ffffff;
  text-decoration: none;
  transition: color 0.3s ease;
}

.footer-section a:hover {
  color: #07a1ff;
}

.social-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.footer-nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.footer-bottom {
  max-width: 1200px;
  margin: 2rem auto 0;
  padding-top: 1rem;
  border-top: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.footer-legal {
  display: flex;
  gap: 1rem;
}

.footer-legal a {
  color: #ccc;
  text-decoration: none;
  font-size: 0.9rem;
}

.footer-legal a:hover {
  color: #07a1ff;
}

.footer-copyright {
  color: #ccc;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .footer-bottom {
    flex-direction: column;
    text-align: center;
  }
  
  .footer-content {
    grid-template-columns: 1fr;
    text-align: center;
  }
}
`;

function injectFooterCSS() {
  if (document.querySelector('#footer-simple-css')) return;

  const style = document.createElement('style');
  style.id = 'footer-simple-css';
  style.textContent = FOOTER_CSS;
  document.head.appendChild(style);
}

function loadFooter(container) {
  if (container.dataset.footerLoaded) return;

  container.innerHTML = FOOTER_HTML;
  container.dataset.footerLoaded = 'true';

  log.info('Simple footer loaded');
}

// Initialize CSS immediately
injectFooterCSS();

// Register with ComponentLoader for standardized initialization
componentLoader.register('#footer-container, [data-footer-src]', loadFooter, {
  runOnce: true,
  immediate: true,
});

export { loadFooter };
