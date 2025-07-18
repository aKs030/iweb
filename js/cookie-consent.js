// cookie-consent.js
export class CookieConsentManager {
  constructor(config) {
    this.config = config;
    this.storageKey = config.storageKey || 'cookie-consent';
    this.consent = this.loadConsent();
  }

  loadConsent() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return null;
      const consent = JSON.parse(stored);
      if (!this.isValidConsent(consent)) {
        localStorage.removeItem(this.storageKey);
        return null;
      }
      return consent;
    } catch (error) {
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }

  isValidConsent(consent) {
    if (!consent || typeof consent !== 'object') return false;
    if (!consent.timestamp || !consent.necessary) return false;
    const consentAge = Date.now() - new Date(consent.timestamp).getTime();
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    return consentAge <= oneYear;
  }

  saveConsent(consent) {
    try {
      const consentData = {
        ...consent,
        timestamp: new Date().toISOString(),
        version: '3.0',
      };
      localStorage.setItem(this.storageKey, JSON.stringify(consentData));
      this.consent = consentData;
    } catch (error) {
      // Fehlerhandling
    }
  }

  hasConsent(category = null) {
    if (!this.consent) return false;
    if (category) {
      return this.consent[category] === true;
    }
    return true;
  }

  setConsent(category, granted) {
    const currentConsent = this.consent || { necessary: true };
    currentConsent[category] = granted;
    this.saveConsent(currentConsent);
  }

  getConsent() {
    return this.consent;
  }

  reset() {
    localStorage.removeItem(this.storageKey);
    this.consent = null;
  }
}
