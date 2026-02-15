# Cloudflare Pages Deployment Setup

Damit die automatische Preview-URL Generierung funktioniert, müssen folgende **Secrets** im GitHub Repository hinterlegt werden:

## Benötigte Secrets

1.  **`CLOUDFLARE_API_TOKEN`**:
    - Erstelle ein API Token in deinem Cloudflare Dashboard unter "My Profile" -> "API Tokens".
    - Vorlage: **"Edit Cloudflare Workers"** (diese enthält meist die notwendigen Berechtigungen für Pages & Workers).
    - Stelle sicher, dass die Berechtigungen `Account.Cloudflare Pages:Edit` enthalten sind.

2.  **`CLOUDFLARE_ACCOUNT_ID`**:
    - Diese findest du im Cloudflare Dashboard auf der Übersichtsseite deiner Domain (rechts unten) oder in der URL, wenn du eingeloggt bist (z.B. `dash.cloudflare.com/<ACCOUNT_ID>/...`).

## Einrichtung in GitHub

1.  Gehe zu deinem Repository auf GitHub.
2.  Navigiere zu **Settings** > **Secrets and variables** > **Actions**.
3.  Klicke auf **New repository secret**.
4.  Füge `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` mit den entsprechenden Werten hinzu.

Sobald diese Secrets gesetzt sind, wird jeder neue Pull Request oder Push auf einen Branch (außer `main`) automatisch eine Preview-URL erzeugen und (bei PRs) als Kommentar posten.
