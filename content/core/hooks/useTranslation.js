/**
 * Translation Hook for React Components
 * @version 1.0.0
 * @description Shared hook for i18n support in React components
 */

import React from 'react';
import { i18n } from '../i18n.js';

/**
 * Hook to access translation function and current language
 * @returns {{t: Function, lang: string}} Translation function and current language
 */
export const useTranslation = () => {
  const [lang, setLang] = React.useState(i18n.currentLang);

  React.useEffect(() => {
    const onLangChange = (e) => setLang(e.detail.lang);
    i18n.addEventListener('language-changed', onLangChange);
    return () => i18n.removeEventListener('language-changed', onLangChange);
  }, []);

  return { t: (key, params) => i18n.t(key, params), lang };
};
