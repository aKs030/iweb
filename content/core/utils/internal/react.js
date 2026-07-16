function getI18n() {
  if (typeof globalThis !== "undefined" && globalThis.i18n) return globalThis.i18n;
  throw new Error("i18n is not initialized on globalThis yet.");
}

export const createUseTranslation = ReactInstance => {
  const React = ReactInstance || globalThis.React;
  if (!React) {
    throw new Error("React instance must be passed to createUseTranslation(React)");
  }

  return () => {
    const i18n = getI18n();
    const [state, setState] = React.useState({ lang: i18n.currentLang, version: 0 });

    React.useEffect(() => {
      let mounted = true;
      const update = (lang = i18n.currentLang) => {
        if (!mounted) return;
        setState(previous => ({ lang, version: previous.version + 1 }));
      };
      const onLanguageChange = event => update(event.detail.lang);

      i18n.addEventListener("language-changed", onLanguageChange);
      i18n
        .init()
        .then(() => update(i18n.currentLang))
        .catch(() => update(i18n.currentLang));

      return () => {
        mounted = false;
        i18n.removeEventListener("language-changed", onLanguageChange);
      };
    }, []);

    const translate = React.useCallback(
      (key, params) => i18n.t(key, params),
      [state.lang, state.version]
    );
    return React.useMemo(() => ({ t: translate, lang: state.lang }), [translate, state.lang]);
  };
};
