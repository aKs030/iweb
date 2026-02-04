import { createElement, useEffect, useRef } from 'react';
import htm from 'htm';
import { useRobotState } from './hooks/useRobotState.js';
import { useRobotAnimation } from './hooks/useRobotAnimation.js';
import { useRobotChat } from './hooks/useRobotChat.js';
import { useRobotIntelligence } from './hooks/useRobotIntelligence.js';
import { useCollisionDetection } from './hooks/useCollisionDetection.js';
import { RobotAvatar } from './components/RobotAvatar.js';
import { ChatWindow } from './components/ChatWindow.js';
import { ChatBubble } from './components/ChatBubble.js';

const html = htm.bind(createElement);

const loadCSS = () => {
  if (!document.querySelector('link[href*="robot-companion.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/content/components/robot-companion/robot-companion.css';
    document.head.appendChild(link);
  }
};

export const RobotCompanionApp = () => {
  const state = useRobotState();
  const animationRefs = useRobotAnimation(state.mood);
  const chat = useRobotChat(state);

  // Activate intelligence (proactivity)
  useRobotIntelligence(state, chat);

  const avatarRef = useRef(null);

  useCollisionDetection(
    avatarRef,
    animationRefs.containerRef,
    state.setBubble,
    animationRefs.triggerKnockback,
    state.isOpen,
  );

  useEffect(() => {
    loadCSS();
    setTimeout(() => {
      if (!state.isOpen && !state.bubbleText) {
        state.setBubble('Hallo! 👋', 5000);
      }
    }, 2000);
  }, []);

  return html`
    <div className="robot-float-wrapper" ref=${animationRefs.containerRef}>
      <${ChatWindow}
        isOpen=${state.isOpen}
        onClose=${() => state.setIsOpen(false)}
        messages=${state.messages}
        isTyping=${state.isTyping}
        streamingText=${state.streamingText}
        onSendMessage=${chat.processUserMessage}
        onOptionClick=${chat.handleOptionClick}
      />

      ${!state.isOpen &&
      html`
        <${ChatBubble}
          text=${state.bubbleText}
          onClose=${() => state.setBubble('')}
          onClick=${() => state.setIsOpen(true)}
        />
      `}

      <${RobotAvatar}
        animationRefs=${animationRefs}
        onClick=${() => state.setIsOpen(!state.isOpen)}
        mood=${state.mood}
      />
    </div>
  `;
};
