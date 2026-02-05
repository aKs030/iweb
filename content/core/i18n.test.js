import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { i18n } from './i18n.js';

describe('i18n LanguageManager', () => {
  const mockTranslations = {
    de: {
      hello: 'Hallo',
      welcome: 'Willkommen {{name}}',
      nested: {
        key: 'Verschachtelter Wert'
      }
    },
    en: {
      hello: 'Hello',
      welcome: 'Welcome {{name}}',
      nested: {
        key: 'Nested Value'
      }
    }
  };

  beforeEach(() => {
    // Reset internal state
    i18n.translations = { de: null, en: null };
    i18n.currentLang = 'de';
    i18n.initialized = false;
    i18n.loadingPromise = null;

    // Mock Navigator
    Object.defineProperty(window.navigator, 'language', {
      value: 'de-DE',
      configurable: true
    });

    // Mock fetch
    global.fetch = vi.fn((url) => {
      // Handle relative URLs by ignoring base or just string matching
      const urlStr = String(url);
      const lang = urlStr.includes('de.json') ? 'de' : 'en';
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTranslations[lang])
      });
    });

    // Mock localStorage
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = String(value); }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sollte Standard-Initialisierung durchführen', async () => {
    await i18n.init();
    expect(i18n.currentLang).toBe('de'); // Default oder Browser-Mock dependent
    expect(global.fetch).toHaveBeenCalledWith('/content/config/locales/de.json');
  });

  it('sollte Sprache wechseln', async () => {
    await i18n.init();
    await i18n.setLanguage('en');

    expect(i18n.currentLang).toBe('en');
    expect(localStorage.setItem).toHaveBeenCalledWith('app_language', 'en');
    expect(global.fetch).toHaveBeenCalledWith('/content/config/locales/en.json');
  });

  it('sollte einfache Schlüssel übersetzen', async () => {
    await i18n.init();
    // Manuell Mock-Daten setzen, da init() asynchron lädt aber wir hier synchron testen wollen
    // (In Realität würde await init() reichen, aber sicherheitshalber)
    i18n.translations['de'] = mockTranslations['de'];

    expect(i18n.t('hello')).toBe('Hallo');
  });

  it('sollte verschachtelte Schlüssel übersetzen', async () => {
    await i18n.init();
    i18n.translations['de'] = mockTranslations['de'];

    expect(i18n.t('nested.key')).toBe('Verschachtelter Wert');
  });

  it('sollte Parameter interpolieren', async () => {
    await i18n.init();
    i18n.translations['de'] = mockTranslations['de'];

    expect(i18n.t('welcome', { name: 'Jules' })).toBe('Willkommen Jules');
  });

  it('sollte den Schlüssel zurückgeben, wenn Übersetzung fehlt', async () => {
    await i18n.init();
    i18n.translations['de'] = mockTranslations['de'];

    expect(i18n.t('missing.key')).toBe('missing.key');
  });
});
