# 🚀 Deployment Checklist für iweb-6

## ✅ Vor dem Live-Gang:

---

**Hinweis:** Alle wichtigen Prüfungen (Security, Linting, Unit-Tests, Coverage,
HTML/CSS-Validierung) laufen automatisiert in der GitHub Actions Pipeline. Ein Deployment erfolgt
nur bei bestandenem CI.

---

### 🔧 **Technische Prüfungen:**

- [ ] Alle Links funktionieren korrekt
- [ ] Service Worker Cache ist aktuell
- [ ] Sitemap.xml ist erreichbar unter `/sitemap.xml`
- [ ] robots.txt ist erreichbar unter `/robots.txt`
- [ ] Favicon und Touch-Icons sind verfügbar
- [ ] Manifest.json lädt korrekt

### 🔒 **Sicherheit:**

- [ ] HTTPS aktiviert
- [ ] CSP-Headers funktionieren
- [ ] .htaccess Security-Headers aktiv
- [ ] Cookie-Banner DSGVO-konform
- [ ] Datenschutzerklärung vollständig

### 📊 **Performance:**

- [ ] Google PageSpeed Insights > 90
- [ ] Core Web Vitals im grünen Bereich
- [ ] Gzip-Kompression aktiv
- [ ] Browser-Caching funktioniert
- [ ] Bilder optimiert

### 🔍 **SEO:**

- [ ] Google Search Console eingerichtet
- [ ] Sitemap in GSC eingereicht
- [ ] Meta-Tags vollständig
- [ ] Open Graph funktioniert
- [ ] Structured Data validiert

### 📱 **Testing:**

- [ ] Desktop (Chrome, Firefox, Safari, Edge)
- [ ] Mobile (iOS Safari, Android Chrome)
- [ ] Tablet (iPad, Android)
- [ ] Accessibility (Screenreader-Test)

## 🌐 **Nach dem Live-Gang:**

### 📈 **Monitoring einrichten:**

- [ ] Google Analytics konfiguriert
- [ ] Google Search Console überwacht
- [ ] Error-Monitoring aktiviert
- [ ] Performance-Tracking läuft

### 🔄 **Wartung:**

- [ ] Backup-System eingerichtet
- [ ] Update-Prozess definiert
- [ ] SSL-Zertifikat Auto-Renewal
- [ ] Cache-Invalidierung bei Updates

## 🛠️ **Nützliche Tools:**

### **Performance Testing:**

- Google PageSpeed Insights: https://pagespeed.web.dev/
- GTmetrix: https://gtmetrix.com/
- WebPageTest: https://www.webpagetest.org/

### **SEO Testing:**

- Google Rich Results Test: https://search.google.com/test/rich-results
- Meta Tags Analyzer: https://metatags.io/
- Open Graph Debugger: https://developers.facebook.com/tools/debug/

### **Accessibility Testing:**

- WAVE: https://wave.webaim.org/
- axe DevTools (Browser Extension)
- Lighthouse Accessibility Audit

### **Validation:**

- HTML Validator: https://validator.w3.org/
- CSS Validator: https://jigsaw.w3.org/css-validator/
- JSON-LD Validator: https://search.google.com/structured-data/testing-tool

## 📝 **Domain-spezifische Anpassungen:**

Aktuelle Domain: `https://www.abdulkerimsesli.de`

**Überprüft und angepasst:**

- ✅ sitemap.xml
- ✅ robots.txt ✅ docs/index.html (Open Graph, JSON-LD)
- ✅ Meta-Tags

## 🎯 **Performance-Ziele:**

- **Lighthouse Score:** > 95
- **First Contentful Paint:** < 1.5s
- **Largest Contentful Paint:** < 2.5s
- **Cumulative Layout Shift:** < 0.1
- **First Input Delay:** < 100ms

---

**Status:** ✅ Produktionsreif **Letzte Prüfung:** 12. Juli 2025 **Nächste Prüfung:** Nach dem
ersten Deployment
