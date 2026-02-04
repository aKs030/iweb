import { createElement, useEffect, useRef, useState } from 'react';
import htm from 'htm';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@11.1.1/lib/marked.esm.js';
import DOMPurify from 'dompurify';

const html = htm.bind(createElement);

marked.setOptions({
  breaks: true,
  gfm: true,
});

export const ChatWindow = ({
  isOpen,
  onClose,
  messages,
  isTyping,
  streamingText,
  onSendMessage,
  onOptionClick,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages, isTyping, streamingText]);

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  if (!isOpen) return null;

  return html`
    <div className="robot-chat-window open" id="robot-chat-window">
      <div className="chat-header u-inline-center">
        <div className="chat-title">
          <span className="chat-status-dot"></span>Cyber Assistant
        </div>
        <button className="chat-close-btn" onClick=${onClose}>&times;</button>
      </div>

      <div className="chat-messages" id="robot-messages">
        ${messages.map((msg, idx) => {
          const isBot = msg.type === 'bot';
          const rawHtml = DOMPurify.sanitize(marked.parse(msg.text));

          return html`
            <div
              key=${idx}
              className="chat-message ${isBot ? 'bot' : 'user'} fade-in"
            >
              <div
                className="message-content"
                dangerouslySetInnerHTML=${{ __html: rawHtml }}
              ></div>
              ${msg.options &&
              msg.options.length > 0 &&
              html`
                <div className="chat-options">
                  ${msg.options.map(
                    (opt, optIdx) => html`
                      <button
                        key=${optIdx}
                        className="chat-option-btn"
                        onClick=${() => onOptionClick(opt)}
                      >
                        ${opt.label || opt.text}
                      </button>
                    `,
                  )}
                </div>
              `}
            </div>
          `;
        })}
        ${streamingText &&
        html`
          <div className="chat-message bot streaming fade-in">
            <div
              className="message-content"
              dangerouslySetInnerHTML=${{
                __html: DOMPurify.sanitize(marked.parse(streamingText)),
              }}
            ></div>
            <span className="streaming-cursor"></span>
          </div>
        `}
        ${isTyping &&
        !streamingText &&
        html`
          <div className="chat-message bot fade-in">
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        `}
        <div ref=${messagesEndRef}></div>
      </div>

      <div className="chat-input-area" id="robot-input-area">
        <input
          ref=${inputRef}
          type="text"
          value=${inputValue}
          onInput=${(e) => setInputValue(e.target.value)}
          onKeyDown=${handleKeyDown}
          placeholder="Frag mich etwas..."
          autocomplete="off"
        />
        <button onClick=${handleSubmit}>➤</button>
      </div>
    </div>
  `;
};
