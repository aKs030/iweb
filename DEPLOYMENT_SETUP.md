# Cloudflare Pages Deployment Setup

Damit die automatische Preview-URL Generierung funktioniert, müssen folgende **Secrets** im GitHub Repository hinterlegt werden:

## Benötigte Secrets

1.  **`CLOUDFLARE_API_TOKEN`**:
    - Erstelle ein API Token in deinem Cloudflare Dashboard unter "My Profile" -> "API Tokens".
    - Verwende die Vorlage: **"Edit Cloudflare Workers"**.
    - Stelle sicher, dass die Berechtigungen `Account.Cloudflare Pages:Edit` enthalten sind.
    - **Wichtig**: Prüfe, ob das Token gültig ist, indem du diesen Befehl im Terminal ausführst:
      ```bash
      curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
           -H "Authorization: Bearer <DEIN_TOKEN>" \
           -H "Content-Type: application/json"
      ```

2.  **`CLOUDFLARE_ACCOUNT_ID`**:
    - Diese findest du im Cloudflare Dashboard auf der Übersichtsseite deiner Domain (rechts unten) oder in der URL (z.B. `dash.cloudflare.com/<ACCOUNT_ID>/...`).

## Einrichtung in GitHub

1.  Gehe zu deinem Repository auf GitHub.
2.  Navigiere zu **Settings** > **Secrets and variables** > **Actions**.
3.  Klicke auf **New repository secret**.
4.  Füge `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` mit den entsprechenden Werten hinzu.

## Troubleshooting

### Deployment fehlgeschlagen?

Wenn der GitHub Action Workflow fehlschlägt mit `Invalid access token [code: 9109]`:

- Überprüfe, ob das Token korrekt kopiert wurde (keine Leerzeichen).
- Überprüfe, ob das Token abgelaufen ist oder widerrufen wurde.
- Stelle sicher, dass du ein **API Token** verwendest, keinen Global API Key.
- Stelle sicher, dass das Token Zugriff auf den Account hat, in dem das `1web` Projekt liegt.
