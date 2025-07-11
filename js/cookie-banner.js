// js/cookie-banner.js
// Einfache, saubere Implementierung des Cookie-Banners
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    const banner = document.getElementById('cookie-banner');
    const settingsModal = document.getElementById('cookie-settings-modal');
    const confirmation = document.getElementById('cookie-confirmation');
    const acceptBtn = document.getElementById('cookie-accept-all-btn');
    const rejectBtn = document.getElementById('cookie-reject-all-btn');
    const settingsLink = document.getElementById('cookie-banner-settings-link');
    const saveSettingsBtn = document.getElementById('cookie-save-settings-btn');
    const acceptAllModalBtn = document.getElementById('cookie-accept-all-from-modal-btn');
    const cancelSettingsBtn = document.getElementById('cookie-cancel-settings-btn');
    const analyticsCheckbox = document.getElementById('cookie-analytics');
    const marketingCheckbox = document.getElementById('cookie-marketing');

    function getConsent() {
      const stored = localStorage.getItem('cookieConsent');
      return stored ? JSON.parse(stored) : null;
    }

    function setConsent(consent) {
      localStorage.setItem('cookieConsent', JSON.stringify(consent));
    }

    function hideBanner() {
      banner.classList.add('hidden');
    }

    function showSettings() {
      settingsModal.classList.remove('hidden');
      settingsModal.focus();
      const consent = getConsent() || {};
      analyticsCheckbox.checked = !!consent.analytics;
      marketingCheckbox.checked = !!consent.marketing;
    }

    function hideSettings() {
      settingsModal.classList.add('hidden');
    }

    function showConfirmation() {
      confirmation.classList.remove('hidden');
      setTimeout(function() {
        confirmation.classList.add('hidden');
      }, 3000);
    }

    const consent = getConsent();
    if (!consent) {
      banner.classList.remove('hidden');
      banner.focus();
    }

    acceptBtn.addEventListener('click', function() {
      setConsent({ analytics: true, marketing: true });
      hideBanner();
    });

    rejectBtn.addEventListener('click', function() {
      setConsent({ analytics: false, marketing: false });
      hideBanner();
    });

    settingsLink.addEventListener('click', function(e) {
      e.preventDefault();
      showSettings();
    });

    saveSettingsBtn.addEventListener('click', function() {
      setConsent({ analytics: analyticsCheckbox.checked, marketing: marketingCheckbox.checked });
      hideSettings();
      hideBanner();
      showConfirmation();
    });

    acceptAllModalBtn.addEventListener('click', function() {
      setConsent({ analytics: true, marketing: true });
      hideSettings();
      hideBanner();
      showConfirmation();
    });

    cancelSettingsBtn.addEventListener('click', function() {
      hideSettings();
    });
  });
})();