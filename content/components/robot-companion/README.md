# Robot Companion

Ein interaktiver KI-Roboter-Begleiter für die Website mit Chat-Funktionalität, Animationen und Spielen.

## ✨ Features

- 🤖 **Interaktiver Chat** - KI-gestützte Konversation mit AI Service (Groq)
- 🎨 **Animationen** - Flüssige SVG-Animationen und Bewegungen
- 🎮 **Mini-Games** - Tic-Tac-Toe, Trivia Quiz, Zahlenraten
- 📊 **Analytics** - Session-Tracking und Interaktions-Statistiken
- 🌙 **Mood System** - Zeitbasierte Stimmungen und Grüße
- 🎯 **Context-Aware** - Reagiert auf verschiedene Seitenbereiche
- ♿ **Accessibility** - ARIA-Labels und Screen-Reader Support
- 🔒 **Security** - XSS-sicher durch DOM Builder

## 🏗️ Architektur

### Moderne Architektur (Post-Migration)

```
robot-companion/
├── constants/
│   └── events.js              # Event & Action Constants
├── state/
│   └── RobotStateManager.js   # Zentrales State Management
├── dom/
│   └── RobotDOMBuilder.js     # XSS-sichere DOM-Erstellung
├── modules/
│   ├── robot-animation.js     # Animationen
│   ├── robot-chat.js          # Chat-Logik
│   ├── robot-collision.js     # Kollisionserkennung
│   ├── robot-intelligence.js  # KI-Integration
│   ├── robot-persona.js       # Persönlichkeit
│   └── markdown-renderer.js   # Markdown-Parsing
├── robot-companion.js         # Hauptkomponente
├── robot-companion.css        # Styling
├── robot-games.js             # Spiele-Logik
├── ai-service.js              # AI API Service
└── index.js                   # Exports
```

## 🚀 Verwendung

### Basic Setup

```javascript
import { RobotCompanion } from './robot-companion.js';

// Automatische Initialisierung beim DOMContentLoaded
// Oder manuell:
const robot = new RobotCompanion();
await robot.initialize();
```

### Mit Web Component

```html
<robot-companion></robot-companion>

<script type="module">
  import './robot-companion-web-component.js';
</script>
```

### Event Handling

```javascript
import { ROBOT_EVENTS } from './constants/events.js';

// State Changes abonnieren
document.addEventListener(ROBOT_EVENTS.CHAT_OPENED, (event) => {
  console.log('Chat opened:', event.detail);
});

document.addEventListener(ROBOT_EVENTS.STATE_CHANGED, (event) => {
  console.log('State changed:', event.detail.changes);
});
```

### State Management

```javascript
// State abrufen
const state = robot.stateManager.getState();
console.log(state.isChatOpen);
console.log(state.mood);
console.log(state.analytics);

// State ändern
robot.stateManager.setState({ mood: 'energetic' });

// State Changes abonnieren
const unsubscribe = robot.stateManager.subscribe(
  ROBOT_EVENTS.MOOD_CHANGED,
  (data) => {
    console.log('Mood changed to:', data.mood);
  },
);
```

## 🔧 Konfiguration

### Texte anpassen

```javascript
import { robotCompanionTexts } from './robot-companion-texts.js';

// Texte können vor der Initialisierung angepasst werden
robotCompanionTexts.knowledgeBase.start.text = [
  'Eigene Begrüßung 1',
  'Eigene Begrüßung 2',
];
```

### AI Service (Groq)

```javascript
// .env Datei
VITE_GROQ_API_KEY = your_api_key_here;
```

## 📦 Dependencies

- **AI Service** - KI-Konversation (Groq)
- **Markdown Renderer** - Markdown-Parsing
- **Logger** - Logging-System
- **Intersection Observer** - Scroll-Detection

## 🔒 Sicherheit

### XSS-Schutz

- ✅ Alle DOM-Elemente werden programmatisch erstellt
- ✅ User Input verwendet immer `textContent`
- ✅ Markdown wird vor innerHTML sanitized
- ✅ Keine String-Konkatenation in HTML

### Best Practices

