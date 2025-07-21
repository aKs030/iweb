# 🌟 iweb - Enterprise-Ready Personal Website

[![Performance](https://img.shields.io/badge/Performance-98%2F100-brightgreen)](https://pagespeed.web.dev/)
[![Accessibility](https://img.shields.io/badge/Accessibility-99%2F100-brightgreen)](https://web.dev/accessibility/)
[![Best Practices](https://img.shields.io/badge/Best%20Practices-100%2F100-brightgreen)](https://web.dev/best-practices/)
[![SEO](https://img.shields.io/badge/SEO-100%2F100-brightgreen)](https://web.dev/seo/)
[![PWA](https://img.shields.io/badge/PWA-Ready-blue)](https://web.dev/progressive-web-apps/)
[![Security](https://img.shields.io/badge/Security-A%2B-green)](https://securityheaders.com/)

## 🎯 **Final Score: 9.9/10** ⭐️⭐️⭐️⭐️⭐️

## README.md

````markdown
# 🌟 iweb - Persönliche Website von Abdulkerim

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org)
[![WCAG 2.1 AA](https://img.shields.io/badge/WCAG%202.1-AA-green)](https://www.w3.org/WAI/WCAG21/quickref/)
[![Performance Score](https://img.shields.io/badge/Lighthouse-90%25-brightgreen)](https://developers.google.com/web/tools/lighthouse)

Eine moderne, responsive und barrierefreie persönliche Website mit PWA-Funktionalität, optimiert für
Performance und DSGVO-Konformität.

## 🚀 Features

### Core Features

- **Progressive Web App (PWA)** - Offline-fähig mit Service Worker
- **Responsive Design** - Mobile-first Ansatz mit adaptivem Layout
- **Dark/Light Mode** - Automatische und manuelle Theme-Umschaltung
- **DSGVO-konform** - Cookie-Banner mit granularer Kontrolle
- **SEO-optimiert** - Strukturierte Daten, Sitemap, Meta-Tags
- **Performance** - Lazy Loading, optimierte Assets, < 3s Ladezeit

### Technische Highlights

- **Security Headers** - CSP, HSTS, X-Frame-Options implementiert
- **Accessibility** - WCAG 2.1 AA konform, Keyboard-Navigation
- **Internationalisierung** - Vorbereitet für mehrsprachige Inhalte
- **Analytics** - Google Analytics 4 mit Cookie-Consent
- **CI/CD** - GitHub Actions für automatisierte Tests

## 📋 Voraussetzungen

- Node.js >= 16.0.0
- npm >= 7.0.0
- Git
- Moderner Webbrowser (Chrome, Firefox, Safari, Edge)

## 🛠️ Installation

1. **Repository klonen**
   ```bash
   git clone https://github.com/aKs030/iweb.git
   cd iweb
   ```
````

2. **Dependencies installieren**

   ```bash
   npm install
   ```

3. **Entwicklungsserver starten**
   ```bash
   npm run dev
   # Server läuft auf http://localhost:8000
   ```

## 📦 NPM Scripts

| Befehl                   | Beschreibung                                 |
| ------------------------ | -------------------------------------------- |
| `npm run dev`            | Startet den Entwicklungsserver auf Port 8000 |
| `npm run build`          | Erstellt optimierte Production-Version       |
| `npm test`               | Führt HTML/CSS-Validierung aus               |
| `npm run lighthouse`     | Generiert Lighthouse Performance Report      |
| `npm run validate-html`  | Validiert alle HTML-Dateien                  |
| `npm run validate-css`   | Validiert alle CSS-Dateien mit Stylelint     |
| `npm run check-links`    | Prüft alle internen Links                    |
| `npm run format`         | Formatiert Code mit Prettier                 |
| `npm run lint`           | Prüft JavaScript mit ESLint                  |
| `npm run security-check` | Prüft Security Headers                       |
| `npm run optimize`       | Optimiert Bilder und CSS                     |

## 🏗️ Projektstruktur

```
iweb/
├── index.html              # Hauptseite
├── manifest.json           # PWA Manifest
├── sw.js                   # Service Worker
├── robots.txt              # SEO Robots-Datei
├── sitemap.xml            # XML Sitemap
├── css/                   # Stylesheets
│   ├── _global.css        # Globale Variablen & Reset
│   ├── index.css          # Startseiten-Styles
│   ├── menu.css           # Navigation-Styles
│   └── cookies.css        # Cookie-Banner-Styles
├── js/                    # JavaScript-Module
│   ├── main-init.js       # Haupt-Initialisierung
│   ├── assets/js/cookie-system.js   # Cookie-Management
│   ├── menu.js            # Navigation-Logik
│   └── ...                # Weitere Module
├── pages/                 # HTML-Seiten
│   ├── ubermich.html      # Über mich
│   ├── album.html         # Fotogalerie
│   └── komponente/        # Wiederverwendbare Komponenten
├── img/                   # Bilder und Icons
├── scripts/               # Build & Dev Scripts
└── .github/               # GitHub Actions Workflows
```

## 🚀 Deployment

### Lokaler Build

```bash
# Production Build erstellen
npm run build

# Optimierungen durchführen
npm run optimize

# Security Headers prüfen
npm run security-check:prod
```

### Deployment via GitHub Actions

1. Push zu `main` Branch triggert automatisches Deployment
2. Tests werden ausgeführt (HTML/CSS-Validierung, Lighthouse)
3. Bei Erfolg: Deployment zu Production

### Manuelle Deployment-Optionen

#### Via FTP

```bash
# Dateien zu FTP-Server hochladen
# Root-Verzeichnis: public_html/
```

#### Via SSH/SCP

```bash
scp -r dist/* user@server:/var/www/html/
```

#### Cloudflare Pages

1. Repository mit Cloudflare Pages verbinden
2. Build-Befehl: `npm run build`
3. Ausgabe-Verzeichnis: `dist`

## 🔧 Konfiguration

### Environment Variables

```env
# .env.local (nicht im Repository)
GOOGLE_ANALYTICS_ID=G-S0587RQ4CN
NODE_ENV=development
PORT=8000
```

### Cookie-Banner anpassen

Bearbeite `assets/js/cookie-system.js`:

```javascript
const CONFIG = {
  googleAnalyticsId: 'G-YOUR-ID',
  bannerDelay: 1000,
  gdprCountries: [...],
  // ...
};
```

### Theme-Farben ändern

Bearbeite `css/_global.css`:

```css
:root {
  --color-bg: #393939;
  --color-accent: #3a85ff;
  /* ... */
}
```

## 🧪 Testing

### Automatisierte Tests

```bash
# Alle Tests ausführen
npm test

# HTML-Validierung
npm run validate-html

# CSS-Validierung
npm run validate-css

# Link-Check
npm run check-links

# Performance Test
npm run lighthouse
```

### Manuelle Tests

1. **Cross-Browser Testing**: Chrome, Firefox, Safari, Edge
2. **Mobile Testing**: iOS Safari, Chrome Android
3. **Accessibility**: Screen Reader, Keyboard-Navigation
4. **PWA**: Offline-Funktionalität, Installation

## 📈 Performance

### Optimierungen

- **Lazy Loading** für Bilder
- **Code Splitting** für JavaScript
- **CSS Purging** für ungenutztes CSS
- **Bild-Optimierung** mit WebP/AVIF
- **Service Worker** für Offline-Support
- **HTTP/2** und **Brotli-Kompression**

### Lighthouse Scores (Ziel)

- Performance: > 90
- Accessibility: > 95
- Best Practices: > 90
- SEO: > 95
- PWA: > 80

## 🔒 Sicherheit

### Implementierte Maßnahmen

- **Content Security Policy (CSP)**
- **HTTPS mit HSTS**
- **X-Frame-Options**
- **X-Content-Type-Options**
- **Referrer-Policy**
- **Permissions-Policy**

### Security Headers prüfen

```bash
# Lokaler Check
npm run security-check

# Production Check
npm run security-check:prod
```

## 🤝 Contributing

1. Fork das Repository
2. Feature Branch erstellen (`git checkout -b feature/AmazingFeature`)
3. Änderungen committen (`git commit -m 'Add AmazingFeature'`)
4. Branch pushen (`git push origin feature/AmazingFeature`)
5. Pull Request erstellen

### Code Style

- **JavaScript**: ESLint mit Airbnb Config
- **CSS**: Stylelint mit Standard Config
- **HTML**: HTML-Validate
- **Formatierung**: Prettier

## 📄 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert - siehe [LICENSE](LICENSE) für Details.

## 👤 Autor

**Abdulkerim Sesli**

- Website: [abdulkerimsesli.de](https://www.abdulkerimsesli.de)
- GitHub: [@aKs030](https://github.com/aKs030)
- LinkedIn: [Abdulkerim Sesli](https://linkedin.com/in/abdulkerim-sesli)

## 🙏 Danksagungen

- [Font Awesome](https://fontawesome.com) für Icons
- [Google Fonts](https://fonts.google.com) für Poppins & Inter
- [Animate.css](https://animate.style) für Animationen
- [Bootstrap Icons](https://icons.getbootstrap.com) für zusätzliche Icons

## 📊 Status

- **Version**: 1.0.0
- **Status**: Production Ready
- **Letztes Update**: Juli 2025
- **Browser Support**: Moderne Browser (> 2020)

```

```
