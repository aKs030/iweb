# Middleware Architecture 🔧

**Datum:** 12. Februar 2026  
**Version:** 1.0.0

## 📋 Übersicht

Das Projekt verwendet eine hierarchische Middleware-Architektur mit Cloudflare Pages Functions.

## 🏗️ Struktur

```
functions/
├── _middleware.js           # Root-Level Middleware
└── api/
    ├── _middleware.js       # API-Level Middleware
    ├── search.js           # Search Endpoint
    └── ai.js               # AI Endpoint (optional)
```

## 🔄 Middleware-Hierarchie

### 1. Root-Level Middleware (`functions/_middleware.js`)

**Zweck:** Template Injection & Redirects

**Läuft für:** Alle Requests (außer `/api/*`)

**Funktionen:**

- ✅ Template Injection (BASE-HEAD, BASE-LOADER)
- ✅ www-Redirect (abdulkerimsesli.de → www.abdulkerimsesli.de)
- ✅ HTML Response Processing
- ✅ Überspringt API-Routes

**Code:**

```javascript
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Skip API routes - they have their own middleware
  if (url.pathname.startsWith('/api/')) {
    return await context.next();
  }

  // ... Template Injection Logic
}
```

---

### 2. API-Level Middleware (`functions/api/_middleware.js`)

**Zweck:** Rate Limiting & Security

**Läuft für:** Nur `/api/*` Requests

**Funktionen:**

- ✅ Rate Limiting (30 req/min normal, 10 req/min AI)
- ✅ IP-basierte Identifikation
- ✅ Rate Limit Headers
- ✅ 429 Response bei Überschreitung
- ✅ Automatische Cleanup-Funktion

**Code:**

```javascript
export async function onRequest(context) {
  const { request, next } = context;

  // Skip OPTIONS requests
  if (request.method === 'OPTIONS') {
    return next();
  }

  // Rate limiting logic
  const result = rateLimiter.check(clientId, maxRequests);

  if (!result.allowed) {
    return new Response(/* 429 Error */, { status: 429 });
  }

  return next();
}
```

---

## 🔀 Request Flow

### HTML Request (z.B. `/blog`)

```
1. Request → functions/_middleware.js
   ├─ Check: Ist es /api/*? → Nein
   ├─ www-Redirect prüfen
   ├─ HTML Response verarbeiten
   └─ Template Injection

2. Response → Client
```

### API Request (z.B. `/api/search`)

```
1. Request → functions/_middleware.js
   └─ Check: Ist es /api/*? → Ja → Skip (next())

2. Request → functions/api/_middleware.js
   ├─ Rate Limiting prüfen
   ├─ IP identifizieren
   ├─ Request zählen
   └─ Wenn OK: next()

3. Request → functions/api/search.js
   └─ Search Logic

4. Response → functions/api/_middleware.js
   └─ Rate Limit Headers hinzufügen

5. Response → Client
```

---

## ⚙️ Konfiguration

### Root Middleware

**Datei:** `functions/_middleware.js`

**Konfigurierbar:**

- Template-Pfade
- Redirect-Regeln
- Content-Type Filter

### API Middleware

**Datei:** `functions/api/_middleware.js`

**Konfigurierbar:**

```javascript
const RATE_LIMIT = {
  WINDOW_MS: 60000, // 1 Minute
  MAX_REQUESTS: 30, // Normal Endpoints
  MAX_REQUESTS_STRICT: 10, // AI Endpoints
};
```

---

## 🎯 Best Practices

### 1. Middleware-Reihenfolge

✅ **Richtig:**

```
Root Middleware → API Middleware → Endpoint
```

❌ **Falsch:**

```
API Middleware ohne Root Skip
```

### 2. Performance

✅ **Richtig:**

- Root Middleware überspringt API-Routes sofort
- API Middleware nur für API-Requests
- Parallele Template-Loads

❌ **Falsch:**

- Root Middleware verarbeitet API-Requests
- Sequentielle Template-Loads

### 3. Error Handling

✅ **Richtig:**

```javascript
try {
  response = await context.next();
} catch (err) {
  console.error('[middleware] Error:', err);
  return new Response('Error', { status: 500 });
}
```

❌ **Falsch:**

```javascript
const response = await context.next(); // Kein Error Handling
```

---

## 🔍 Debugging

### Root Middleware

```javascript
// In functions/_middleware.js
console.log('[Root MW] Processing:', url.pathname);
console.log('[Root MW] Skipping API:', url.pathname.startsWith('/api/'));
```

### API Middleware

```javascript
// In functions/api/_middleware.js
console.log('[API MW] Rate limit check:', clientId);
console.log('[API MW] Remaining:', result.remaining);
```

---

## 📊 Monitoring

### Rate Limit Headers

Jede API-Response enthält:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
Retry-After: 45 (nur bei 429)
```

### Logs

```javascript
// Root Middleware
[middleware] context.next() failed: Error

// API Middleware
[RateLimiter] Client exceeded limit: 1.2.3.4
[RateLimiter] Cleanup: Removed 15 old entries
```

---

## 🚀 Deployment

### Cloudflare Pages

Beide Middleware-Dateien werden automatisch erkannt:

```bash
# Preflight checks
npm run qa

# Deploy
npx wrangler pages deploy . --project-name=1web
```

### Lokale Entwicklung

```bash
# Einheitlicher Dev-Workflow
npm run dev
```

**Hinweis:** `npm run dev` startet den modernen Workflow mit Token-Preflight, Token-Watcher und `wrangler pages dev`.

---

## ✅ Checkliste

### Root Middleware

- [x] Template Injection funktioniert
- [x] www-Redirect funktioniert
- [x] API-Routes werden übersprungen
- [x] Error Handling vorhanden

### API Middleware

- [x] Rate Limiting funktioniert
- [x] IP-Identifikation funktioniert
- [x] Headers werden gesetzt
- [x] Cleanup-Funktion läuft
- [x] OPTIONS-Requests werden übersprungen

---

## 📝 Zusammenfassung

**Zwei Middleware-Dateien sind korrekt!**

- `functions/_middleware.js` - Für HTML/Template-Processing
- `functions/api/_middleware.js` - Für API Rate Limiting

Beide arbeiten hierarchisch zusammen und überschneiden sich nicht.

**Status:** ✅ Korrekt konfiguriert

---

**Erstellt von:** Kiro AI Assistant  
**Datum:** 12. Februar 2026  
**Version:** 1.0.0
