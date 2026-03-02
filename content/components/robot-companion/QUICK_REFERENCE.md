# Robot Companion - Quick Reference

## 🚀 Schnellstart

```javascript
import { RobotCompanion } from './robot-companion.js';

const robot = new RobotCompanion();
await robot.initialize();
```

---

## 📋 Event Constants

```javascript
import { ROBOT_EVENTS, ROBOT_ACTIONS } from './constants/events.js';

// Events abonnieren
document.addEventListener(ROBOT_EVENTS.CHAT_OPENED, (e) => {
  console.log('Chat opened:', e.detail);
});

document.addEventListener(ROBOT_EVENTS.STATE_CHANGED, (e) => {
  console.log('State changed:', e.detail.changes);
});
```

### Verfügbare Events

```javascript
ROBOT_EVENTS.INITIALIZED; // Robot initialisiert
ROBOT_EVENTS.DESTROYED; // Robot zerstört
ROBOT_EVENTS.CHAT_OPENED; // Chat geöffnet
ROBOT_EVENTS.CHAT_CLOSED; // Chat geschlossen
ROBOT_EVENTS.STATE_CHANGED; // State geändert
ROBOT_EVENTS.MOOD_CHANGED; // Mood geändert
ROBOT_EVENTS.HERO_TYPING_END; // Hero Typing beendet
```

### Verfügbare Actions

```javascript
ROBOT_ACTIONS.START; // Start Dialog
ROBOT_ACTIONS.SUMMARIZE_PAGE; // Seite zusammenfassen
ROBOT_ACTIONS.SCROLL_FOOTER; // Zum Footer scrollen
ROBOT_ACTIONS.RANDOM_PROJECT; // Zufälliges Projekt
ROBOT_ACTIONS.PLAY_TIC_TAC_TOE; // Tic-Tac-Toe spielen
ROBOT_ACTIONS.PLAY_TRIVIA; // Trivia Quiz
ROBOT_ACTIONS.PLAY_GUESS_NUMBER; // Zahlenraten
ROBOT_ACTIONS.SHOW_MOOD; // Mood anzeigen
```

---

## 📊 State Management

```javascript
// State abrufen
const state = robot.stateManager.getState();
console.log(state.isChatOpen);
console.log(state.mood);
console.log(state.analytics);

// State ändern
robot.stateManager.setState({
  mood: 'energetic',
  isChatOpen: true,
});

// State Changes abonnieren
const unsubscribe = robot.stateManager.subscribe(
  ROBOT_EVENTS.MOOD_CHANGED,
  (data) => {
    console.log('Mood:', data.mood);
  },
);

// Später: Unsubscribe
unsubscribe();
```

### State Struktur

```javascript
{
  isInitialized: false,
  isChatOpen: false,
  isTyping: false,
  mood: 'normal',
  currentContext: 'default',
  analytics: {
    sessions: 0,
    interactions: 0,
    sectionsVisited: [],
    lastVisit: null
  },
  position: { x: 0, y: 0, direction: 1 }
}
```

---

## 🏗️ DOM Builder

```javascript
const builder = robot.domBuilder;

// Message erstellen
const msg = builder.createMessage('Hello', 'user');

// Button erstellen
const btn = builder.createOptionButton('Click me', () => {
  console.log('Clicked!');
});

// Typing Indicator
const typing = builder.createTypingIndicator();
```

---

## 🎮 Chat Interaktion

```javascript
// Chat öffnen/schließen
robot.toggleChat(true); // Öffnen
robot.toggleChat(false); // Schließen

// Nachricht hinzufügen
robot.addMessage('Hello!', 'bot');
robot.addMessage('Hi!', 'user');

// Optionen anzeigen
robot.addOptions([
  { label: 'Option 1', action: 'start' },
  { label: 'Option 2', url: '/page' },
]);

// Action ausführen
robot.handleAction(ROBOT_ACTIONS.START);
```

---

## 🎨 Texte anpassen

```javascript
import { robotCompanionTexts } from './robot-companion-texts.js';

// Vor der Initialisierung anpassen
robotCompanionTexts.knowledgeBase.start.text = [
  'Eigene Begrüßung 1',
  'Eigene Begrüßung 2',
];

robotCompanionTexts.moodGreetings.energetic = ['Volle Power!', "Let's go!"];
```

---

## 🔒 Sicherheit

### XSS-sicher

```javascript
// ✅ Sicher: textContent
const msg = document.createElement('div');
msg.textContent = userInput;

// ✅ Sicher: DOM Builder
const msg = builder.createMessage(userInput, 'user');

// ❌ Unsicher: innerHTML
element.innerHTML = userInput; // NICHT VERWENDEN!
```

