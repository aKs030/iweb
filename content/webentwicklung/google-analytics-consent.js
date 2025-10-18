/**
 * Alternative Google Analytics Integration - Opt-in mit traditionellen Tags
 *
 * Diese Version verwendet data-consent Attribute, um GA zu blockieren bis zur Zustimmung.
 *
 * NUTZUNG IN index.html:
 *
 * 1. Füge im <head> diese Tags mit data-consent="required" hinzu:
 *
 * <!-- Google tag (gtag.js) - Blocked until consent -->
 * <script data-consent="required" async src="https://www.googletagmanager.com/gtag/js?id=G-S0587RQ4CN"></script>
 * <script data-consent="required">
 *   window.dataLayer = window.dataLayer || [];
 *   function gtag(){dataLayer.push(arguments);}
 *   gtag('js', new Date());
 *   gtag('config', 'G-S0587RQ4CN');
 * </script>
 *
 * 2. Das Cookie-Consent-System aktiviert diese Scripts automatisch nach Zustimmung
 *
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

// Diese Funktion aktiviert alle blockierten Scripts
function enableConsentScripts() {
  const blockedScripts = document.querySelectorAll(
    'script[data-consent="required"]'
  );

  blockedScripts.forEach((script) => {
    // Erstelle neues Script-Element
    const newScript = document.createElement("script");

    // Kopiere alle Attribute außer data-consent
    Array.from(script.attributes).forEach((attr) => {
      if (attr.name !== "data-consent") {
        newScript.setAttribute(attr.name, attr.value);
      }
    });

    // Kopiere Inline-Code falls vorhanden
    if (script.innerHTML) {
      newScript.innerHTML = script.innerHTML;
    }

    // Ersetze das alte Script mit dem neuen (aktivierten)
    script.parentNode.replaceChild(newScript, script);
  });

  console.warn("[Cookie Consent] Google Analytics Scripts aktiviert");
}

// Export für Nutzung in footer-complete.js
if (typeof window !== "undefined") {
  window.enableConsentScripts = enableConsentScripts;
}
