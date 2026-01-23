# 🔒 Security Fixes - Schritt-für-Schritt Anleitung

## ✅ ERLEDIGT: API-Key aus Client-Code entfernt

Der Gemini API-Key wurde aus dem Client-Code entfernt und ist jetzt nur noch im Cloudflare Worker verfügbar.

### Geänderte Dateien:
- ✅ `content/components/robot-companion/config.js` - Key entfernt
- ✅ `content/components/robot-companion/gemini-service.js` - Nur Proxy-Nutzung

---

## 🚨 SOFORT ERFORDERLICH: API-Key rotieren

Der alte API-Key war im Git-Repository exponiert und muss **sofort** rotiert werden.

### Schritt 1: Neuen API-Key in Google Cloud Console erstellen

1. Gehe zu: https://console.cloud.google.com/apis/credentials
2. Wähle dein Projekt aus
3. Klicke auf "CREATE CREDENTIALS" → "API key"
4. Kopiere den neuen Key (z.B. `***REMOVED***...`)
5. Klicke auf "RESTRICT KEY"

### Schritt 2: API-Key einschränken (WICHTIG!)

**Application restrictions:**
- Wähle: "HTTP referrers (web sites)"
- Füge hinzu:
  - `https://www.abdulkerimsesli.de/*`
  - `https://abdulkerimsesli.de/*`
  - `http://localhost:8080/*` (nur für lokale Entwicklung)

**API restrictions:**
- Wähle: "Restrict key"
- Aktiviere nur: "Generative Language API"

### Schritt 3: Neuen Key im Cloudflare Worker setzen

```bash
# Im Projekt-Root ausführen:
wrangler secret put GEMINI_API_KEY

# Wenn gefragt, den NEUEN API-Key eingeben
# Bestätigen mit Enter
```

### Schritt 4: Alten Key löschen

1. Zurück zu Google Cloud Console
2. Finde den alten Key (der mit `***REMOVED***` beginnt)
3. Klicke auf "DELETE"
4. Bestätige die Löschung

### Schritt 5: Deployment testen

```bash
# Worker neu deployen
wrangler deploy

# Testen ob der neue Key funktioniert
curl -X POST https://www.abdulkerimsesli.de/api/gemini \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hallo, funktioniert der neue Key?","systemInstruction":"Antworte kurz."}'
```

---

## ✅ Verifizierung

Nach der Key-Rotation sollte:
- ✅ Der alte Key gelöscht sein
- ✅ Der neue Key nur auf deine Domain beschränkt sein
- ✅ Der neue Key nur die Generative Language API nutzen können
- ✅ Der neue Key im Cloudflare Worker Secret gespeichert sein
- ✅ Kein API-Key mehr im Git-Repository vorhanden sein

---

## 📝 Nächste Schritte

Nach der API-Key Rotation können wir mit den nächsten Sicherheits-Fixes fortfahren:
- [ ] DOMPurify für innerHTML-Sanitization hinzufügen
- [ ] CSP von Report-Only auf Enforcement umstellen
- [ ] Build-System (Vite) einrichten
- [ ] Tests hinzufügen

---

## ✅ ERLEDIGT: API-Key Rotation abgeschlossen

**Datum:** 2026-01-23

### Durchgeführte Schritte:
1. ✅ Neuer API-Key in Google Cloud Console erstellt
2. ✅ Key im Cloudflare Worker gesetzt: `wrangler secret put GEMINI_API_KEY --env=""`
3. ✅ Worker neu deployed: `wrangler deploy --env=""`
4. ✅ Worker läuft auf:
   - `www.abdulkerimsesli.de/api/gemini`
   - `abdulkerimsesli.de/api/gemini`

### ⚠️ NOCH ZU TUN:
- [ ] Neuen Key in Google Cloud Console einschränken (Domain + API)
- [ ] Alten Key (`***REMOVED***`) löschen
- [ ] Funktionstest durchführen

---

**Status:** ✅ Key gesetzt, ⏳ Warte auf Einschränkung & Löschung des alten Keys
