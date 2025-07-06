// js/cookie-banner.js

// Ersetzt bisherige einfache Logik durch DSGVO-konforme Version mit Lade-Funktion für Analytics
(() => {
  const GA_ID = 'G-S0587RQ4CN';

  function loadAnalytics() {
    if (window.gtag) return;
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
  }

  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('cookie-banner');
    const acceptBtn = document.getElementById('cookie-accept-btn');
    const rejectBtn = document.getElementById('cookie-reject-btn');

    const consent = JSON.parse(localStorage.getItem('cookieConsent') || '{}');

    if (consent.analytics) {
      loadAnalytics();
    }

    if (!('analytics' in consent)) {
      banner.style.display = 'block';
    }

    acceptBtn.addEventListener('click', () => {
      localStorage.setItem('cookieConsent', JSON.stringify({ analytics: true }));
      banner.style.display = 'none';
      loadAnalytics();
    });

    rejectBtn.addEventListener('click', () => {
      localStorage.setItem('cookieConsent', JSON.stringify({ analytics: false }));
      banner.style.display = 'none';
    });

    // Einstellungen-Link öffnet Banner erneut
    const settingsLink = document.getElementById('cookie-settings-link');
    if (settingsLink) {
      settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        banner.style.display = 'block';
      });
    }
  });
})();
