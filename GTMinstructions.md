# Google Tag Manager (GTM) & GA4 Einrichtung (Kurz)

Diese Anleitung ergänzt die Implementierung in `content/components/head/head-inline.js`.

## 1) GTM Container anlegen
- Öffne https://tagmanager.google.com und erstelle ein neues Konto + Container (Web).
- Notiere die Container-ID (z.B. `GTM-ABC1234`).

## 2) GTM_ID setzen
- Öffne `content/components/head/head-inline.js` und ersetze den Platzhalter:

```js
const GTM_ID = 'GTM-N5ZZT3' // primary GTM container
const GTM_LEGACY = 'GT-PHW3GDDL' // legacy/secondary tag (reference)
const GA4_MEASUREMENT_ID = 'G-PRCQ2397M4'
const GA4_PROPERTY = '360386802'
```

- Wenn `GTM-XXXXXXX` belassen wird, lädt GTM nicht.

## 3) GTM Container konfigurieren
- Im GTM UI: Erstelle einen **GA4 Configuration Tag** mit deiner Measurement-ID (`G-PRCQ2397M4`) und setze Trigger **All Pages**. Deaktiviere in der Tag-Konfiguration die Option "Send a page view event when this configuration loads" falls du Pageviews manuell oder deduplizierend verwalten willst.
- Erstelle zusätzlich einen **Google Ads Conversion/Remarketing Tag** und verwende die Conversion‑ID `AW-1036079663` (oder importiere vorhandene Conversions). Verwende Trigger und Consent‑Settings, um das Tag nur nach Zustimmung feuern zu lassen.
- WICHTIG: Entferne direkte `gtag('config', ...)`-Aufrufe aus dem Code, damit Tracking nur noch über GTM erfolgt. In diesem Projekt wurde das bereits vorbereitet: `head-inline.js` stellt die IDs über `dataLayer` bereit, GTM sollte diese als Variablen lesen.

## 4) Consent & Datenschutz
- Falls du Consent benötigst, integriere dein Consent-Management (z.B. TCF, Cookie-Consent) und setze Tags so, dass sie vor Consent nicht feuern.
- GTM bietet Trigger/Variablen, um Consent-Status auszulesen und zu respektieren.

## 5) Testen (lokal)
- Im GTM: Workspace → Preview → Verbinde zu deiner lokal laufenden Seite (Tippe die URL ein).
- Prüfe in GTM Debugger, dass der GA4 Config Tag beim Laden feuert.
- In GA4: Realtime-Report öffnen und prüfen, ob Ereignisse ankommen.
- Optional: Benutze Tag Assistant (Chrome Extension) und Netzwerkanfragen (filter `gtm.js`, `collect`, `gcnv`).

## 6) Noscript
- Das `head-inline.js` fügt automatisch ein `noscript`-iframe an den Bodyanfang ein, damit GTM in No-JS-Umgebungen (eingeschränkt) verfügbar ist.

---

Wenn du möchtest, ergänze ich noch eine kurze PR-Beschreibung oder füge Consent-Integration direkt im Repo ein (ohne Commit). Sag mir, wie ich weiter vorgehen soll.