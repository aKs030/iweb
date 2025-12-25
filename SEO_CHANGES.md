# SEO Changes applied (2025-12-22)

Kurzüberblick der vorgenommenen Änderungen und wie du sie prüfen kannst.

## Änderungen

- head: aktualisiert
  - `meta[name=robots]` auf `max-image-preview:large` und `max-video-preview:-1` gesetzt
  - zusätzliche Meta-Tags hinzugefügt: `language`, `rating`, `revisit-after`, `msapplication-config`
  - Fallback-Favicon-Link hinzugefügt: `/favicon.ico`
  - `Sitelinks` ItemList (JSON-LD) hinzugefügt
- `robots.txt`: Google-spezifische Regeln, Crawl-delay und sinnvolle Disallow-Pattern hinzugefügt
- `sitemap.xml`: `xmlns:video` hinzugefügt, `videos/`-Eintrag erweitert mit `video:video` Metadaten; `lastmod` für wichtige Seiten auf `2025-12-22` aktualisiert
- `browserconfig.xml` in root hinzugefügt (für Microsoft Tiles)
- `scripts/generate-favicon.sh` hinzugefügt — Hilfsskript zur Erzeugung von `favicon.ico` mit ImageMagick

## Prüfungen / Nächste Schritte

1. Generiere `favicon.ico` lokal:

```bash
./scripts/generate-favicon.sh content/assets/img/icons/icon-32.png
```

2. Rich Results testen:

- https://search.google.com/test/rich-results → teste Homepage, /projekte/, /blog/, /videos/, /gallery/, /about/

3. BrowserConfig / Tiles (Microsoft) prüfen:

- Browser öffnen und `https://abdulkerimsesli.de/browserconfig.xml` aufrufen; tiles mit Edge testen

4. Sitemap in Google Search Console einreichen (Property: `abdulkerimsesli.de`)

5. Robots.txt prüfen: https://www.google.com/webmasters/tools/robots-testing-tool/

---

Wenn du möchtest, setze ich die Erstellung von `favicon.ico` als Job/GitHub Action auf (ImageMagick-Container), oder führe die Rich-Results-Tests lokal/remote durch und melde die Resultate zurück.
