// NLWeb initializer (imports worker module and instantiates the dropdown chat)
// Update DEFAULT_SITE / DEFAULT_ENDPOINT to your deployed worker if needed
import { createLogger } from '../../utils/shared-utilities.js';
const log = createLogger('NLWeb');

const DEFAULT_SITE =
  'https://throbbing-mode-6fe1-nlweb.httpsgithubcomaks030website.workers.dev';
const DEFAULT_ENDPOINT = DEFAULT_SITE;

// Use dynamic import of the worker module
async function initNLWeb() {
  try {
    const module = await import(`${DEFAULT_SITE}/nlweb-dropdown-chat.js`);
    const { NLWebDropdownChat } = module;

    if (!document.getElementById('docs-search-container')) {
      const div = document.createElement('div');
      div.id = 'docs-search-container';
      document.body.appendChild(div);
    }

    // Instantiate widget (no local reference needed)
    new NLWebDropdownChat({
      containerId: 'docs-search-container',
      site: DEFAULT_SITE,
      placeholder: 'Search for docs...',
      endpoint: DEFAULT_ENDPOINT,
    });
  } catch (err) {
    // Non-fatal: log using site logger for debugging
    log.warn('NLWeb init failed', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNLWeb, { once: true });
} else {
  initNLWeb();
}
