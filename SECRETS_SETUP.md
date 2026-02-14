# Cloudflare Pages Secrets Setup

## Secrets hinzufügen

### 1. Cloudflare Dashboard öffnen

```
https://dash.cloudflare.com/652ca9f4abc93203c1ecd059dc00d1da/pages/view/1web
```

### 2. Zu Settings navigieren

1. Klicke auf **Settings**
2. Klicke auf **Environment variables**

### 3. Secrets hinzufügen

**Production Environment:**

1. Scrolle zu **Production** Sektion
2. Klicke auf **Add variable**
3. Füge folgende Secrets hinzu:

```
Variable name:  RESEND_API_KEY
Value:          re_***************************
Type:           Secret (verschlüsselt)
```

```
Variable name:  GROQ_API_KEY
Value:          gsk_***************************
Type:           Secret (verschlüsselt)
```

4. Klicke auf **Save**

### 4. Preview Environment (optional)

Falls du auch Preview-Deployments nutzt:

1. Scrolle zu **Preview** Sektion
2. Füge die gleichen Secrets hinzu
3. Klicke auf **Save**

### 5. Deployment neu starten

Nach dem Hinzufügen der Secrets:

1. Gehe zu **Deployments**
2. Klicke auf den neuesten Deployment
3. Klicke auf **Retry deployment**

Oder: Push auf GitHub → automatisches Deployment mit neuen Secrets

## Aktuelle Secrets

**Production:**

- `GROQ_API_KEY` → Groq API für Robot Chat (llama-3.3-70b-versatile)
- `RESEND_API_KEY` → Resend API für Contact Form

**Environment Variables (aus wrangler.toml):**

- `MAX_SEARCH_RESULTS` → 10

**Bindings (aus wrangler.toml):**

- `AI` → Cloudflare Workers AI
- `GALLERY_BUCKET` → R2 Bucket `img`

## Secrets testen

Nach dem Deployment:

1. **Contact Form testen:**

   ```
   https://abdulkerimsesli.de/contact/
   ```

   - Formular ausfüllen und absenden
   - E-Mail sollte an `krm19030@gmail.com` gesendet werden

2. **Robot Chat testen:**

   ```
   https://abdulkerimsesli.de/
   ```

   - Robot-Icon klicken
   - Nachricht senden
   - Sollte mit Groq API antworten

3. **AI Search testen:**

   ```
   https://abdulkerimsesli.de/
   ```

   - Cmd+K / Ctrl+K drücken
   - Suche eingeben
   - Sollte Ergebnisse mit AI Summary zeigen

## Troubleshooting

**Problem: "RESEND_API_KEY is missing"**

- Lösung: Secret in Cloudflare Dashboard hinzufügen
- Deployment neu starten

**Problem: "GROQ_API_KEY not configured"**

- Lösung: Secret in Cloudflare Dashboard prüfen
- Deployment neu starten

**Problem: Secrets werden nicht erkannt**

- Lösung: Warte 1-2 Minuten nach dem Hinzufügen
- Deployment neu starten
- Cache leeren (Cloudflare Dashboard → Caching → Purge Everything)

## Wichtig

⚠️ **Secrets niemals in Code committen!**

- Secrets nur im Cloudflare Dashboard setzen
- Nicht in `.env` Dateien committen
- Nicht in `wrangler.toml` eintragen

✅ **Secrets sind verschlüsselt**

- Werden sicher gespeichert
- Nur zur Laufzeit verfügbar
- Nicht in Logs sichtbar
