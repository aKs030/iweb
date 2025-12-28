# Google Tag Manager (GTM) & GA4 Einrichtung (Kurz)

Diese Anleitung ergänzt die Implementierung in `content/components/head/head-inline.js`.

## 1) GTM Container anlegen

- Öffne https://tagmanager.google.com und erstelle ein neues Konto + Container (Web).
- Notiere die Container-ID (z.B. `GTM-ABC1234`).

## 2) GTM_ID setzen

- Öffne `content/components/head/head-inline.js` und ersetze den Platzhalter:

```js
// Host-based mapping is used in `head-inline.js`. Edit the map to add/change sites.
const HOST_GTM_MAP = {
  "abdulkerimsesli.de": { gtm: "GTM-5F5ZSTTL", ga4: "G-757KWG0PG4" },
  "www.abdulkerimsesli.de": { gtm: "GTM-5F5ZSTTL", ga4: "G-757KWG0PG4" },
  // default / other site
  default: { gtm: "GT-TQTFN4NN", ga4: "G-S0587RQ4CN" },
};
```

- Wenn `GTM-XXXXXXX` belassen wird, lädt GTM nicht.

- Dateien im Repo:
  - `gtm-container-abdulkerimsesli.json` (vorkonfiguriert für abdulkerimsesli.de → GT: `GTM-5F5ZSTTL`, GA4: `G-757KWG0PG4`)
    - Enthält vorkonfigurierte Tags: **GA4 Configuration (send_page_view:false, nur nach Consent)**, **GA4 Page View (feuert auf `pageMetadataReady`)**, **Google Ads Conversion (AW-1036079663)**, sowie Trigger **Consent Granted** (`consentGranted`) und **Page Metadata Ready** (`pageMetadataReady`). Ersetze `AW-CONV-LABEL` durch dein Conversion Label und passe Triggertypen an.
  - `gtm-container-meine-webseite.json` (vorkonfiguriert für deine andere Seite → GT: `GT-TQTFN4NN`, GA4: `G-S0587RQ4CN`)
    - Enthält vorkonfigurierte Tags: **GA4 Configuration (send_page_view:false, nur nach Consent)**, **GA4 Page View (feuert auf `pageMetadataReady`)**, **Google Ads Conversion (AW-17819941793)**, sowie Trigger **Consent Granted** (`consentGranted`) und **Page Metadata Ready** (`pageMetadataReady`). Ersetze `AW-CONV-LABEL` durch dein Conversion Label und passe Triggertypen an.

## 3) GTM Container konfigurieren

- Im GTM UI: Erstelle einen **GA4 Configuration Tag** mit deiner Measurement-ID (`G-PRCQ2397M4`) und setze Trigger **All Pages**. Deaktiviere in der Tag-Konfiguration die Option "Send a page view event when this configuration loads" falls du Pageviews manuell oder deduplizierend verwalten willst.
- Erstelle zusätzlich einen **Google Ads Conversion/Remarketing Tag** und verwende die Conversion‑ID, die zu deinem Host gehört (z. B. `AW-17819941793` für die "Meine Webseite"-Konfiguration oder `AW-1036079663` für das ältere Setup). Verwende Trigger und Consent‑Settings, um das Tag nur nach Zustimmung feuern zu lassen.
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
