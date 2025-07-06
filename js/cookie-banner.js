// js/cookie-banner.js

(() => {
  const GA_ID = 'G-S0587RQ4CN'; // Your Google Analytics ID

  // --- Helper Functions ---

  /**
   * Loads the Google Analytics script.
   */
  function loadAnalytics() {
    if (window.gtag) {
      console.log("Google Analytics already loaded.");
      return; // Prevent multiple loads if already present
    }
    console.log("Loading Google Analytics...");
    const script1 = document.createElement('script');
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    script1.async = true;
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_ID}');
    `;
    document.head.appendChild(script2);
    console.log("Google Analytics script appended.");
  }

  /**
   * Attempts to "unload" or deactivate Google Analytics.
   * Note: Fully unloading GA without a page refresh is complex.
   * This primarily ensures no new tracking occurs and existing cookies are considered.
   */
  function unloadAnalytics() {
    console.log("Attempting to unload/deactivate Google Analytics...");
    // If gtag is present, update consent to denied for analytics storage
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        'analytics_storage': 'denied'
      });
      console.log("GA Consent updated to 'denied'.");
    }

    // Attempt to remove GA scripts (best effort, may not stop all tracking)
    document.querySelectorAll(`script[src*="googletagmanager.com/gtag/js"], script:not([src]):contains("gtag('config'")`)
      .forEach(script => {
        script.remove();
        console.log("Removed GA script:", script.src || "inline script");
      });

    // Clear GA cookies (example, varies by GA setup)
    // This is a simplistic approach. Realistically, you'd iterate through known GA cookie names.
    const gaCookies = ['_ga', '_gid', '_gat', '_gcl_au'];
    gaCookies.forEach(cookieName => {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        console.log(`Cleared cookie: ${cookieName}`);
    });

    // Clear dataLayer if necessary
    if (window.dataLayer) {
        window.dataLayer = [];
        console.log("Cleared dataLayer.");
    }
    // Optionally, nullify gtag to prevent further calls
    window.gtag = null;
  }

  /**
   * Retrieves current cookie consent from localStorage.
   * Sets default values if not found.
   * @returns {Object} Consent state for each category.
   */
  function getConsent() {
    try {
      const consent = JSON.parse(localStorage.getItem('cookieConsent') || '{}');
      // Set defaults for categories if they don't exist
      return {
        necessary: true, // Always true, as these are essential
        analytics: consent.analytics === true, // Default to false if not explicitly true
        marketing: consent.marketing === true, // Default to false if not explicitly true
        // Add other categories here, default to false
      };
    } catch (e) {
      console.error("Error parsing cookie consent from localStorage:", e);
      return { necessary: true, analytics: false, marketing: false }; // Fallback to safe defaults
    }
  }

  /**
   * Saves the current consent state to localStorage.
   * @param {Object} consentState - The consent state to save.
   */
  function saveConsent(consentState) {
    localStorage.setItem('cookieConsent', JSON.stringify(consentState));
    console.log("Cookie consent saved:", consentState);
  }

  /**
   * Applies consent choices by loading/unloading scripts and setting GA consent.
   * @param {Object} consentState - The current consent state.
   */
  function applyConsent(consentState) {
    console.log("Applying consent:", consentState);
    if (consentState.analytics) {
      loadAnalytics();
      // Ensure GA's analytics_storage is granted if user accepts
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          'analytics_storage': 'granted'
        });
        console.log("GA Consent updated to 'granted'.");
      }
    } else {
      unloadAnalytics(); // Deactivate analytics if consent is denied
    }

    // --- Placeholder for other cookie categories ---
    // if (consentState.marketing) {
    //   loadMarketingScripts();
    // } else {
    //   unloadMarketingScripts();
    // }

    // if (consentState.functional) {
    //   loadFunctionalScripts();
    // } else {
    //   unloadFunctionalScripts();
    // }
  }

  /**
   * Displays the main cookie banner.
   */
  function showBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.style.display = 'block';
      banner.setAttribute('aria-hidden', 'false');
      banner.setAttribute('tabindex', '-1'); // Make banner focusable for keyboard users
      banner.focus(); // Focus on the banner when it appears
      document.body.classList.add('no-scroll'); // Optional: Prevent body scroll when banner is up
    }
  }

  /**
   * Hides the main cookie banner.
   */
  function hideBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.style.display = 'none';
      banner.setAttribute('aria-hidden', 'true');
      banner.removeAttribute('tabindex');
      document.body.classList.remove('no-scroll'); // Restore body scroll
    }
  }

  /**
   * Displays the cookie settings modal.
   */
  function showSettingsModal() {
    const modal = document.getElementById('cookie-settings-modal');
    const currentConsent = getConsent(); // Get latest consent for populating checkboxes

    // Set checkbox states based on current consent
    document.getElementById('cookie-analytics').checked = currentConsent.analytics;
    document.getElementById('cookie-marketing').checked = currentConsent.marketing;
    // Update other categories here if added

    if (modal) {
      modal.style.display = 'flex'; // Use flex to center the modal
      modal.setAttribute('aria-hidden', 'false');
      modal.setAttribute('tabindex', '-1'); // Make modal focusable
      modal.focus(); // Focus on the modal when it opens
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      hideBanner(); // Hide main banner if modal is shown
    }
  }

  /**
   * Hides the cookie settings modal.
   */
  function hideSettingsModal() {
    const modal = document.getElementById('cookie-settings-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      modal.removeAttribute('tabindex');
      document.body.style.overflow = ''; // Restore body scrolling
    }
  }

  function showConfirmation() {
    const confirmation = document.getElementById('cookie-confirmation');
    if (confirmation) {
      confirmation.style.display = 'block';
      setTimeout(() => {
        confirmation.style.display = 'none';
      }, 2000);
    }
  }

  // --- Main Logic on DOMContentLoaded ---

  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('cookie-banner');
    const acceptAllBtn = document.getElementById('cookie-accept-all-btn');
    const rejectAllBtn = document.getElementById('cookie-reject-all-btn');
    const bannerSettingsLink = document.getElementById('cookie-banner-settings-link');
    const footerSettingsLink = document.getElementById('cookie-settings-link'); // Your existing footer link

    // Modal elements
    const modal = document.getElementById('cookie-settings-modal');
    const analyticsCheckbox = document.getElementById('cookie-analytics');
    const marketingCheckbox = document.getElementById('cookie-marketing');
    const saveSettingsBtn = document.getElementById('cookie-save-settings-btn');
    const acceptAllFromModalBtn = document.getElementById('cookie-accept-all-from-modal-btn');
    const cancelSettingsBtn = document.getElementById('cookie-cancel-settings-btn');

    let userConsent = getConsent(); // Initial load of consent state

    // Determine whether to show the initial banner
    // If the localStorage item 'cookieConsent' exists and has been explicitly set (even to all false),
    // we assume the user has made a choice and apply it without showing the banner initially.
    // Otherwise, show the banner for first-time visitors or those without a clear choice.
    const storedConsentString = localStorage.getItem('cookieConsent');
    if (storedConsentString === null || !Object.keys(JSON.parse(storedConsentString)).length) {
      showBanner();
    } else {
      // User has made a choice previously, apply it immediately
      applyConsent(userConsent);
    }

    // --- Event Listeners for main banner ---

    acceptAllBtn.addEventListener('click', () => {
      userConsent = { necessary: true, analytics: true, marketing: true }; // Accept all
      saveConsent(userConsent);
      applyConsent(userConsent);
      hideBanner();
      showConfirmation();
    });

    rejectAllBtn.addEventListener('click', () => {
      userConsent = { necessary: true, analytics: false, marketing: false }; // Reject all non-necessary
      saveConsent(userConsent);
      applyConsent(userConsent); // Ensure analytics is unloaded
      hideBanner();
    });

    // --- Event Listeners for settings links (both banner and footer) ---
    [bannerSettingsLink, footerSettingsLink].forEach(link => {
      if (link) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          showSettingsModal();
        });
      }
    });

    // --- Event Listeners for Settings Modal ---

    saveSettingsBtn.addEventListener('click', () => {
      userConsent = {
        necessary: true, // Always true
        analytics: analyticsCheckbox.checked,
        marketing: marketingCheckbox.checked,
        // ... include other categories here based on their checkbox state
      };
      saveConsent(userConsent);
      applyConsent(userConsent); // Apply changes
      hideSettingsModal();
      showConfirmation();
    });

    acceptAllFromModalBtn.addEventListener('click', () => {
        userConsent = { necessary: true, analytics: true, marketing: true };
        saveConsent(userConsent);
        applyConsent(userConsent);
        hideSettingsModal();
        showConfirmation();
    });

    cancelSettingsBtn.addEventListener('click', () => {
      hideSettingsModal();
      // If the modal was opened when the initial banner was still visible
      // (i.e., user hadn't made a choice yet), show the banner again.
      // Otherwise, if opened from the footer link, no banner is needed.
      const storedConsent = localStorage.getItem('cookieConsent');
      if (storedConsent === null || !Object.keys(JSON.parse(storedConsent)).length) {
         showBanner();
      }
    });

    // Close modal if clicking outside (optional, but good UX)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideSettingsModal();
        // Same logic as cancel button: if no choice made, show banner again.
        const storedConsent = localStorage.getItem('cookieConsent');
        if (storedConsent === null || !Object.keys(JSON.parse(storedConsent)).length) {
           showBanner();
        }
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') { // Check if modal is visible
        hideSettingsModal();
        // Same logic as cancel button: if no choice made, show banner again.
        const storedConsent = localStorage.getItem('cookieConsent');
        if (storedConsent === null || !Object.keys(JSON.parse(storedConsent)).length) {
           showBanner();
        }
      }
    });

    // Fokusmanagement für Barrierefreiheit
    function focusTrap(modal) {
      const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      modal.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      });
    }
    // Fokusfalle aktivieren, wenn Modal geöffnet wird
    if (modal) {
      modal.addEventListener('show', () => focusTrap(modal));
    }
  });

  // Footer dynamisch laden, falls noch nicht im DOM
  function loadFooterAndInitBanner() {
    if (document.getElementById('footer-placeholder')) {
      fetch('/pages/komponente/footer.html')
        .then(r => {
          if (!r.ok) throw new Error('Footer konnte nicht geladen werden');
          return r.text();
        })
        .then(html => {
          document.getElementById('footer-placeholder').innerHTML = html;
          const yearEl = document.getElementById('current-year');
          if (yearEl) yearEl.textContent = new Date().getFullYear();
          // Nach dem Laden Footer-Initialisierung starten
          initCookieBanner();
        })
        .catch(() => {
          // Optional: Fallback oder Fehleranzeige
        });
    } else {
      // Footer-Container nicht gefunden, Cookie-Banner trotzdem initialisieren
      initCookieBanner();
    }
  }

  function initCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    const acceptAllBtn = document.getElementById('cookie-accept-all-btn');
    const rejectAllBtn = document.getElementById('cookie-reject-all-btn');
    const bannerSettingsLink = document.getElementById('cookie-banner-settings-link');
    const footerSettingsLink = document.getElementById('cookie-settings-link'); // Your existing footer link

    // Modal elements
    const modal = document.getElementById('cookie-settings-modal');
    const analyticsCheckbox = document.getElementById('cookie-analytics');
    const marketingCheckbox = document.getElementById('cookie-marketing');
    const saveSettingsBtn = document.getElementById('cookie-save-settings-btn');
    const acceptAllFromModalBtn = document.getElementById('cookie-accept-all-from-modal-btn');
    const cancelSettingsBtn = document.getElementById('cookie-cancel-settings-btn');

    let userConsent = getConsent(); // Initial load of consent state

    // Determine whether to show the initial banner
    // If the localStorage item 'cookieConsent' exists and has been explicitly set (even to all false),
    // we assume the user has made a choice and apply it without showing the banner initially.
    // Otherwise, show the banner for first-time visitors or those without a clear choice.
    const storedConsentString = localStorage.getItem('cookieConsent');
    if (storedConsentString === null || !Object.keys(JSON.parse(storedConsentString)).length) {
      showBanner();
    } else {
      // User has made a choice previously, apply it immediately
      applyConsent(userConsent);
    }

    // --- Event Listeners for main banner ---

    acceptAllBtn.addEventListener('click', () => {
      userConsent = { necessary: true, analytics: true, marketing: true }; // Accept all
      saveConsent(userConsent);
      applyConsent(userConsent);
      hideBanner();
      showConfirmation();
    });

    rejectAllBtn.addEventListener('click', () => {
      userConsent = { necessary: true, analytics: false, marketing: false }; // Reject all non-necessary
      saveConsent(userConsent);
      applyConsent(userConsent); // Ensure analytics is unloaded
      hideBanner();
    });

    // --- Event Listeners for settings links (both banner and footer) ---
    [bannerSettingsLink, footerSettingsLink].forEach(link => {
      if (link) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          showSettingsModal();
        });
      }
    });

    // --- Event Listeners for Settings Modal ---

    saveSettingsBtn.addEventListener('click', () => {
      userConsent = {
        necessary: true, // Always true
        analytics: analyticsCheckbox.checked,
        marketing: marketingCheckbox.checked,
        // ... include other categories here based on their checkbox state
      };
      saveConsent(userConsent);
      applyConsent(userConsent); // Apply changes
      hideSettingsModal();
      showConfirmation();
    });

    acceptAllFromModalBtn.addEventListener('click', () => {
        userConsent = { necessary: true, analytics: true, marketing: true };
        saveConsent(userConsent);
        applyConsent(userConsent);
        hideSettingsModal();
        showConfirmation();
    });

    cancelSettingsBtn.addEventListener('click', () => {
      hideSettingsModal();
      // If the modal was opened when the initial banner was still visible
      // (i.e., user hadn't made a choice yet), show the banner again.
      // Otherwise, if opened from the footer link, no banner is needed.
      const storedConsent = localStorage.getItem('cookieConsent');
      if (storedConsent === null || !Object.keys(JSON.parse(storedConsent)).length) {
         showBanner();
      }
    });

    // Close modal if clicking outside (optional, but good UX)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideSettingsModal();
        // Same logic as cancel button: if no choice made, show banner again.
        const storedConsent = localStorage.getItem('cookieConsent');
        if (storedConsent === null || !Object.keys(JSON.parse(storedConsent)).length) {
           showBanner();
        }
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') { // Check if modal is visible
        hideSettingsModal();
        // Same logic as cancel button: if no choice made, show banner again.
        const storedConsent = localStorage.getItem('cookieConsent');
        if (storedConsent === null || !Object.keys(JSON.parse(storedConsent)).length) {
           showBanner();
        }
      }
    });

    // Fokusmanagement für Barrierefreiheit
    function focusTrap(modal) {
      const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      modal.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      });
    }
    // Fokusfalle aktivieren, wenn Modal geöffnet wird
    if (modal) {
      modal.addEventListener('show', () => focusTrap(modal));
    }
  }

  // --- Main Logic ---
  if (document.getElementById('footer-placeholder')) {
    // Footer wird dynamisch geladen, also Banner erst nach dem Laden initialisieren
    loadFooterAndInitBanner();
  } else {
    // Footer ist schon im DOM, Banner sofort initialisieren
    initCookieBanner();
  }
})();