```javascript
// ❌ Unsicher
element.innerHTML = `<div>${userInput}</div>`;

// ✅ Sicher
const div = document.createElement('div');
div.textContent = userInput;
element.appendChild(div);
```

## 📊 State Management

Der Robot Companion verwendet einen zentralen State Manager:

```javascript
{
  isInitialized: false,
  isChatOpen: false,
  isTyping: false,
  isPatrolling: false,
  isAnimating: false,
  mood: 'normal',
  currentContext: 'default',
  analytics: {
    sessions: 0,
    interactions: 0,
    sectionsVisited: [],
    lastVisit: null,
  },
  position: {
    x: 0,
    y: 0,
    direction: 1,
  }
}
```

## 🎯 Events

### Verfügbare Events

```javascript
ROBOT_EVENTS = {
  // Lifecycle
  INITIALIZED: 'robot:initialized',
  DESTROYED: 'robot:destroyed',

  // Chat
  CHAT_OPENED: 'robot:chat:opened',
  CHAT_CLOSED: 'robot:chat:closed',
  CHAT_MESSAGE_SENT: 'robot:chat:message:sent',
  CHAT_MESSAGE_RECEIVED: 'robot:chat:message:received',

  // Animation
  ANIMATION_START: 'robot:animation:start',
  ANIMATION_END: 'robot:animation:end',

  // State
  STATE_CHANGED: 'robot:state:changed',
  MOOD_CHANGED: 'robot:mood:changed',

  // External
  HERO_TYPING_END: 'hero:typingEnd',

  // Games
  GAME_STARTED: 'robot:game:started',
  GAME_ENDED: 'robot:game:ended',
};
```

### Verfügbare Actions

```javascript
ROBOT_ACTIONS = {
  START: 'start',
  SUMMARIZE_PAGE: 'summarizePage',
  SCROLL_FOOTER: 'scrollFooter',
  RANDOM_PROJECT: 'randomProject',
  PLAY_TIC_TAC_TOE: 'playTicTacToe',
  PLAY_TRIVIA: 'playTrivia',
  PLAY_GUESS_NUMBER: 'playGuessNumber',
  SHOW_MOOD: 'showMood',
};
```

## 🎨 Styling

Das Styling ist in `robot-companion.css` definiert und verwendet CSS Custom Properties für einfache Anpassung:

```css
:root {
  --robot-primary: #40e0d0;
  --robot-bg: #1e293b;
  --robot-text: #ffffff;
}
```

## 📝 Migration History

Das Projekt wurde durch eine umfassende Refactoring-Migration modernisiert:

### Phase 1: Magic Strings → Constants ✅

- Alle Event- und Action-Strings durch typsichere Konstanten ersetzt
- Zentrale Definition in `constants/events.js`

### Phase 2: Scattered State → State Manager ✅

- Verstreuter State in zentralen `RobotStateManager` migriert
- Observer Pattern für State-Änderungen
- Automatische Persistenz in localStorage

### Phase 3: innerHTML → DOM Builder ✅

- Alle unsicheren `innerHTML` Verwendungen eliminiert
- XSS-sichere DOM-Erstellung durch `RobotDOMBuilder`
- Programmatische Element-Erstellung

## 🤝 Contributing

1. Fork das Repository
2. Erstelle einen Feature Branch
3. Committe deine Änderungen
4. Push zum Branch
5. Erstelle einen Pull Request

## 📄 License

Siehe LICENSE Datei im Root-Verzeichnis.

## 🔗 Links

- [Quick Reference](./QUICK_REFERENCE.md) - Schnellreferenz
- [Changelog](./CHANGELOG.md) - Versionshistorie

## 💡 Tipps

### Performance

- Der Robot lädt lazy beim ersten Scroll
- SVG-Animationen nutzen CSS transforms
- State wird in localStorage gecached

### Accessibility

- Alle interaktiven Elemente haben ARIA-Labels
- Chat-Fenster ist keyboard-navigierbar
- Screen-Reader Support durch ARIA live regions

### Mobile

- Responsive Design für alle Bildschirmgrößen
- Touch-optimierte Interaktionen
- Keyboard-Anpassung für mobile Geräte

---

**Version**: 2.0.0 (Post-Migration)  
**Status**: Production Ready 🚀
