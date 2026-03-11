# Robot Companion - Quick Reference

## Start

```js
import { RobotCompanion } from "./robot-companion.js";

const robot = new RobotCompanion();
robot.init();
```

## Chat

```js
robot.toggleChat(true);
robot.addMessage("Hallo", "bot");
robot.handleAction(ROBOT_ACTIONS.START);
```

## Agent Service

```js
const agentService = await robot.getAgentService();

const response = await agentService.generateResponse("Hallo!", (chunk) => {
  console.log("stream:", chunk);
});
```

## Actions

```js
ROBOT_ACTIONS.START;
ROBOT_ACTIONS.TOGGLE_THEME;
ROBOT_ACTIONS.SEARCH_WEBSITE;
ROBOT_ACTIONS.SCROLL_FOOTER;
ROBOT_ACTIONS.OPEN_MENU;
ROBOT_ACTIONS.CLOSE_MENU;
ROBOT_ACTIONS.OPEN_SEARCH;
ROBOT_ACTIONS.CLOSE_SEARCH;
ROBOT_ACTIONS.SCROLL_TOP;
ROBOT_ACTIONS.COPY_CURRENT_URL;
ROBOT_ACTIONS.SHOW_MEMORIES;
ROBOT_ACTIONS.EDIT_PROFILE;
ROBOT_ACTIONS.SWITCH_PROFILE;
ROBOT_ACTIONS.DISCONNECT_PROFILE;
ROBOT_ACTIONS.CLEAR_CHAT;
```

Bildanalyse startet direkt ueber den Upload-Button im Chat.

## Debug

```js
console.log(robot.stateManager.getState());
console.log(robot.stateManager.signals.isChatOpen.value);
console.log(robot.dom);
```

## Checks

```bash
npx eslint content/components/robot-companion --max-warnings=0
npm run qa
```
