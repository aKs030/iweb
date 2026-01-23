# 🎯 Validator Quick Reference

## Was Sie validieren möchten?

### ✅ JSON-LD Strukturierte Daten (Schema.org)

**Das sind unsere Optimierungen in index.html:**

```html
<script type="application/ld+json">
  {
    "@type": "Person",
    "@type": "Organization",
    "@type": "FAQPage",
    "@type": "BreadcrumbList"
  }
</script>
```

**Richtige Validatoren:**

1. **Google Rich Results Test** → https://search.google.com/test/rich-results ⭐ BESTE WAHL
2. **JSON-LD Linter** → https://linter.structured-data.org/ (Alternative)

**Nicht verwenden:**

- ❌ schema.org/validate (veraltet)
- ❌ validator.schema.org (existiert nicht)
- ❌ manifest-validator.appspot.com (falscher Zweck)

---

### ❌ manifest.json (Web App Manifest)

**Das ist eine SEPARATE Datei:**

```json
{
  "name": "Abdulkerim Sesli - Web Dev",
  "start_url": "/",
  "icons": [...]
}
```

**Richtige Validatoren:**

1. **PWA Builder** → https://www.pwabuilder.com/ ⭐ BESTE WAHL
2. **Manifest Validator** → https://manifest-validator.appspot.com/ (Alternative)

**NICHT verwenden für JSON-LD!**

- ❌ Rich Results Test (prüft keine Manifests)
- ❌ linter.structured-data.org (prüft keine Manifests)

---

### 📊 Performance & SEO

**Alle Metriken testen:**

```
LCP, CLS, FID, Performance, Accessibility, Best Practices, SEO
```

**Validator:**

1. **PageSpeed Insights** → https://pagespeed.web.dev/ ⭐ BESTE WAHL

---

### 📝 Google Indexierung & Crawling

**Prüfe ob Google deine Seiten findet:**

**Validator:**

1. **Google Search Console** → https://search.google.com/search-console ⭐ BESTE WAHL

---

## 🚨 Die wichtigsten Unterschiede

| Was                | Datei            | Validator                                   | Zweck                                         |
| ------------------ | ---------------- | ------------------------------------------- | --------------------------------------------- |
| **JSON-LD Schema** | `<head>` HTML    | https://search.google.com/test/rich-results | Person, Organization, FAQPage, BreadcrumbList |
| **manifest.json**  | `/manifest.json` | https://www.pwabuilder.com/                 | Web App (PWA) Einstellungen                   |
| **Performance**    | Alle Seiten      | https://pagespeed.web.dev/                  | LCP, CLS, FID                                 |
| **Indexierung**    | Alle Seiten      | https://search.google.com/search-console    | Kann Google die Seite finden?                 |

---

## 📋 UNSERE Implementierungen validieren:

### Für Ihre SEO-Optimierungen:

```
✅ JSON-LD in index.html
   Validator: https://search.google.com/test/rich-results

✅ Canonical-Tags
   Validator: https://search.google.com/search-console

✅ BreadcrumbList Schema
   Validator: https://search.google.com/test/rich-results

✅ Performance (Preload, Fonts)
   Validator: https://pagespeed.web.dev/
```

### NICHT in unsere SEO gehört:

```
❌ manifest.json Validierung
   Das ist für PWA-Installation relevant,
   aber NICHT für SEO/Schema.org
```

---

## 🎬 Schritt-für-Schritt

### Schritt 1: JSON-LD Strukturierte Daten prüfen

```
1. Gehe zu: https://search.google.com/test/rich-results
2. Gib ein: https://abdulkerimsesli.de/
3. Klicke: "Test URL"
4. Erwartet: ✅ FAQPage, BreadcrumbList, Person, Organization
```

### Schritt 2: Performance Check

```
1. Gehe zu: https://pagespeed.web.dev/
2. Gib ein: https://abdulkerimsesli.de/
3. Warte auf Report
4. Ziel: Performance > 90, SEO > 90
```

### Schritt 3: Google Suchkonsole

```
1. Gehe zu: https://search.google.com/search-console
2. Wähle: abdulkerimsesli.de
3. Klicke: "URL Inspection"
4. Gib ein: https://abdulkerimsesli.de/
5. Prüfe: "Abrufbar?", "Indexierbar?"
```

---

## ❌ HÄUFIGE FEHLER

### Fehler 1: manifest.json mit schema.org Validator prüfen

```
❌ FALSCH: Gehe zu schema.org/validate
✅ RICHTIG: Nutze https://www.pwabuilder.com/
```

### Fehler 2: JSON-LD mit manifest Validator prüfen

```
❌ FALSCH: Gehe zu manifest-validator.appspot.com
✅ RICHTIG: Nutze https://search.google.com/test/rich-results
```

### Fehler 3: validator.schema.org verwenden

```
❌ FALSCH: Diese URL existiert nicht!
✅ RICHTIG: Nutze https://search.google.com/test/rich-results
```

---

## ✅ FINAL CHECKLIST

- [ ] JSON-LD getestet → https://search.google.com/test/rich-results

  - [ ] FAQPage: OK?
  - [ ] BreadcrumbList: OK?
  - [ ] Person: OK?
  - [ ] Organization: OK?

- [ ] Performance getestet → https://pagespeed.web.dev/

  - [ ] LCP: < 2.5s?
  - [ ] Performance: > 90?
  - [ ] SEO: > 90?

- [ ] Google Search Console → https://search.google.com/search-console

  - [ ] Indexierbar?
  - [ ] Canonical korrekt?
  - [ ] Mobile-friendly?

- [ ] manifest.json getestet → https://www.pwabuilder.com/ (optional, nur wenn PWA wichtig)
  - [ ] Icons: OK?
  - [ ] Start URL: OK?

---

**Letzte Aktualisierung:** 15. Januar 2026  
**Alle URLs verifiziert und korrekt** ✅
