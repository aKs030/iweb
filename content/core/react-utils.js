/**
 * React-specific Utilities
 * Separated from core/utils.js to avoid pulling React into non-React modules.
 * @version 1.0.0
 */

import React from 'react';
import { i18n } from './i18n.js';

/**
 * Creates a `useTranslation` React hook for functional components.
 * Re-renders the component whenever the active language changes.
 *
 * @returns {() => { t: (key: string, params?: Object) => string, lang: string }}
 *
 * @example
 * const useTranslation = createUseTranslation();
 * function MyComponent() {
 *   const { t, lang } = useTranslation();
 *   return html`<p>${t('menu.home')}</p>`;
 * }
 */
export const createUseTranslation = () => {
  return () => {
    const [lang, setLang] = React.useState(i18n.currentLang);

    React.useEffect(() => {
      const onLangChange = (e) => setLang(e.detail.lang);
      i18n.addEventListener('language-changed', onLangChange);
      return () => i18n.removeEventListener('language-changed', onLangChange);
    }, []);

    const t = React.useCallback((key, params) => i18n.t(key, params), [lang]);

    return React.useMemo(() => ({ t, lang }), [t, lang]);
  };
};
