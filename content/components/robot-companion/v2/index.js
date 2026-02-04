import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { RobotCompanionApp } from './RobotCompanionApp.js';

const init = () => {
  const containerId = 'robot-companion-container';
  if (document.getElementById(containerId)) return;

  const container = document.createElement('div');
  container.id = containerId;
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(createElement(RobotCompanionApp));
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
