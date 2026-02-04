import { createElement } from 'react';
import htm from 'htm';

const html = htm.bind(createElement);

export const ChatBubble = ({ text, onClose, onClick }) => {
  if (!text) return null;

  return html`
    <div className="robot-bubble visible" onClick=${onClick}>
      <span>${text}</span>
      <div
        className="robot-bubble-close"
        onClick=${(e) => { e.stopPropagation(); onClose(); }}
      >
        &times;
      </div>
    </div>
  `;
};
