# Preview Images

This directory contains SVG preview images for project apps displayed on the `/projekte` page.

## Format

- All images are 800x600px SVG format
- Images use gradients and modern design
- Each image visually represents the app's functionality

## Naming Convention

Preview images are named after the app's `name` property from `apps-config.json`:

- `{app-name}.svg` - App-specific preview
- `default.svg` - Fallback image when app-specific preview doesn't exist

## Available Previews

- ✅ `default.svg` - Fallback with code icon
- ✅ `calculator.svg` - Calculator with display and buttons
- ✅ `color-changer.svg` - Color palette circles
- ✅ `memory-game.svg` - Memory cards grid
- ✅ `paint-app.svg` - Canvas with drawing tools
- ✅ `password-generator.svg` - Lock icon with password display
- ✅ `pong-game.svg` - Pong game with paddles and ball
- ✅ `quiz-app.svg` - Quiz question with multiple choice
- ✅ `schere-stein-papier.svg` - Rock paper scissors game with hand gestures
- ✅ `snake.svg` - Snake game with grid and apple
- ✅ `snake-game.svg` - Snake game alternative version
- ✅ `tic-tac-toe.svg` - Tic-tac-toe grid with X and O
- ✅ `timer-app.svg` - Timer/stopwatch interface with controls
- ✅ `todo-liste.svg` - Todo list with checkboxes
- ✅ `typing-speed-test.svg` - Typing test interface with WPM stats
- ✅ `weather-app.svg` - Weather display with forecast
- ✅ `zahlen-raten.svg` - Number guessing game interface

## Usage

Images are loaded in `pages/projekte/app.js` using:

```javascript
const previewUrl = `${window.location.origin}/content/assets/img/previews/${project.name}.svg`;
const fallbackUrl = `${window.location.origin}/content/assets/img/previews/default.svg`;
```

## Complete Coverage

All 16 apps from `apps-config.json` now have custom preview images!
