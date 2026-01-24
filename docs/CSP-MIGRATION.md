# 🔒 CSP Migration Guide

## Übersicht

Migration von Content-Security-Policy von **Report-Only** zu **Enforcement Mode**.

---

## 📊 Aktueller Status

### Phase 1: Report-Only ✅ (Erledigt)
- CSP im Monitoring-Modus
- Violations werden geloggt, aber nicht blockiert
- `'unsafe-inline'` erlaubt für script-src und style-src

### Phase 2: Inline-Removal ⏳ (In Arbeit)
- Inline-Scripts entfernen oder mit Hashes absichern
- Inline-Styles in CSS-Klassen verschieben
- Nonces für dynamische Scripts

### Phase 3: Enforcement 🎯 (Ziel)
- CSP im Enforcement-Modus
- Alle Violations werden blockiert
- Keine `'unsafe-inline'` mehr

---

## 🔍 Analyse der Inline-Inhalte

### JSON-LD Scripts (Sicher)

Diese Scripts enthalten nur strukturierte Daten (kein ausführbarer Code):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  ...
}
</script>
```

**Lösung:** JSON-LD Scripts sind sicher und können mit Hash-Werten erlaubt werden.

### Inline Styles (Minimal)

Nur 4 Vorkommen in Blog-Posts für SVG-Sprites:

```html
<svg style="position: absolute; width: 0; height: 0; overflow: hidden">
```

**Lösung:** In CSS-Klasse verschieben.

### Dynamische Scripts (GTM, Analytics)

Google Tag Manager und Analytics werden dynamisch geladen.

**Lösung:** Nonces verwenden oder auf Server-Side Tracking umstellen.

---

## ✅ Phase 2: Implementierung

### 1. SVG Inline-Styles entfernen

**Vorher:**
```html
<svg style="position: absolute; width: 0; height: 0; overflow: hidden">
```

**Nachher:**
```html
<svg class="svg-sprite-hidden">
```

```css
/* In main.css */
.svg-sprite-hidden {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}
```

### 2. JSON-LD Scripts mit Hashes

JSON-LD Scripts sind statisch und können mit SHA-256 Hashes erlaubt werden:

```
Content-Security-Policy: script-src 'self' 'sha256-HASH1' 'sha256-HASH2' ...
```

**Hash generieren:**
```bash
echo -n '<script content>' | openssl dgst -sha256 -binary | openssl base64
```

### 3. Nonces für dynamische Scripts

Für GTM und andere dynamische Scripts:

```html
<script nonce="RANDOM_NONCE">
  // GTM Code
</script>
```

```
Content-Security-Policy: script-src 'self' 'nonce-RANDOM_NONCE'
```

**Wichtig:** Nonce muss bei jedem Request neu generiert werden (Server-Side).

---

## 🎯 Phase 3: Neue CSP (Enforcement)

### Strikte CSP ohne unsafe-inline

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 
    'sha256-HASH_FAQ_JSONLD'
    'sha256-HASH_PERSON_JSONLD'
    'sha256-HASH_IMAGE_JSONLD'
    'sha256-HASH_ORG_JSONLD'
    https://cdn.jsdelivr.net
    https://www.googletagmanager.com
    https://www.google-analytics.com;
  style-src 'self' 
    https://fonts.googleapis.com;
  img-src 'self' 
    https://i.ytimg.com 
    https://i9.ytimg.com 
    https://www.youtube.com 
    https://www.google-analytics.com 
    data: 
    blob:;
  font-src 'self' 
    https://fonts.gstatic.com;
  connect-src 'self' 
    https://www.googleapis.com 
    https://www.google-analytics.com
    https://generativelanguage.googleapis.com;
  frame-src 
    https://www.youtube-nocookie.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
```

---

## 🔧 Implementierungs-Schritte

### Schritt 1: SVG Styles in CSS verschieben ✅

```bash
# Erstelle CSS-Klasse
echo ".svg-sprite-hidden { position: absolute; width: 0; height: 0; overflow: hidden; }" >> content/styles/main.css

# Ersetze in HTML-Dateien
find pages/blog -name "*.html" -exec sed -i '' 's/style="position: absolute; width: 0; height: 0; overflow: hidden"/class="svg-sprite-hidden"/g' {} \;
```

### Schritt 2: JSON-LD Hashes generieren

```bash
# Extrahiere JSON-LD Scripts und generiere Hashes
# (Manuell, da Inhalte dynamisch sind)
```

### Schritt 3: CSP Header aktualisieren

```bash
# In _headers Datei
# Ersetze Content-Security-Policy-Report-Only mit Content-Security-Policy
```

### Schritt 4: Testen

```bash
# 1. Lokaler Test
npm run dev

# 2. Browser Console prüfen auf CSP Violations
# 3. Funktionalität testen (GTM, Analytics, Three.js, etc.)
```

### Schritt 5: Deployment

```bash
# Deploy zu Cloudflare
# Monitoring für 24h
# Bei Problemen: Rollback zu Report-Only
```

---

## 🚨 Risiken & Mitigation

### Risiko 1: GTM/Analytics blockiert

**Symptom:** Tracking funktioniert nicht mehr

**Mitigation:**
- Nonces für GTM verwenden
- Oder: Server-Side Tracking implementieren
- Oder: GTM in erlaubte Domains aufnehmen

### Risiko 2: Dynamische Inhalte blockiert

**Symptom:** Features funktionieren nicht

**Mitigation:**
- Alle dynamischen Scripts identifizieren
- Hashes oder Nonces hinzufügen
- Ausführliches Testing

### Risiko 3: Third-Party Scripts

**Symptom:** CDN-Ressourcen blockiert

**Mitigation:**
- Alle CDN-Domains in CSP aufnehmen
- Oder: Ressourcen selbst hosten

---

## 📊 Testing Checklist

- [ ] Homepage lädt korrekt
- [ ] Three.js Earth funktioniert
- [ ] Robot Companion funktioniert
- [ ] Search funktioniert
- [ ] Videos laden
- [ ] Blog-Posts laden
- [ ] GTM/Analytics trackt
- [ ] Keine CSP Violations in Console
- [ ] Mobile funktioniert
- [ ] Service Worker funktioniert

---

## 🔄 Rollback Plan

Falls Probleme auftreten:

```bash
# 1. Zurück zu Report-Only
# In _headers:
Content-Security-Policy-Report-Only: ...

# 2. Deploy
wrangler deploy

# 3. Violations analysieren
# Browser Console → Network Tab → Headers

# 4. Fixes implementieren

# 5. Erneut auf Enforcement umstellen
```

---

## 📈 Erwartete Verbesserungen

### Sicherheit
- ✅ XSS-Angriffe durch Inline-Scripts verhindert
- ✅ Code-Injection blockiert
- ✅ Clickjacking verhindert
- ✅ MITM-Angriffe erschwert

### Compliance
- ✅ OWASP Best Practices
- ✅ GDPR-konform (keine Tracking ohne Consent)
- ✅ Security Headers Best Practices

### Performance
- ⚠️ Minimal langsamer (Hash-Validierung)
- ✅ Aber: Weniger Angriffsfläche

---

**Status:** ⏳ Phase 2 in Arbeit - Inline-Removal
