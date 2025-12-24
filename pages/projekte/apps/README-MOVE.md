Kurz: So verschiebst du die Apps nach https://github.com/aKs030/Webgame.git

1. Lokales Paket erstellen ./scripts/export_webgame.sh -> erstellt webgame-export-YYYYMMDDHHMMSS.zip

2. Neues Repo klonen (falls noch nicht vorhanden) git clone git@github.com:aKs030/Webgame.git cd Webgame

3. Inhalte kopieren unzip ../iweb/webgame-export-\*.zip -d ./

4. Commit & Push git add . git commit -m "Add mini apps (export from iweb)" git push origin main

Hinweis: Stelle sicher, dass GitHub Pages im Ziel-Repo aktiviert ist (branch: main / docs/ oder Pages settings).
