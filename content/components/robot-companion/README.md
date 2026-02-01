# Robot Companion Component

Modern AI robot companion with Web Component architecture.

## New Features (v2.2.0)

### 🎯 Scroll-Position-Based Hints

- **Smart Element Detection**: Automatically detects interesting elements in viewport
- **Context-Aware Highlighting**: Different elements highlighted based on page section
- **Visual Feedback**: Glowing border animation on highlighted elements
- **Intelligent Timing**: Only highlights elements near viewport center
- **No Spam**: Maximum 3 highlights, each element highlighted only once per session

### 🎭 Extended Animations

- **Excitement**: Jumping with particle burst (for cool discoveries)
- **Surprise**: Jump back with wide eyes (for unexpected content)
- **Point**: Points at specific elements with body rotation
- **Dance**: Celebration animation with multiple moves
- **Sad**: Head down animation (for errors or sad moments)
- **Confused**: Head tilt with thinking bubble

### 🎯 Streaming AI Responses (v2.1.0)

- **Typewriter Effect**: AI responses now stream in word-by-word for a more natural feel
- **Visual Cursor**: Animated cursor during streaming shows the robot is "typing"
- **Smooth Experience**: Variable delays create natural reading rhythm

### 🤖 Proactive Context-Based Tips (v2.1.0)

- **Smart Context Detection**: Robot recognizes which page section you're viewing
- **Time-Based Tips**: Shows helpful tips after 20+ seconds on a page
- **Context-Specific Advice**: Different tips for projects, gallery, hero, about, and footer sections
- **Advanced Tips**: After 60+ seconds, shows more detailed technical tips
- **No Repetition**: Each tip is shown only once per session

### 🔍 Frustration Detection (v2.1.0)

- **Scroll Pattern Analysis**: Detects rapid back-and-forth scrolling
- **Proactive Help**: Offers assistance when user seems to be searching for something
- **Smart Timing**: Only triggers after 5+ direction changes to avoid false positives

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

### Animation Methods (New in v2.2.0)

```javascript
const robot = document.querySelector('robot-companion').getRobot();

// Play different animations
await robot.animationModule.playExcitementAnimation();
await robot.animationModule.playSurpriseAnimation();
await robot.animationModule.playDanceAnimation();
await robot.animationModule.playSadAnimation();
await robot.animationModule.playConfusedAnimation();

// Point at a specific element
const element = document.querySelector('.my-element');
await robot.animationModule.pointAtElement(element);
```

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
