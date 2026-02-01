# Robot Companion - Verwendung

## Grundlegende Verwendung

### Als Web Component (Empfohlen)

```html
<!-- In HTML einbinden -->
<robot-companion></robot-companion>

<!-- Zugriff via JavaScript -->
<script>
  const robotEl = document.querySelector('robot-companion');
  const robot = robotEl.getRobot();

  // Chat öffnen/schließen
  robot.toggleChat(true);

  // Bubble-Nachricht anzeigen
  robot.showBubble('Hallo! 👋');
</script>
```

## Animationen

### Verfügbare Animationen

```javascript
const robot = document.querySelector('robot-companion').getRobot();

// Begeisterung (für coole Entdeckungen)
await robot.animationModule.playExcitementAnimation();

// Überraschung (für unerwartete Inhalte)
await robot.animationModule.playSurpriseAnimation();

// Tanzen (für Celebrations)
await robot.animationModule.playDanceAnimation();

// Traurig (für Fehler)
await robot.animationModule.playSadAnimation();

// Verwirrt (für unklare Situationen)
await robot.animationModule.playConfusedAnimation();

// Auf Element zeigen
const element = document.querySelector('.my-element');
await robot.animationModule.pointAtElement(element);
```

### Animation-Beispiele

```javascript
// Bei erfolgreichem Form-Submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  // ... submit logic
  await robot.animationModule.playExcitementAnimation();
  robot.showBubble('Erfolgreich gesendet! 🎉');
});

// Bei Fehler
try {
  // ... code
} catch (error) {
  await robot.animationModule.playSadAnimation();
  robot.showBubble('Ups, da ist etwas schief gelaufen 😢');
}

// Auf wichtiges Element hinweisen
const importantButton = document.querySelector('.cta-button');
await robot.animationModule.pointAtElement(importantButton);
robot.showBubble('Klick hier für mehr Infos! 👉');
```

## Scroll-basierte Hinweise

### Automatische Konfiguration

Die Scroll-Hinweise funktionieren automatisch. Du kannst die Selektoren anpassen:

```javascript
// In robot-intelligence.js
getInterestingSelectors() {
  const context = this.robot.getPageContext();

  const selectorsByContext = {
    projects: [
      {
        selector: '.project-card',
        message: '👀 Schau dir dieses Projekt an!',
        animation: 'excitement',
      },
    ],
    // ... weitere Kontexte
  };

  return selectorsByContext[context] || [];
}
```

### Eigene Highlights

```javascript
// Element manuell highlighten
const element = document.querySelector('.special-feature');
robot.intelligenceModule.highlightElement(
  element,
  '✨ Das ist ein besonderes Feature!',
  'excitement',
);
```

## Kontext-basierte Tipps

### Eigene Tipps hinzufügen

```javascript
// In robot-intelligence.js - getContextualTip()
const tips = {
  myCustomContext: [
    '💡 Tipp 1 für meinen Kontext',
    '🎯 Tipp 2 für meinen Kontext',
  ],
};
```

### Tipp-Timing anpassen

```javascript
// In robot-intelligence.js - checkProactiveTips()
const timeOnPage = Date.now() - (this.pageTimeTracking[context] || Date.now());

// Tipps nach 10 Sekunden statt 20
if (timeOnPage < 10000) return;

// Chance auf 50% erhöhen
if (Math.random() > 0.5) return;
```

## Streaming-Antworten

### Automatisch aktiviert

Streaming ist standardmäßig aktiviert für alle AI-Antworten:

```javascript
// Wird automatisch gestreamt
await robot.chatModule.handleUserMessage();
```

### Dev-Mode

Im Dev-Mode (localhost) werden automatisch Mock-Antworten verwendet:

```javascript
// Automatische Erkennung
const isDev = window.location.hostname === 'localhost';

// Mock-Antwort wird gestreamt
if (isDev && response.status === 404) {
  // Verwendet Mock-Antwort mit Streaming
}
```

## Events

### Eigene Events triggern

```javascript
// Bei bestimmten Aktionen
document.addEventListener('myCustomEvent', async () => {
  await robot.animationModule.playExcitementAnimation();
  robot.showBubble('Event ausgelöst! 🎉');
});

// Event auslösen
document.dispatchEvent(new CustomEvent('myCustomEvent'));
```

## Konfiguration

### Animations-Geschwindigkeit anpassen

```javascript
// In robot-animation.js
async playExcitementAnimation() {
  // Schnellere Animation
  await sleep(150); // statt 300
}
```

### Highlight-Chance anpassen

```javascript
// In robot-intelligence.js - checkElementsInViewport()
// 50% Chance statt 30%
if (Math.random() > 0.5) return;
```

### Max. Highlights ändern

```javascript
// In robot-intelligence.js - checkElementsInViewport()
// Max. 5 Highlights statt 3
if (this.elementHighlights.size >= 5) return;
```

## Best Practices

### Performance

```javascript
// Throttling für häufige Events
let lastCheck = 0;
element.addEventListener('scroll', () => {
  const now = Date.now();
  if (now - lastCheck < 500) return;
  lastCheck = now;

  // ... deine Logik
});
```

### Accessibility

```javascript
// ARIA-Labels für Animationen
robot.dom.avatar.setAttribute('aria-label', 'Robot is excited');

// Reduced Motion respektieren
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;
if (!prefersReducedMotion) {
  await robot.animationModule.playExcitementAnimation();
}
```

### Mobile

```javascript
// Touch-Events berücksichtigen
robot.dom.avatar.addEventListener('touchstart', async () => {
  await robot.animationModule.playPokeAnimation();
  robot.toggleChat(true);
});
```

## Debugging

### Console-Logs aktivieren

```javascript
// In gemini-service.js
log.info('Streaming enabled, starting simulation');

// In robot-intelligence.js
console.log('Element highlighted:', element);
```

### Performance-Monitoring

```javascript
// Animations-Performance messen
const start = performance.now();
await robot.animationModule.playExcitementAnimation();
const duration = performance.now() - start;
console.log(`Animation took ${duration}ms`);
```

## Troubleshooting

### Animationen funktionieren nicht

```javascript
// Prüfe ob Robot geladen ist
if (!robot || !robot.animationModule) {
  console.error('Robot animation module not available');
  return;
}
```

### Highlights erscheinen nicht

```javascript
// Prüfe Selektoren
const elements = document.querySelectorAll('.project-card');
console.log('Found elements:', elements.length);

// Prüfe Viewport-Position
const rect = element.getBoundingClientRect();
console.log('Element position:', rect);
```

### Streaming funktioniert nicht

```javascript
// Prüfe Callback
const hasCallback = onChunk && typeof onChunk === 'function';
console.log('Has streaming callback:', hasCallback);
```
