# Shadow Menu Pilot Checklist

## Aktivierung

1. Seite mit `?menuShadow=1` öffnen (z. B. `/` oder `/about/?menuShadow=1`).
2. In DevTools prüfen, ob `<site-menu>` ein `#shadow-root` hat.
3. Ohne Query (`?menuShadow=1` entfernt) prüfen, dass Light DOM weiter funktioniert.

## Desktop Checks

1. Menü öffnen/schließen per Toggle.
2. Search-Mode öffnen, schließen, erneut öffnen.
3. Klick außerhalb schließt Menü korrekt.
4. `Esc` schließt erst Suche, dann Menü.
5. Aktiver Menüpunkt (`aria-current`) entspricht URL.
6. Theme Toggle und Language Toggle reagieren korrekt.

## Mobile Checks

1. Viewport < `900px` testen.
2. Fokusfalle mit `Tab` / `Shift+Tab` bei geöffnetem Menü prüfen.
3. Menüeintrag anklicken: Menü klappt sauber zu.
4. Kontakt-Trigger (`#footer`) öffnet Footer und kein doppeltes Menüverhalten.

## Accessibility Checks

1. Toggle hat korrektes `aria-expanded`.
2. Search-Trigger `aria-label` wechselt zwischen öffnen/schließen.
3. Such-Combobox hat erwartete `aria-*` Attribute.
4. Keyboard-Navigation in Search (`ArrowUp/Down`, `Enter`, `Esc`) funktioniert.

## Regression Checks

1. Mit aktiviertem Shadow-DOM funktioniert `search:opened` / `search:closed` weiterhin.
2. Header-Layout in Search-Mode bleibt auf allen Seiten stabil.
3. Kein visuelles CSS-Leck aus globalen Styles in das Menü.
4. Keine JS-Fehler im Browser-Console-Log.

## Exit-Kriterien

1. Alle Checks in Desktop + Mobile + Accessibility grün.
2. Keine Regressions in Light-DOM-Modus.
3. Danach kann `data-shadow-dom="true"` dauerhaft auf `<site-menu>` gesetzt werden.
