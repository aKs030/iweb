# 🧪 CSP Testing Checklist

## Pre-Deployment Testing

Vor dem Deployment zu Production müssen alle Features getestet werden.

---

## ✅ Testing Checklist

### Core Functionality

- [ ] **Homepage lädt**
  - [ ] Keine CSP Violations in Console
  - [ ] Alle Bilder laden
  - [ ] Fonts laden korrekt
  - [ ] CSS wird angewendet

- [ ] **Navigation funktioniert**
  - [ ] Menu öffnet/schließt
  - [ ] Links funktionieren
  - [ ] Search funktioniert
  - [ ] Keine JavaScript-Fehler

### Interactive Features

- [ ] **Three.js Earth**
  - [ ] 3D-Szene lädt
  - [ ] Rotation funktioniert
  - [ ] Zoom funktioniert
  - [ ] Keine WebGL-Fehler

- [ ] **Robot Companion**
  - [ ] Robot erscheint
  - [ ] Chat funktioniert
  - [ ] Gemini API-Calls funktionieren
  - [ ] Keine API-Fehler

- [ ] **Search**
  - [ ] Search-Modal öffnet
  - [ ] Suche funktioniert
  - [ ] Ergebnisse werden angezeigt
  - [ ] Navigation zu Ergebnissen funktioniert

### Content Pages

- [ ] **Blog**
  - [ ] Blog-Übersicht lädt
  - [ ] Blog-Posts laden
  - [ ] SVG-Icons werden angezeigt
  - [ ] Code-Highlighting funktioniert

- [ ] **Videos**
  - [ ] Video-Übersicht lädt
  - [ ] YouTube-Thumbnails laden
  - [ ] Video-Embeds funktionieren
  - [ ] YouTube API funktioniert

- [ ] **Gallery**
  - [ ] Bilder laden
  - [ ] Lightbox funktioniert
  - [ ] Navigation funktioniert

- [ ] **Projekte**
  - [ ] Projekt-Karten laden
  - [ ] Links funktionieren
  - [ ] Bilder laden

### Analytics & Tracking

- [ ] **Google Tag Manager**
  - [ ] GTM Container lädt
  - [ ] Events werden getrackt
  - [ ] Keine CSP-Blockierung

- [ ] **Google Analytics**
  - [ ] GA4 lädt
  - [ ] Pageviews werden getrackt
  - [ ] Events funktionieren

### Service Worker

- [ ] **PWA Funktionalität**
  - [ ] Service Worker registriert
  - [ ] Offline-Modus funktioniert
  - [ ] Cache funktioniert
  - [ ] Manifest lädt

### Mobile Testing

- [ ] **Responsive Design**
  - [ ] Mobile Layout korrekt
  - [ ] Touch-Gesten funktionieren
  - [ ] Keine Layout-Shifts

### Browser Testing

- [ ] **Chrome/Edge**
  - [ ] Alle Features funktionieren
  - [ ] Keine Console-Errors

- [ ] **Firefox**
  - [ ] Alle Features funktionieren
  - [ ] Keine Console-Errors

- [ ] **Safari**
  - [ ] Alle Features funktionieren
  - [ ] Keine Console-Errors

---

## 🔍 CSP Violation Monitoring

### Browser Console prüfen

1. Öffne Developer Tools (F12)
2. Gehe zu Console Tab
3. Filtere nach "Content Security Policy"
4. Prüfe auf Violations:

```
Refused to execute inline script because it violates the following 
Content Security Policy directive: "script-src 'self'..."
```

### Network Tab prüfen

1. Öffne Developer Tools (F12)
2. Gehe zu Network Tab
3. Prüfe Response Headers:
   - `Content-Security-Policy` sollte vorhanden sein
   - Keine `Content-Security-Policy-Report-Only`

### Security Tab prüfen

1. Öffne Developer Tools (F12)
2. Gehe zu Security Tab (Chrome) oder Storage Tab (Firefox)
3. Prüfe CSP-Status

---

## 🐛 Häufige Probleme & Lösungen

### Problem 1: GTM wird blockiert

**Symptom:**
```
Refused to load the script 'https://www.googletagmanager.com/gtm.js'
```

**Lösung:**
- Prüfe ob `https://www.googletagmanager.com` in `script-src` ist
- Prüfe ob `https://www.google-analytics.com` in `connect-src` ist

### Problem 2: Inline-Styles blockiert

**Symptom:**
```
Refused to apply inline style because it violates CSP directive 'style-src'
```

**Lösung:**
- Verschiebe Styles in CSS-Datei
- Oder: Verwende CSS-Klassen

### Problem 3: YouTube-Embeds blockiert

**Symptom:**
```
Refused to frame 'https://www.youtube.com' because it violates 'frame-src'
```

**Lösung:**
- Prüfe ob `https://www.youtube-nocookie.com` in `frame-src` ist
- Verwende `youtube-nocookie.com` statt `youtube.com`

### Problem 4: API-Calls blockiert

**Symptom:**
```
Refused to connect to 'https://generativelanguage.googleapis.com'
```

**Lösung:**
- Prüfe ob Domain in `connect-src` ist
- Füge Domain hinzu falls fehlend

---

## 📊 Performance Testing

### Lighthouse Audit

```bash
# Chrome DevTools → Lighthouse
# Oder: CLI
npm install -g lighthouse
lighthouse https://www.abdulkerimsesli.de --view
```

**Erwartete Scores:**
- Performance: > 90
- Accessibility: > 95
- Best Practices: 100 (mit CSP)
- SEO: > 95

### WebPageTest

```
https://www.webpagetest.org/
```

**Prüfe:**
- Security Score: A+
- CSP Header vorhanden
- Keine Mixed Content

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Alle Tests bestanden
- [ ] Keine CSP Violations
- [ ] Lighthouse Score > 90
- [ ] Browser-Tests erfolgreich

### Deployment

```bash
# 1. Commit Changes
git add .
git commit -m "feat: Enable CSP enforcement mode"

# 2. Push to Repository
git push origin main

# 3. Deploy (falls automatisch nicht erfolgt)
# Cloudflare Pages deployed automatisch bei Push
```

### Post-Deployment

- [ ] Production-Site testen
- [ ] CSP Header in Production prüfen
- [ ] Analytics funktioniert
- [ ] Keine Fehler in Browser Console
- [ ] Monitoring für 24h

### Rollback Plan

Falls Probleme auftreten:

```bash
# 1. Revert Commit
git revert HEAD

# 2. Push
git push origin main

# 3. Oder: Manuell _headers anpassen
# Zurück zu Report-Only:
Content-Security-Policy-Report-Only: ...
```

---

## 📈 Success Metrics

### Security

- ✅ CSP im Enforcement-Modus
- ✅ Keine `unsafe-inline`
- ✅ Alle Violations blockiert
- ✅ Security Headers Score: A+

### Functionality

- ✅ Alle Features funktionieren
- ✅ Keine JavaScript-Fehler
- ✅ Analytics trackt korrekt
- ✅ Performance unverändert

### User Experience

- ✅ Keine sichtbaren Änderungen
- ✅ Keine Fehler für Benutzer
- ✅ Ladezeiten unverändert

---

**Status:** ✅ Bereit für Testing
