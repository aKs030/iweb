

# Projekt - Info  



---

## 📂 Dateistruktur  

Wenn du diese Vorlage weiter aktualisieren möchtest, speichere deinen Code bitte in separaten Dateien (z. B. `custom.css` und `custom.js`) und vermeide Änderungen an den folgenden Dateien:  

- **CSS:**  
  - `css/frame.css` – CSS für den Hauptrahmen der Website  
  - `css/controls.css` – CSS für Steuerelemente, die kein JavaScript benötigen  
  - `css/widgets.css` – CSS für Widgets, die JavaScript erfordern  

- **JavaScript:**  
  - `js/widgets.js` – JavaScript für Widgets  
  - `js/util.js` – JavaScript für allgemeine Utility-Funktionen  
  - `js/menu.js` – JavaScript zum Laden der Menüleiste  
  - `js/footer.js` – JavaScript zum Laden der Fußzeile  

---

## 🔗 Menüleiste und Fußzeile  

Ab Version 3.0 wurde die Menüleiste in `menu.html` ausgelagert, um die Verwaltung zu erleichtern. Ebenso wurde ab Version 3.37 die Fußzeile in `footer.html` verschoben.  

### **Einbindung in Vorlagenseiten:**  

```html
<script src="js/menu.js"></script>
<script src="js/footer.js"></script>

<div class="menu-container"></div>
<div class="footer-container"></div>

	•	Das Skript menu.js lädt menu.html in die menu-container.
	•	Das Skript footer.js lädt footer.html in die footer-container.

✅ Unterstützte Plattformen

Diese Vorlage wurde erfolgreich getestet auf:
	•	macOS 12.4:
	•	Chrome 103
	•	Safari 15.5
	•	Firefox 103
	•	Edge 103
	•	Android 12:
	•	Chrome 103
	•	iOS 15.5:
	•	Chrome 103
	•	Safari 15.5
	•	Firefox 102

🚧 Bekannte Probleme und Bugs
	•	Mobile Safari:
Das Menü oben schließt sich nicht, nachdem es geöffnet wurde. Ursache: Das Menü-Icon behält nach einem Touch-Event den Fokus, und der Schließmechanismus basiert auf dem Verlust des Fokusereignisses.
	•	Safari:
Bei der Auswahl von Fotos in einer Umfrage werden diese nach dem Anklicken eines Kontrollkästchens seltsam dargestellt. Ursache: Unbekannt.

💡 Zukünftige Funktionen

Geplante Verbesserungen:
	•	Ein Diashow-Block zum Anzeigen von Bildern oder Videos.

🌟 Richtlinien für Open-Source-Beiträge

Beiträge zur Fehlerbehebung und Funktionserweiterung sind willkommen!

❌ Was vermieden werden sollte:
	•	Änderungen am bestehenden Design ohne vorherige Absprache.
	•	Pull-Requests (PRs), die nicht mit Fehlerbehebungen oder Funktionserweiterungen zusammenhängen.
	•	Änderungen am Text der README-Datei (z. B. Korrekturen von Grammatikfehlern).
	•	Unnötige oder nicht zusammenhängende Änderungen (z. B. für spezifische Anwendungen).

✅ Was erwünscht ist:
	•	Bug-Fixes: Beschreibe das Problem und die Lösung im Pull-Request.
	•	Neue Funktionen: Erkläre deine Designentscheidungen und stelle sicher, dass dein Beitrag mit dem Stil der Vorlage übereinstimmt.

Pull-Requests ohne Erklärung werden wahrscheinlich abgelehnt und als “wontfix” markiert.

🛠️ Beitrag leisten
	1.	Forke dieses Repository.
	2.	Erstelle einen neuen Branch:

git checkout -b feature/dein-feature


	3.	Committe deine Änderungen:

git commit -m "Feature hinzugefügt"


	4.	Push die Änderungen:

git push origin feature/dein-feature


	5.	Erstelle einen Pull-Request.

📧 Kontakt

Wenn du Fragen hast oder über neue Features diskutieren möchtest, nutze GitHub-Issues oder kontaktiere mich per E-Mail.

Vielen Dank für deinen Beitrag!