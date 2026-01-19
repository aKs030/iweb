/**
 * AI Chat Search Component
 * Replaces the static spotlight search with a Gemini-powered AI Chat.
 * Connected to: https://throbbing-mode-6fe1-nlweb.httpsgithubcomaks030website.workers.dev
 * @author Abdulkerim Sesli
 * @version 3.0.0
 */

/* exported initSearch, openSearch, closeSearch, toggleSearch */
/* eslint-disable import/no-unused-modules */
import { createLogger } from '/content/utils/shared-utilities.js';

const _log = createLogger('ai-search');

const API_URL = 'https://throbbing-mode-6fe1-nlweb.httpsgithubcomaks030website.workers.dev/api/gemini';

class ChatComponent {
  constructor() {
    this.overlay = null;
    this.container = null;
    this.input = null;
    this.sendBtn = null;
    this.messagesContainer = null;
    this.isOpen = false;
    this.messages = [];
    this.isLoading = false;

    this.init();
  }

  init() {
    this.createChatOverlay();
    this.attachEventListeners();
    this.loadStyles();
    // Add initial greeting
    this.addMessage({
      role: 'assistant',
      text: 'Hallo! Ich bin dein AI-Assistent. Stelle mir eine Frage über Abdulkerims Projekte, Fähigkeiten oder Blog-Artikel.',
    });
    _log.info('AI Chat component initialized');
  }

  loadStyles() {
    // Check if style is already loaded
    if (document.querySelector('link[href*="/content/components/search/search.css"]')) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/content/components/search/search.css';
    link.dataset.injectedBy = 'search-js';
    document.head.appendChild(link);
  }

  createChatOverlay() {
    // Remove existing overlays
    const existing = document.getElementById('search-overlay');
    if (existing) existing.remove();

    // Create new Overlay
    const overlay = document.createElement('div');
    overlay.id = 'search-overlay';
    overlay.className = 'search-overlay chat-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'AI Chat');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="chat-modal" role="document">
        <div class="chat-header">
          <div class="chat-title">
            <span class="chat-icon">✨</span>
            <span>AI Assistant</span>
          </div>
          <button class="chat-close" aria-label="Schließen" title="ESC">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div class="chat-messages" id="chat-messages">
          <!-- Messages will be injected here -->
        </div>

        <div class="chat-input-area">
          <form class="chat-form">
            <input
              type="text"
              class="chat-input"
              placeholder="Frage etwas..."
              aria-label="Deine Nachricht"
              autocomplete="off"
            >
            <button type="submit" class="chat-send-btn" aria-label="Senden" disabled>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
          <div class="chat-disclaimer">AI kann Fehler machen. Überprüfe wichtige Infos.</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.container = overlay.querySelector('.chat-modal');
    this.messagesContainer = overlay.querySelector('#chat-messages');
    this.input = overlay.querySelector('.chat-input');
    this.sendBtn = overlay.querySelector('.chat-send-btn');
    this.form = overlay.querySelector('.chat-form');

    // Event Listeners for UI
    overlay.querySelector('.chat-close').addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
  }

  attachEventListeners() {
    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Input handling
    this.input.addEventListener('input', (e) => {
      this.sendBtn.disabled = !e.target.value.trim();
    });

    // Form Submit
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUserSubmit();
    });
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Scroll to bottom
    this.scrollToBottom();

    // Focus input
    requestAnimationFrame(() => {
      setTimeout(() => this.input.focus(), 100);
    });

    _log.info('Chat opened');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
    _log.info('Chat closed');
  }

  addMessage(msg) {
    this.messages.push(msg);
    this.renderMessage(msg);
  }

  renderMessage(msg) {
    const msgEl = document.createElement('div');
    msgEl.className = `chat-message message-${msg.role}`;

    // Simple formatted text renderer
    const formattedText = this.formatText(msg.text);

    let sourcesHtml = '';
    if (msg.sources && msg.sources.length > 0) {
        sourcesHtml = `<div class="message-sources">
            <span class="sources-label">Quellen:</span>
            ${msg.sources.map((s, i) => `<a href="${s.url}" target="_blank" class="source-link">[${i+1}] ${s.title}</a>`).join(' ')}
        </div>`;
    }

    msgEl.innerHTML = `
      <div class="message-content">
        ${formattedText}
        ${sourcesHtml}
      </div>
    `;

    this.messagesContainer.appendChild(msgEl);
    this.scrollToBottom();
  }

  // Simple formatter for bold and links
  formatText(text) {
    if (!text) return '';

    // Escape HTML
    let safe = text.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // Bold: **text** -> <strong>text</strong>
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Links: [Title](url) -> <a href="url">Title</a>
    safe = safe.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Newlines to <br>
    safe = safe.replace(/\n/g, '<br>');

    return safe;
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    });
  }

  async handleUserSubmit() {
    const text = this.input.value.trim();
    if (!text || this.isLoading) return;

    // Reset input
    this.input.value = '';
    this.sendBtn.disabled = true;

    // Add User Message
    this.addMessage({ role: 'user', text });

    // Set Loading State
    this.isLoading = true;
    this.showTypingIndicator();

    try {
      const response = await this.fetchAIResponse(text);
      this.removeTypingIndicator();

      if (response.error) {
        this.addMessage({ role: 'assistant', text: 'Entschuldigung, es gab einen Fehler bei der Anfrage.' });
      } else {
        this.addMessage({
            role: 'assistant',
            text: response.text,
            sources: response.sources
        });
      }

    } catch (err) {
      _log.error('AI Request failed', err);
      this.removeTypingIndicator();
      this.addMessage({ role: 'assistant', text: 'Entschuldigung, ich konnte den Server nicht erreichen.' });
    } finally {
      this.isLoading = false;
      // Re-focus input for next message
      if (window.innerWidth > 768) {
        this.input.focus();
      }
    }
  }

  showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'chat-message message-assistant typing';
    indicator.innerHTML = `
        <div class="message-content">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
    `;
    this.messagesContainer.appendChild(indicator);
    this.scrollToBottom();
  }

  removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
  }

  async fetchAIResponse(prompt) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        options: { useSearch: true } // Enable RAG
      })
    });

    if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
    }
    return await res.json();
  }
}

// Global Instance
let chatInstance = null;

export function initSearch() {
  if (chatInstance) return chatInstance;
  chatInstance = new ChatComponent();

  // Expose global helpers for legacy/menu compatibility
  window.openSearch = () => chatInstance.open();
  window.closeSearch = () => chatInstance.close();
  window.toggleSearch = () => chatInstance.toggle();

  return chatInstance;
}

export function openSearch() {
  if (chatInstance) chatInstance.open();
  else initSearch().open();
}

export function closeSearch() {
  if (chatInstance) chatInstance.close();
}

export function toggleSearch() {
  if (chatInstance) chatInstance.toggle();
  else initSearch().open();
}

// Auto-Init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch);
} else {
  initSearch();
}
