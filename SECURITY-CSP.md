# Content Security Policy (CSP) Empfehlungen

## Übersicht

Content Security Policy ist ein wichtiger Sicherheitsmechanismus, der Cross-Site-Scripting (XSS) und andere Code-Injection-Angriffe verhindert.

## Empfohlene CSP-Header für iweb

### Production CSP (Streng)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com data:;
  img-src 'self' data: https: blob:;
  connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com;
  media-src 'self';
  object-src 'none';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

### Development CSP (Weniger streng)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' ws://localhost:* ws://127.0.0.1:*;
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;
  img-src 'self' data: https: blob:;
  connect-src 'self' ws://localhost:* ws://127.0.0.1:* https://www.google-analytics.com;
  media-src 'self';
  object-src 'none';
  base-uri 'self';
```

## Implementation

### Option 1: HTTP Header (Empfohlen)

Füge den CSP-Header in deiner Server-Konfiguration hinzu:

**Nginx:**

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
```

**Apache (.htaccess):**

```apache
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
```

**Netlify (\_headers Datei):**

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

**Vercel (vercel.json):**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        }
      ]
    }
  ]
}
```

### Option 2: Meta Tag (Fallback)

Füge im `<head>` Bereich jeder HTML-Seite hinzu:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;" />
```

**Hinweis:** Meta-Tags unterstützen nicht alle CSP-Direktiven (z.B. `frame-ancestors`, `report-uri`).

## Erklärung der Direktiven

### default-src 'self'

Standardregel: Erlaube nur Ressourcen von der eigenen Domain.

### script-src 'self' 'unsafe-inline'

- `'self'`: Erlaube JavaScript von eigener Domain
- `'unsafe-inline'`: Erlaube Inline-Scripts (notwendig für aktuelle Implementierung)
- **Empfehlung:** Langfristig auf `'nonce-'` oder `'sha256-'` umsteigen

### style-src 'self' 'unsafe-inline'

- Erlaube CSS von eigener Domain und inline Styles
- Notwendig für critical CSS und dynamische Styles

### img-src 'self' data: https:

- Erlaube Bilder von eigener Domain
- `data:`: Base64-kodierte Bilder
- `https:`: Bilder von beliebigen HTTPS-Quellen

### font-src 'self' data:

- Erlaube Schriftarten von eigener Domain und Base64-kodierte Fonts

### connect-src 'self'

- Erlaube AJAX/Fetch-Anfragen nur zur eigenen Domain
- Füge externe APIs hier hinzu (z.B. Google Analytics)

### object-src 'none'

Blockiere alle `<object>`, `<embed>`, und `<applet>` Elemente (Sicherheit).

### frame-ancestors 'none'

Verhindere, dass die Seite in Frames/iFrames eingebettet wird (Clickjacking-Schutz).

### base-uri 'self'

Beschränke `<base>`-Tag auf eigene Domain.

### upgrade-insecure-requests

Upgrade automatisch HTTP zu HTTPS (nur für HTTPS-Seiten).

## Schrittweise Migration

### Phase 1: Report-Only Modus

Teste CSP ohne Blockierung:

```
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-violations;
```

### Phase 2: Lockere Policy

Starte mit einer lockeren Policy und verschärfe schrittweise:

```
Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https:;
```

### Phase 3: Strikte Policy

Entferne `'unsafe-inline'` und `'unsafe-eval'`:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}';
```

## CSP für iweb-spezifische Features

### Three.js (WebGL)

```
script-src 'self' 'unsafe-eval';  /* Three.js benötigt eval für Shader */
```

### React (Development)

```
script-src 'self' 'unsafe-eval';  /* React DevTools benötigt eval */
```

### WebSockets (Development)

```
connect-src 'self' ws://localhost:* ws://127.0.0.1:*;
```

## Testen der CSP

### Browser DevTools

Öffne die Browser-Konsole, um CSP-Verletzungen zu sehen.

### Online Tools

- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [Report URI CSP Builder](https://report-uri.com/home/generate)

### Testing Script

```javascript
// Test CSP violations in console
console.log('CSP Test: Inline script executed');

// Dies sollte blockiert werden bei strikter CSP:
eval('console.log("eval test")');
```

## Best Practices

1. **Starte mit Report-Only Modus**
2. **Verwende Nonces für Inline-Scripts** (fortgeschritten)
3. **Minimiere `unsafe-inline` und `unsafe-eval`**
4. **Halte CSP aktuell** bei neuen externen Ressourcen
5. **Teste in allen Browsern** (Safari, Chrome, Firefox)
6. **Implementiere CSP-Reporting** zur Überwachung

## Zusätzliche Sicherheits-Header

Neben CSP sollten auch diese Header gesetzt werden:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

## Nützliche Links

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Quick Reference](https://content-security-policy.com/)
- [Google CSP Guide](https://developers.google.com/web/fundamentals/security/csp)
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)

## Status: Implementierung ausstehend

Die CSP-Header müssen auf dem Server/Hosting-Provider konfiguriert werden. Siehe Implementation-Abschnitt oben für spezifische Anweisungen.