---

## 🧪 Testing

### Browser Test

```bash
# test.html im Browser öffnen
open content/components/robot-companion/test.html
```

### Manuelle Tests

```javascript
// State testen
console.log(robot.stateManager.getState());

// Events testen
document.addEventListener(ROBOT_EVENTS.STATE_CHANGED, console.log);
robot.stateManager.setState({ mood: 'energetic' });

// DOM testen
const container = robot.domBuilder.createContainer();
document.body.appendChild(container);
```

---

## 🐛 Debugging

```javascript
// Logger aktivieren
import { createLogger } from '/content/core/logger.js';
const log = createLogger('MyComponent');
log.debug('Debug message');
log.info('Info message');
log.warn('Warning message');
log.error('Error message');

// State inspizieren
console.log('Current State:', robot.stateManager.getState());

// DOM inspizieren
console.log('DOM Cache:', robot.dom);

// Analytics inspizieren
console.log('Analytics:', robot.analytics);
```

---

## ⚡ Performance

```javascript
// Lazy Loading
const robot = new RobotCompanion();
// Robot lädt erst beim ersten Scroll

// Cleanup
robot.destroy(); // Alle Listener & Timer aufräumen
```

---

## ♿ Accessibility

```javascript
// ARIA Labels sind automatisch gesetzt
// Keyboard Navigation funktioniert out-of-the-box

// Focus Management
globalThis?.a11y?.trapFocus(robot.dom.window);
globalThis?.a11y?.releaseFocus();
```

---

## 🔧 Konfiguration

### AI Agent Service

```javascript
// Verwendung (SSE, Tools & Memory)
const agentService = await robot.getAgentService();
const response = await agentService.generateResponse('Hallo!', (chunk) => {
  console.log('Streaming:', chunk);
});
```

Slash Commands im Chat:

```text
/help
/clear
/export
```

### CSS Anpassung

```css
:root {
  --robot-primary: #40e0d0;
  --robot-bg: #1e293b;
  --robot-text: #ffffff;
}
```

---

## 📱 Mobile Support

```javascript
// Automatische Keyboard-Anpassung
// Automatische Viewport-Anpassung
// Touch-optimierte Interaktionen

// Manuell testen
robot.setupMobileViewportHandler();
```

---

## 🎯 Häufige Aufgaben

### Chat programmatisch öffnen

```javascript
robot.toggleChat(true);
robot.addMessage('Willkommen!', 'bot');
```

### Mood ändern

```javascript
robot.stateManager.setState({ mood: 'energetic' });
```

### Interaktion tracken

```javascript
robot.trackInteraction();
```

### Section Visit tracken

```javascript
robot.trackSectionVisit('hero');
```

### Easter Egg freischalten

```javascript
robot.unlockEasterEgg('my-egg', 'Glückwunsch! 🎉');
```

---

## 🚨 Troubleshooting

### Chat öffnet nicht

```javascript
// Prüfen ob initialisiert
console.log(robot.dom.container);

// Manuell initialisieren
await robot.initialize();
```

### Events feuern nicht

```javascript
// Prüfen ob Event-Name korrekt
console.log(ROBOT_EVENTS.CHAT_OPENED);

// Event manuell testen
document.dispatchEvent(new CustomEvent(ROBOT_EVENTS.CHAT_OPENED));
```

### State ändert sich nicht

```javascript
// Prüfen ob StateManager existiert
console.log(robot.stateManager);

// State manuell setzen
robot.stateManager.setState({ mood: 'test' });
console.log(robot.stateManager.getState().mood);
```

---

## 📚 Weitere Ressourcen

- [README.md](./README.md) - Vollständige Dokumentation
- [CHANGELOG.md](./CHANGELOG.md) - Versionshistorie

---

## 💡 Best Practices

1. **Immer Constants verwenden** statt Magic Strings
2. **State über StateManager** ändern
3. **DOM Builder** für Element-Erstellung nutzen
4. **Events abonnieren** für Reaktivität
5. **Cleanup** nicht vergessen (destroy())

---

## ⚠️ Don'ts

```javascript
// ❌ Magic Strings
document.addEventListener('hero:typingEnd', handler);

// ❌ Direkter State-Zugriff
robot.analytics.interactions++;

// ❌ innerHTML mit User Input
element.innerHTML = userInput;

// ❌ Keine Cleanup
// Immer robot.destroy() aufrufen!
```

---

**Version**: 2.0.0  
**Status**: Production Ready 🚀  
**Last Updated**: 2026-02-04
