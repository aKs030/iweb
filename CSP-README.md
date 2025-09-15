# Content Security Policy (CSP) Konfiguration

## Übersicht

Die Website verwendet eine umfassende Content Security Policy, um XSS-Angriffe zu verhindern und die Sicherheit zu erhöhen.

## Implementierte CSP-Direktiven

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net;
font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net;
img-src 'self' data: https:;
connect-src 'self' https://api.github.com https://fonts.googleapis.com https://fonts.gstatic.com https://static.cloudflareinsights.com;
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

## Erlaubte Externe Ressourcen

### Scripts
- **Cloudflare Insights**: `https://static.cloudflareinsights.com` - Analytics
- **FontAwesome**: `https://cdn.jsdelivr.net` - Icon-Framework

### Styles
- **Google Fonts**: `https://fonts.googleapis.com` - Schriftarten
- **FontAwesome**: `https://cdn.jsdelivr.net` - Icon-Styles

### Fonts
- **Google Fonts**: `https://fonts.gstatic.com` - Schriftarten-Dateien
- **FontAwesome**: `https://cdn.jsdelivr.net` - Icon-Schriftarten

### Verbindungen
- **GitHub API**: `https://api.github.com` - Repository-Informationen
- **Google Fonts**: Schriftarten-APIs
- **Cloudflare**: Analytics

## Server-Konfiguration

### Apache (.htaccess)
Die `.htaccess` Datei im Root-Verzeichnis konfiguriert die Security-Header für Apache-Server.

### Nginx (nginx.conf.example)
Beispiel-Konfiguration für Nginx-Server im `nginx.conf.example` File.

## Fehlerbehebung

### Häufige CSP-Fehler

1. **Refused to load script/style**: Quelle zur entsprechenden CSP-Direktive hinzufügen
2. **Refused to execute inline script**: `'unsafe-inline'` verwenden oder Nonce implementieren
3. **Font loading blocked**: Quelle zu `font-src` hinzufügen

### Debug-Tipps

1. Browser-Entwicklertools → Console für CSP-Violations
2. Network-Tab für blockierte Ressourcen prüfen
3. CSP-Validator verwenden: https://csp-evaluator.withgoogle.com/

## Anpassungen

Bei Hinzufügung neuer externer Ressourcen:

1. Domain zur entsprechenden CSP-Direktive hinzufügen
2. Sowohl Meta-Tag als auch Server-Header aktualisieren
3. Funktionalität in verschiedenen Browsern testen

## Sicherheitshinweise

- `'unsafe-inline'` wird für JSON-LD Structured Data benötigt
- Regelmäßige Überprüfung der CSP auf nicht mehr benötigte Domains
- Monitoring von CSP-Violations implementieren