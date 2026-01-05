# Google Search Console - Sofort-Checkliste

## ✅ Nach dem Deployment durchführen

### 1. URL-Prüfung & Indexierung (Priorität: HOCH)

Gehe zu: https://search.google.com/search-console

#### Neue Canonical URLs prüfen & indexieren:
```
☐ https://abdulkerimsesli.de/
☐ https://abdulkerimsesli.de/projekte/
☐ https://abdulkerimsesli.de/gallery/
☐ https://abdulkerimsesli.de/about/
☐ https://abdulkerimsesli.de/blog/
☐ https://abdulkerimsesli.de/videos/
☐ https://abdulkerimsesli.de/impressum/
☐ https://abdulkerimsesli.de/datenschutz/
```

**Pro URL:**
1. URL in Suchfeld eingeben
2. "URL prüfen" klicken
3. Wenn "URL ist bei Google": ✓
4. Wenn "URL ist nicht bei Google": "Indexierung beantragen"

---

### 2. Alte URLs entfernen (Priorität: HOCH)

**Entfernungen** → **URLs vorübergehend entfernen** → **Neue Anfrage**

#### Liste der zu entfernenden URLs:

```
☐ http://abdulkerimsesli.de/ (http-Variante)
☐ http://www.abdulkerimsesli.de/ (www + http)
☐ https://www.abdulkerimsesli.de/ (www-Variante)
☐ https://abdulkerimsesli.de/index.html
☐ https://abdulkerimsesli.de/impressum.html
☐ https://abdulkerimsesli.de/datenschutz.html
☐ https://abdulkerimsesli.de/pages/album.html
☐ https://www.abdulkerimsesli.de/pages/ubermich.html
☐ https://www.abdulkerimsesli.de/pages/index-game.html
☐ https://www.abdulkerimsesli.de/pages/features/wetter.html
☐ https://www.abdulkerimsesli.de/pages/features/snake.html
☐ https://www.abdulkerimsesli.de/pages/komponente/footer.html
☐ https://abdulkerimsesli.de/content/footer/datenschutz.html
☐ https://www.abdulkerimsesli.de/pages/projekte/projekte.html
```

**Typ auswählen**: "Nur diese URL entfernen"

---

### 3. Sitemap neu einreichen (Priorität: MITTEL)

**Sitemaps** → Sitemap URL eingeben:
```
☐ https://abdulkerimsesli.de/sitemap.xml
☐ https://abdulkerimsesli.de/sitemap-images.xml
☐ https://abdulkerimsesli.de/sitemap-videos.xml
```

Wenn bereits vorhanden: 
- Löschen und neu einreichen
- ODER: "Erneut senden" klicken

---

### 4. Canonical-URL festlegen (Priorität: MITTEL)

**Einstellungen** → **Bevorzugte Domain**

Bestätigen dass folgende Einstellungen korrekt sind:
```
☐ Protokoll: HTTPS (nicht HTTP)
☐ Domain: abdulkerimsesli.de (OHNE www)
☐ www-Variante: Auf non-www umleiten
```

---

### 5. Weiterleitungen validieren (Priorität: HOCH)

**Abdeckung** → **Ausgeschlossen** → "Seite mit Weiterleitung"

Für jede URL prüfen:
1. Auf URL klicken
2. "URL prüfen"
3. Verify dass:
   - Status: 301 Moved Permanently
   - Ziel-URL: Korrekte canonical URL
   - Redirect-Kette: Max 1 Redirect (keine Kette!)

---

### 6. Duplikate prüfen (Priorität: MITTEL)

**Abdeckung** → **Ausgeschlossen** → "Duplikat – Google hat eine andere Seite als der Nutzer als kanonische Seite bestimmt"

Für jede betroffene URL:
1. URL öffnen
2. "Von Google ausgewählte canonical URL" prüfen
3. Wenn falsch: 
   - HTML-Canonical-Tag prüfen
   - Weiterleitungen prüfen
   - URL zur Indexierung einreichen

**Erwartung**: Nach 1-2 Wochen sollten diese Duplikate verschwinden!

---

### 7. Rich Results testen (Priorität: NIEDRIG)

Gehe zu: https://search.google.com/test/rich-results

Teste folgende URLs:
```
☐ https://abdulkerimsesli.de/
☐ https://abdulkerimsesli.de/projekte/
☐ https://abdulkerimsesli.de/about/
```

Sollte zeigen:
- ✅ Organization Schema
- ✅ Person Schema
- ✅ BreadcrumbList
- ✅ WebPage/WebSite

---

## 📊 Monitoring (Wöchentlich)

### Woche 1-2:
```
☐ Abdeckung → Gültig → Sollte steigen
☐ Abdeckung → Ausgeschlossen → "Seite mit Weiterleitung" sollte sinken
☐ Leistung → Klicks → Überwachen ob Klicks stabil bleiben
```

### Woche 3-4:
```
☐ Alle Duplikate sollten aufgelöst sein
☐ Nur noch canonical URLs im Index
☐ Keine "www" Varianten mehr
☐ Keine ".html" URLs mehr
```

---

## 🚨 Troubleshooting

### Problem: "Weiterleitung funktioniert nicht"
**Lösung:**
1. Lokale Test: `curl -I https://abdulkerimsesli.de/projekte`
2. Online-Test: https://httpstatus.io/
3. Prüfe _redirects Datei
4. Cache leeren (Cloudflare)

### Problem: "Canonical URL wird ignoriert"
**Lösung:**
1. HTML-Quellcode prüfen (View Source)
2. Canonical Tag muss im `<head>` sein
3. Darf nur EIN Canonical Tag geben
4. URL muss absolute URL sein (mit https://)

### Problem: "www-Variante wird noch indexiert"
**Lösung:**
1. Cloudflare Page Rule prüfen
2. DNS CNAME für www prüfen
3. In Search Console beide Properties verbinden
4. Manuelle Entfernung beantragen

---

## 📞 Support-Ressourcen

- **Google Search Central**: https://developers.google.com/search
- **Search Console Hilfe**: https://support.google.com/webmasters
- **Cloudflare Docs**: https://developers.cloudflare.com/pages
- **Redirect Tester**: https://httpstatus.io/

---

**Geschätzte Zeit**: 30-45 Minuten für vollständige Durchführung
**Wiederholung**: Wöchentlich in den ersten 4 Wochen, dann monatlich

---

Letzte Aktualisierung: 05.01.2026
