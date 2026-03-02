# Robot Companion - Quick Reference

## Start

```js
import { RobotCompanion } from './robot-companion.js';

const robot = new RobotCompanion();
await robot.initialize();
```

## Chat

```js
robot.toggleChat(true);
robot.addMessage('Hallo', 'bot');
robot.handleAction(ROBOT_ACTIONS.START);
```

## Agent Service

```js
const agentService = await robot.getAgentService();

const response = await agentService.generateResponse('Hallo!', (chunk) => {
  console.log('stream:', chunk);
});
```

## Actions

```js
ROBOT_ACTIONS.START;
ROBOT_ACTIONS.SUMMARIZE_PAGE;
ROBOT_ACTIONS.UPLOAD_IMAGE;
ROBOT_ACTIONS.TOGGLE_THEME;
ROBOT_ACTIONS.SEARCH_WEBSITE;
ROBOT_ACTIONS.SCROLL_FOOTER;
ROBOT_ACTIONS.OPEN_MENU;
ROBOT_ACTIONS.CLOSE_MENU;
ROBOT_ACTIONS.OPEN_SEARCH;
ROBOT_ACTIONS.CLOSE_SEARCH;
ROBOT_ACTIONS.SCROLL_TOP;
ROBOT_ACTIONS.COPY_CURRENT_URL;
ROBOT_ACTIONS.CLEAR_CHAT;
ROBOT_ACTIONS.EXPORT_CHAT;
```

## Events

```js
document.addEventListener(ROBOT_EVENTS.CHAT_OPENED, (e) => {
  console.log(e.detail);
});
```

## Debug

```js
console.log(robot.stateManager.getState());
console.log(robot.dom);
```

## Checks

```bash
npx eslint content/components/robot-companion --max-warnings=0
npm run lint:types
```
