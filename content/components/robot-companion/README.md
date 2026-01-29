# Robot Companion Component

Modern AI robot companion with Web Component architecture.

## Architecture

### Core Files

- **robot-companion.js** - Main RobotCompanion class (business logic)
- **robot-companion-web-component.js** - Web Component wrapper
- **robot-companion-texts.js** - Localized text content
- **robot-companion.css** - Component styles

### Modules

- **modules/robot-animation.js** - Animation controller
- **modules/robot-chat.js** - Chat interface logic
- **modules/robot-collision.js** - Collision detection
- **modules/robot-intelligence.js** - AI intelligence layer

### Services

- **gemini-service.js** - Google Gemini AI integration
- **robot-games.js** - Mini-games functionality

## Usage

### As Web Component (Recommended)

```javascript
import './robot-companion-web-component.js';

// Use in HTML
<robot-companion></robot-companion>;

// Access programmatically
const robotEl = document.querySelector('robot-companion');
const robot = robotEl.getRobot();
robot.toggleChat(true);
```

### As Class Instance (Legacy)

```javascript
import { RobotCompanion } from './robot-companion.js';

const robot = new RobotCompanion();
await robot.initialize();
```

## Type Safety

All components use JSDoc with `@ts-check` for type safety:

```javascript
/**
 * @param {import('/content/core/types.js').PageContext} context
 */
trackSectionVisit(context) { ... }
```

## Events

- `robot:loaded` - Fired when robot is initialized
- `robot:error` - Fired on initialization error

## API

### Methods

- `toggleChat(force?: boolean)` - Toggle chat window
- `showBubble(text: string)` - Show bubble message
- `getStats()` - Get analytics stats

### Properties

- `mood: RobotMood` - Current mood state
- `analytics: RobotAnalytics` - Analytics data
- `easterEggFound: Set<string>` - Found easter eggs

## Development

### Adding New Features

1. Add types to `content/core/types.js`
2. Implement logic in appropriate module
3. Add JSDoc comments with type annotations
4. Update this README

### Testing

```bash
npm run lint:check  # Check for errors
npm run format      # Format code
```
