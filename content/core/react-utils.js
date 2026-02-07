/**
 * React Utilities
 * Shared hooks and helpers for React applications
 */

import { i18n } from '../core/i18n.js';

/**
 * Creates a translation hook using the provided React instance
 * @param {object} React - The React instance (from import or CDN)
 * @returns {() => { t: (key: string, params?: object) => string, lang: string }}
 */
export const createUseTranslation = (React) => {
  return () => {
    const [lang, setLang] = React.useState(i18n.currentLang);

    React.useEffect(() => {
      const onLangChange = (e) => setLang(e.detail.lang);
      i18n.addEventListener('language-changed', onLangChange);
      return () => i18n.removeEventListener('language-changed', onLangChange);
    }, []);

    return { t: (key, params) => i18n.t(key, params), lang };
  };
};
