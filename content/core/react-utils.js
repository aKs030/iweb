/**
 * React-specific Utilities
 * Keeps React-specific helpers out of the general browser runtime modules.
 * @version 1.0.0
 */

import React from "react";
import { i18n } from "./i18n.js";

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
    const [state, setState] = React.useState({
      lang: i18n.currentLang,
      version: 0,
    });

    React.useEffect(() => {
      let mounted = true;
      const update = (lang = i18n.currentLang) => {
        if (!mounted) return;
        setState(prev => ({
          lang,
          version: prev.version + 1,
        }));
      };
      const onLangChange = e => update(e.detail.lang);
      i18n.addEventListener("language-changed", onLangChange);
      i18n
        .init()
        .then(() => update(i18n.currentLang))
        .catch(() => update(i18n.currentLang));
      return () => {
        mounted = false;
        i18n.removeEventListener("language-changed", onLangChange);
      };
    }, []);

    const t = React.useCallback((key, params) => i18n.t(key, params), [state.lang, state.version]);

    return React.useMemo(() => ({ t, lang: state.lang }), [t, state.lang]);
  };
};
