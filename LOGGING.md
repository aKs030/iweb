# Logging & Debug System

## Features
- Level: error(0), warn(1), info(2), debug(3)
- Globales Level via `window.LOG_LEVEL` oder URL `?log=debug` / `?debug=true`
- Produktions-Silencing: Standard-Level `error` auf Produktiv-Host (Heuristik)
- Ring-Buffer (Standard 200 Einträge) mit Zugriff & Flush
- CustomEvent `logEvent` für jedes Log (Detail: `{ ts, level, namespace, args }`)
- Automatisches Sammeln von `error` & `unhandledrejection`
- Overlay-Konsole (mobil-freundlich) bei `DEBUG=true`

## Nutzung
```js
// Logger erstellen
import { createLogger, getBufferedLogs, flushLogs } from '/content/webentwicklung/utils/logger.js';
const log = createLogger('feature-x');
log.info('Init');
log.warn('Warnung', { foo: 1 });
log.error('Fehler', new Error('Boom'));

// Globales Level ändern
__logger.setLevel('warn'); // oder window.LOG_LEVEL='warn'

// Buffer-Größe anpassen (optional)
// import { setLogBufferSize } from '/content/webentwicklung/utils/logger.js';
// setLogBufferSize(500);

// Buffer inspizieren
const entries = getBufferedLogs();

// Flush an externes Ziel senden
flushLogs({ transport: data => fetch('/log', { method:'POST', body: JSON.stringify(data) }) });
```

### Globaler Fallback-Logger
`__logger` ist ein globaler Logger (Namespace `global`) und steht immer bereit. Er bietet zusätzlich `buffer`-Hilfen:

```js
__logger.info('App gestartet');
// Zugriff auf Buffer
__logger.buffer.get();      // Array der Einträge
__logger.buffer.flush();    // Liefert Einträge zurück
```

### Numerische Level setzen
```js
window.LOG_LEVEL = 3; // 0=error,1=warn,2=info,3=debug
```

### Auto-Flush bei Errors an Server (nur letzte 20 Fehler)
```js
import { onAutoFlush } from '/content/webentwicklung/utils/logger.js';
onAutoFlush(entries => {
	const lastErrors = entries.filter(e => e.level === 'error').slice(-20);
	if (lastErrors.length) navigator.sendBeacon('/log-errors', JSON.stringify(lastErrors));
});
```

### Gefilterter manueller Flush (ohne info)
```js
import { flushLogs } from '/content/webentwicklung/utils/logger.js';
flushLogs({
	transport: data => fetch('/log', {
		method: 'POST',
		headers: { 'Content-Type':'application/json' },
		body: JSON.stringify(data.filter(e => e.level !== 'info'))
	})
});
```

## URL Parameter
- `?debug=true` setzt `DEBUG` (und Level debug falls kein `log` definiert)
- `?log=warn` überschreibt Level (auch numerisch möglich `?log=2`)

## Overlay
Bei aktivem `DEBUG=true` wird `debug-overlay.js` dynamisch geladen und zeigt ein beweg-/skalierbares Fenster mit Live-Logs, Level-Auswahl, Clear & Flush.

## Erweiterung
- `setLogBufferSize(n)` für Buffer-Größe
- `onAutoFlush(handler)` um Auto-Flush bei error einzuhängen

## Produktion
Heuristik: nicht localhost & Host enthält keine dev/test/staging → Produktion → Default-Level error.

## Ereignis-API
Jedes Log feuert `window` Event `logEvent` mit `detail = { ts, level, namespace, args }`.

```js
window.addEventListener('logEvent', ev => {
	// z.B. eigene UI aktualisieren
	// console.log(ev.detail);
});
```

