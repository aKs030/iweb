import { createLogger } from "../../../core/logger.js";
import { MarkdownRenderer } from "./markdown-renderer.js";
import { ROBOT_ACTIONS } from "../constants/events.js";
import { uiStore } from "../../../core/ui-store.js";
import { withViewTransition } from "../../../core/view-transitions.js";
import { ChatHistoryStore } from "./chat-history-store.js";
import { VIEW_TRANSITION_TYPES } from "../../../core/view-transition-types.js";

const log = createLogger("RobotChat");
const DEFAULT_INPUT_PLACEHOLDER = "Frag mich etwas...";
const ACTION_PROMPTS = {
  [ROBOT_ACTIONS.START]:
    "Begruesse mich kurz als Jules und frage in 1-2 Saetzen, wobei du helfen kannst.",
  [ROBOT_ACTIONS.SCROLL_FOOTER]:
    "Scrolle bitte zum Footer und bestaetige kurz auf Deutsch.",
  [ROBOT_ACTIONS.TOGGLE_THEME]:
    "Wechsle bitte das Theme und bestaetige kurz auf Deutsch.",
  [ROBOT_ACTIONS.SEARCH_WEBSITE]:
    "Hilf mir bei der Website-Suche und frage nach dem Suchbegriff.",
  [ROBOT_ACTIONS.OPEN_MENU]: "Oeffne bitte das Menue und bestaetige kurz.",
  [ROBOT_ACTIONS.CLOSE_MENU]: "Schliesse bitte das Menue und bestaetige kurz.",
  [ROBOT_ACTIONS.OPEN_SEARCH]: "Oeffne bitte die Suche und bestaetige kurz.",
  [ROBOT_ACTIONS.CLOSE_SEARCH]:
    "Schliesse bitte die Suche und bestaetige kurz.",
  [ROBOT_ACTIONS.SCROLL_TOP]:
    "Scrolle bitte ganz nach oben und bestaetige kurz.",
  [ROBOT_ACTIONS.COPY_CURRENT_URL]:
    "Kopiere den aktuellen Seitenlink und bestaetige kurz.",
  [ROBOT_ACTIONS.CLEAR_CHAT]:
    "Loesche den Chatverlauf und bestaetige kurz auf Deutsch.",
};

const RECOVERY_CONFIRM_PATTERN =
  /^(?:ja|ja bitte|klar|ok(?:ay)?|bitte|profil\s+laden|lade(?:\s+es)?|verbinde(?:\s+mich)?|nutze(?:\s+das)?\s+profil)$/i;
const RECOVERY_OTHER_PROFILE_PATTERN =
  /^(?:anderes?\s+profil|nicht\s+dieses\s+profil|neu(?:es)?\s+profil|anderer\s+nutzer|jemand\s+anders)$/i;
const RECOVERY_DISCONNECT_PATTERN =
  /^(?:gerät\s+trennen|trennen|abmelden|vergessen|profil\s+trennen)$/i;

function getRecoveryFollowUpAction(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return "";
  if (RECOVERY_CONFIRM_PATTERN.test(normalized)) return "confirm";
  if (RECOVERY_OTHER_PROFILE_PATTERN.test(normalized)) return "different";
  if (RECOVERY_DISCONNECT_PATTERN.test(normalized)) return "disconnect";
  return "";
}

function formatRecoveredProfileSummary(memories = []) {
  if (!Array.isArray(memories) || memories.length === 0) {
    return "Profil geladen. Dazu sind noch keine Erinnerungen gespeichert.";
  }

  const visibleEntries = memories.slice(0, 6);
  const lines = visibleEntries.map((entry) => {
    const key = String(entry?.key || "memory").trim() || "memory";
    const value = String(entry?.value || "").trim() || "(leer)";
    return `- **${key}**: ${value}`;
  });
  const remaining = memories.length - visibleEntries.length;

  return [
    "Ich habe dein Profil geladen. Das weiß ich bereits über dich:",
    ...lines,
    remaining > 0 ? `- ... und ${remaining} weitere Erinnerungen.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export class RobotChat {
  constructor(robot) {
    this.robot = robot;

    /** @type {File|null} Pending image for upload */
    this.pendingImage = null;

    // Runtime chat state
    this.isOpen = false;
    this.isTyping = false;
    this.isResponding = false;
    this.lastGreetedContext = null;
    this.historyStore = new ChatHistoryStore();
    this._responseRequestId = 0;
    this.profileState = {
      userId: "",
      name: "",
      status: "disconnected",
      label: "Kein aktives Profil",
      recovery: null,
    };
    this.pendingRecoveryPrompt = "";

    // Session-only in-memory history
    this.history = this.historyStore.load();
  }

  destroy() {
    this.cancelActiveResponse("destroyed");
    this.clearImagePreview();
    this.clearBubbleSequence();
  }

  createResponseRequestId() {
    this._responseRequestId += 1;
    return this._responseRequestId;
  }

  isActiveResponseRequest(requestId) {
    return requestId === this._responseRequestId;
  }

  cancelActiveResponse(reason = "cancelled") {
    this.createResponseRequestId();
    this.isResponding = false;
    if (this.isTyping) {
      this.removeTyping();
    } else {
      this.robot.stateManager.setState({ isTyping: false });
    }
    this.robot.animationModule.stopThinking();
    this.robot.animationModule.stopSpeaking();
    this.syncComposerState();
    void this._cancelAgentRequest(reason);
  }

  setProfileState(nextState = {}) {
    this.profileState = {
      ...this.profileState,
      ...nextState,
      recovery:
        nextState.recovery === undefined
          ? this.profileState.recovery
          : nextState.recovery,
    };
    this.syncProfileStatus();
    return this.profileState;
  }

  syncProfileStatus() {
    const statusEl = this.robot.dom.profileStatus;
    if (!statusEl) return;

    const label =
      String(this.profileState?.label || "").trim() || "Kein aktives Profil";
    const status = String(this.profileState?.status || "disconnected").trim();

    statusEl.textContent = label;
    statusEl.className = `chat-profile-status chat-profile-status--${status}`;

    const hasBoundProfile =
      Boolean(this.profileState?.userId) &&
      !["disconnected", "recovery-pending", "conflict"].includes(status);

    if (this.robot.dom.memoriesBtn) {
      this.robot.dom.memoriesBtn.disabled = !hasBoundProfile;
      this.robot.dom.memoriesBtn.setAttribute(
        "aria-disabled",
        String(!hasBoundProfile),
      );
    }
    if (this.robot.dom.editMemoryBtn) {
      this.robot.dom.editMemoryBtn.disabled = !hasBoundProfile;
      this.robot.dom.editMemoryBtn.setAttribute(
        "aria-disabled",
        String(!hasBoundProfile),
      );
    }
  }

  async syncProfileStateFromService() {
    try {
      const agentService =
        this.robot.peekAgentService?.() || (await this.robot.getAgentService());
      const profileState = agentService.getProfileState?.();
      if (profileState) this.setProfileState(profileState);
    } catch {
      /* ignore */
    }
  }

  toggleChat(forceState) {
    const newState =
      forceState ?? !this.robot.stateManager.signals.isChatOpen.value;

    // DOM-Erstellung & Event-Binding AUSSERHALB der View Transition
    // (VT darf nur DOM-Mutationen wrappen, nicht DOM-Erstellung)
    if (newState) {
      this.robot.ensureChatWindowCreated();
    }

    // Visuelle State-Änderungen in View Transition wrappen.
    // CSS-Transitions nur deaktivieren wenn VT tatsächlich unterstützt wird,
    // damit Browser ohne VT die CSS-Fallback-Animation behalten.
    const win = this.robot.dom.window;
    const vtSupported = typeof document.startViewTransition === "function";
    if (vtSupported && win) win.classList.add("vt-animating");

    withViewTransition(() => this._applyVisualChatState(newState), {
      types: [
        newState
          ? VIEW_TRANSITION_TYPES.CHAT_OPEN
          : VIEW_TRANSITION_TYPES.CHAT_CLOSE,
      ],
    }).finally(() => {
      if (win) win.classList.remove("vt-animating");
    });
  }

  /**
   * Apply the visual chat state (class toggles, state updates, focus management).
   * Separated so it can be wrapped in a View Transition.
   * @param {boolean} newState
   */
  _applyVisualChatState(newState) {
    if (newState) {
      this.robot.dom.window.classList.add("open");
      this.robot.dom.container.classList.add("robot-chat--open");
      this.isOpen = true;

      // Update state manager (single source of truth)
      this.robot.stateManager.setState({ isChatOpen: true });
      uiStore.setState({ robotChatOpen: true });

      this.clearBubbleSequence();
      this.hideBubble();
      this.robot.animationModule.stopIdleEyeMovement();
      this.robot.animationModule.stopBlinkLoop();
      void this.syncProfileStateFromService();
      const ctx = this.robot.getPageContext();
      this.lastGreetedContext = ctx;

      if (this.robot.dom.messages.children.length === 0) {
        if (this.history.length > 0) {
          this.restoreMessages();
        } else {
          this.handleAction(ROBOT_ACTIONS.START);
        }
      }

      // Focus Trap
      globalThis?.a11y?.trapFocus(this.robot.dom.window);
      this.syncComposerState();
    } else {
      this.robot.dom.window.classList.remove("open");
      this.robot.dom.container.classList.remove("robot-chat--open");
      this.isOpen = false;

      // Update state manager (single source of truth)
      this.robot.stateManager.setState({ isChatOpen: false });
      uiStore.setState({ robotChatOpen: false });

      this.robot.animationModule.startIdleEyeMovement();
      this.robot.animationModule.startBlinkLoop();

      // Release Focus
      globalThis?.a11y?.releaseFocus();
      this.syncComposerState();
    }
  }

  handleAvatarClick() {
    if (this.isOpen) {
      this.toggleChat(false);
      return;
    }

    (async () => {
      await this.robot.animationModule.playPokeAnimation();
      this.toggleChat(true);
    })();
  }

  async handleUserMessage() {
    const text = this.robot.dom.input.value.trim();
    const hasPendingImage = !!this.pendingImage;

    if (!text && !hasPendingImage) {
      this.syncComposerState();
      return;
    }
    if (this.isTyping || this.isResponding) return;

    const recoveryAction =
      !hasPendingImage && this.profileState?.recovery?.status
        ? getRecoveryFollowUpAction(text)
        : "";
    if (recoveryAction) {
      this.addMessage(text, "user");
      this.robot.dom.input.value = "";
      if (recoveryAction === "confirm") {
        await this.confirmRecoveredProfile(
          this.profileState.recovery,
          this.pendingRecoveryPrompt,
        );
        return;
      }
      if (recoveryAction === "different") {
        await this.useDifferentProfile();
        return;
      }
      if (recoveryAction === "disconnect") {
        await this.disconnectCurrentDeviceProfile();
        return;
      }
    }

    // Show user message (with image thumbnail if present)
    if (hasPendingImage) {
      this.addImageMessage(text, this.pendingImage);
    } else {
      this.addMessage(text, "user");
    }
    this.robot.dom.input.value = "";
    this.isResponding = true;
    this.syncComposerState();
    const requestId = this.createResponseRequestId();

    this.showTyping();
    this.robot.animationModule.startThinking();
    this.robot.trackInteraction();

    try {
      this.robot.animationModule.startSpeaking();
      const response = await this._streamAgentResponse(
        async (agentService, onChunk) => {
          if (hasPendingImage) {
            const imageFile = this.pendingImage;
            this.clearImagePreview();
            return agentService.analyzeImage(imageFile, text, onChunk);
          }
          return agentService.generateResponse(text, onChunk);
        },
        { requestId },
      );

      if (response?.aborted || !this.isActiveResponseRequest(requestId)) return;
      this.applyAgentResponseMeta(response, { originalPrompt: text });

      if (response.toolResults?.length) {
        this.showToolCallResults(response.toolResults);
      }
    } catch (e) {
      if (!this.isActiveResponseRequest(requestId)) return;
      log.error("generateResponse failed", e);
      this.removeTyping();
      this.robot.animationModule.stopThinking();
      this.robot.animationModule.stopSpeaking();
      this.addMessage(
        "Fehler bei der Verbindung. Bitte erneut versuchen.",
        "bot",
      );
    } finally {
      if (this.isActiveResponseRequest(requestId)) {
        this.isResponding = false;
        this.syncComposerState();
      }
    }
  }

  async _streamAgentResponse(runRequest, { requestId } = {}) {
    const agentService = await this.robot.getAgentService();
    let streamingMessageEl = null;
    let typingRemoved = false;

    let response;
    try {
      response = await runRequest(agentService, (chunk) => {
        if (!this.isActiveResponseRequest(requestId)) return;
        if (!typingRemoved) {
          this.removeTyping();
          typingRemoved = true;
        }
        if (!streamingMessageEl) {
          streamingMessageEl = this.createStreamingMessage();
        }
        this.updateStreamingMessage(streamingMessageEl, chunk);
      });
    } catch (error) {
      if (streamingMessageEl) {
        streamingMessageEl.remove();
      }
      if (!this.isActiveResponseRequest(requestId)) {
        return { aborted: true, text: "" };
      }
      throw error;
    }

    if (!this.isActiveResponseRequest(requestId) || response?.aborted) {
      if (streamingMessageEl) {
        streamingMessageEl.remove();
      }
      if (!typingRemoved) this.removeTyping();
      this.robot.animationModule.stopThinking();
      this.robot.animationModule.stopSpeaking();
      return { aborted: true, text: "" };
    }

    this.robot.animationModule.stopThinking();

    if (response?.hasMemory && streamingMessageEl) {
      const badge = this.robot.domBuilder.createMemoryIndicator();
      streamingMessageEl.appendChild(badge);
    }

    if (!streamingMessageEl) {
      if (!typingRemoved) this.removeTyping();
      this.robot.animationModule.stopSpeaking();
      const text =
        typeof response === "string"
          ? response
          : response?.text || "Entschuldigung, keine Antwort erhalten.";
      this.addMessage(text, "bot");
      return response;
    }

    // If token streaming was partial, force-sync with final server message text.
    if (streamingMessageEl && response?.text) {
      this.updateStreamingMessage(streamingMessageEl, response.text);
    }

    this.finalizeStreamingMessage(streamingMessageEl);
    return response;
  }

  applyAgentResponseMeta(response, { originalPrompt = "" } = {}) {
    if (response?.profile) {
      this.setProfileState(response.profile);
    } else {
      void this.syncProfileStateFromService();
    }

    const recovery = response?.recovery || this.profileState.recovery || null;
    if (!recovery?.status) {
      this.pendingRecoveryPrompt = "";
      this.setProfileState({ recovery: null });
      this.removeProfileCards("recovery");
      return;
    }

    this.pendingRecoveryPrompt = originalPrompt || this.pendingRecoveryPrompt;
    if (recovery.status === "needs_confirmation") {
      this.renderRecoveryCard(recovery, originalPrompt);
      return;
    }

    if (recovery.status === "conflict") {
      this.renderRecoveryConflictCard(recovery);
    }
  }

  removeProfileCards(kind = "") {
    const selector = kind
      ? `.chat-profile-card[data-card-kind="${kind}"]`
      : ".chat-profile-card";
    this.robot.dom.messages
      ?.querySelectorAll(selector)
      ?.forEach((node) => node.remove());
  }

  createProfileCard({
    kind = "recovery",
    title = "",
    text = "",
    actions = [],
  }) {
    const card = document.createElement("div");
    card.className = "chat-profile-card";
    card.dataset.cardKind = kind;

    const titleEl = document.createElement("div");
    titleEl.className = "chat-profile-card__title";
    titleEl.textContent = title;

    const textEl = document.createElement("div");
    textEl.className = "chat-profile-card__text";
    textEl.textContent = text;

    const actionsEl = document.createElement("div");
    actionsEl.className = "chat-profile-card__actions";

    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chat-profile-card__btn";
      button.textContent = action.label;
      button.addEventListener("click", action.onClick);
      actionsEl.appendChild(button);
    }

    card.append(titleEl, textEl, actionsEl);
    return card;
  }

  appendProfileCard(card) {
    if (!card || !this.robot.dom.messages) return;
    this.robot.dom.messages.appendChild(card);
    this.scrollToBottom();
  }

  renderRecoveryCard(recovery, originalPrompt = "") {
    this.removeProfileCards("recovery");
    const card = this.createProfileCard({
      kind: "recovery",
      title: `Profil gefunden: ${recovery.name || "Unbekannt"}`,
      text: "Ich habe ein bestehendes Profil erkannt. Du kannst es jetzt laden oder bewusst mit einem anderen Profil weitermachen.",
      actions: [
        {
          label: "Profil laden",
          onClick: () => {
            void this.confirmRecoveredProfile(recovery, originalPrompt);
          },
        },
        {
          label: "Anderes Profil",
          onClick: () => {
            void this.useDifferentProfile();
          },
        },
        {
          label: "Gerät trennen",
          onClick: () => {
            void this.disconnectCurrentDeviceProfile();
          },
        },
      ],
    });
    this.appendProfileCard(card);
  }

  renderRecoveryConflictCard(recovery) {
    this.removeProfileCards("recovery");
    const card = this.createProfileCard({
      kind: "recovery",
      title: `Mehrere Profile für ${recovery.name || "diesen Namen"}`,
      text: "Dieser Name ist nicht eindeutig. Nutze dieses Gerät getrennt oder wechsle bewusst auf ein anderes Profil.",
      actions: [
        {
          label: "Anderes Profil",
          onClick: () => {
            void this.useDifferentProfile();
          },
        },
        {
          label: "Gerät trennen",
          onClick: () => {
            void this.disconnectCurrentDeviceProfile();
          },
        },
      ],
    });
    this.appendProfileCard(card);
  }

  /**
   * Show tool call execution results in chat
   * @param {Array<{name: string, success: boolean, message: string}>} toolResults
   */
  showToolCallResults(toolResults) {
    if (!this.robot.dom.messages) return;

    withViewTransition(
      () => {
        for (const result of toolResults) {
          const indicator = this.robot.domBuilder.createToolCallIndicator(
            result.name,
            result.message,
          );
          this.robot.dom.messages.appendChild(indicator);
        }
        this.scrollToBottom();
      },
      { types: [VIEW_TRANSITION_TYPES.CHAT_TOOL_RESULT] },
    );
  }

  /**
   * Add a user message with image thumbnail
   * @param {string} text
   * @param {File} imageFile
   */
  addImageMessage(text, imageFile) {
    const msg = document.createElement("div");
    msg.className = "message user";
    const timestamp = Date.now();

    if (text) {
      const textEl = document.createElement("div");
      textEl.textContent = text;
      msg.appendChild(textEl);
    }

    // Add image thumbnail
    const img = document.createElement("img");
    img.className = "user-image";
    img.alt = imageFile.name || "Hochgeladenes Bild";
    img.src = URL.createObjectURL(imageFile);

    // Clean up object URL after load
    img.onload = () => URL.revokeObjectURL(img.src);

    msg.appendChild(img);
    msg.appendChild(
      this.robot.domBuilder.createMessageMeta(timestamp, {
        sender: "Du",
      }),
    );
    this.robot.dom.messages.appendChild(msg);
    this.scrollToBottom();

    this.history = this.historyStore.append(this.history, {
      role: "user",
      text: text
        ? `[Bild: ${imageFile.name}] ${text}`
        : `[Bild: ${imageFile.name}]`,
      timestamp,
    });
  }

  /**
   * Handle image upload from file input
   * @param {File} file
   */
  handleImageUpload(file) {
    if (!file) return;

    // Remove existing preview
    this.clearImagePreview();

    this.pendingImage = file;

    // Show preview
    const src = URL.createObjectURL(file);
    const preview = this.robot.domBuilder.createImagePreview(src, file.name);

    // Insert before input area
    const inputArea =
      this.robot.dom.inputArea || document.getElementById("robot-input-area");
    if (inputArea && inputArea.parentNode) {
      inputArea.parentNode.insertBefore(preview, inputArea);
    }

    // Setup remove handler
    const removeBtn = preview.querySelector(".chat-preview-remove");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => this.clearImagePreview());
    }

    // Update placeholder
    if (this.robot.dom.input) {
      this.robot.dom.input.placeholder =
        "Beschreibe das Bild oder sende es direkt...";
      this.robot.dom.input.focus();
    }
    this.syncComposerState();
  }

  /**
   * Clear image preview and pending image
   */
  clearImagePreview() {
    this.pendingImage = null;

    const preview = document.getElementById("robot-image-preview");
    if (preview) {
      const img = preview.querySelector("img");
      if (img?.src?.startsWith("blob:")) {
        URL.revokeObjectURL(img.src);
      }
      preview.remove();
    }

    if (this.robot.dom.input) {
      this.robot.dom.input.placeholder = DEFAULT_INPUT_PLACEHOLDER;
    }
    this.syncComposerState();
  }

  createStreamingMessage() {
    const msg = document.createElement("div");
    msg.className = "message bot streaming";
    msg.dataset.timestamp = String(Date.now());

    const textSpan = document.createElement("span");
    textSpan.className = "streaming-text";

    const cursor = document.createElement("span");
    cursor.className = "streaming-cursor";

    msg.append(textSpan, cursor);
    this.robot.dom.messages.appendChild(msg);
    this.scrollToBottom();
    return msg;
  }

  updateStreamingMessage(messageEl, text) {
    const textSpan = messageEl.querySelector(".streaming-text");
    if (textSpan) {
      textSpan.innerHTML = MarkdownRenderer.parse(text);
      this.scrollToBottom();
    }
  }

  finalizeStreamingMessage(messageEl) {
    const cursor = messageEl.querySelector(".streaming-cursor");
    if (cursor) cursor.remove();
    messageEl.classList.remove("streaming");
    this.robot.animationModule.stopSpeaking();

    const textSpan = messageEl.querySelector(".streaming-text");
    const text = textSpan?.innerText || textSpan?.textContent || "";

    const timestamp =
      Number.parseInt(messageEl.dataset.timestamp || "", 10) || Date.now();
    messageEl.appendChild(
      this.robot.domBuilder.createMessageMeta(timestamp, {
        sender: "Jules",
      }),
    );

    this.history = this.historyStore.append(this.history, {
      role: "model",
      text,
      timestamp,
    });
  }

  showBubble(text) {
    if (this.robot.disableLocalBubbleTexts) return;
    if (this.isOpen) return;
    if (!this.robot.dom.bubble || !this.robot.dom.bubbleText) return;
    this.robot.dom.bubbleText.textContent = String(text || "").trim();
    this.robot.dom.bubble.classList.add("visible");
  }

  hideBubble() {
    if (this.robot.dom.bubble)
      this.robot.dom.bubble.classList.remove("visible");
  }

  showTyping() {
    if (this.isTyping) return;
    this.isTyping = true;

    // Update state manager
    this.robot.stateManager.setState({ isTyping: true });

    withViewTransition(
      () => {
        // Use DOM Builder for XSS-safe creation
        const typingDiv = this.robot.domBuilder.createTypingIndicator();
        this.robot.dom.messages.appendChild(typingDiv);
        this.scrollToBottom();
        this.syncComposerState();
      },
      { types: [VIEW_TRANSITION_TYPES.CHAT_TYPING_SHOW] },
    );
  }

  removeTyping() {
    const typingDiv = document.getElementById("robot-typing");
    this.isTyping = false;

    // Update state manager
    this.robot.stateManager.setState({ isTyping: false });

    withViewTransition(
      () => {
        if (typingDiv) typingDiv.remove();
        this.syncComposerState();
      },
      { types: [VIEW_TRANSITION_TYPES.CHAT_TYPING_HIDE] },
    );
  }

  renderMessage(
    text,
    type = "bot",
    skipParsing = false,
    timestamp = Date.now(),
  ) {
    const renderFn = () => {
      const msg = document.createElement("div");
      msg.className = `message ${type}`;

      if (type === "user") {
        // User messages are always plain text (XSS-safe)
        msg.textContent = String(text || "");
      } else {
        if (skipParsing) {
          // Already sanitized HTML (from streaming or other sources)
          msg.innerHTML = String(text || "");
        } else {
          // Parse markdown (MarkdownRenderer sanitizes output)
          msg.innerHTML = MarkdownRenderer.parse(String(text || ""));
        }
      }

      msg.appendChild(
        this.robot.domBuilder.createMessageMeta(timestamp, {
          sender: type === "user" ? "Du" : "Jules",
        }),
      );

      this.robot.dom.messages.appendChild(msg);
      this.scrollToBottom();
    };

    if (this.robot.dom.messages.offsetParent !== null) {
      withViewTransition(renderFn, {
        types: [VIEW_TRANSITION_TYPES.CHAT_MESSAGE_ADD],
      });
    } else {
      renderFn();
    }
  }

  addMessage(text, type = "bot", skipParsing = false) {
    const timestamp = Date.now();
    this.renderMessage(text, type, skipParsing, timestamp);

    this.history = this.historyStore.append(this.history, {
      role: type === "user" ? "user" : "model",
      text: String(text || ""),
      timestamp,
    });
  }

  restoreMessages() {
    this.history.forEach((item) => {
      const type = item.role === "user" ? "user" : "bot";
      this.renderMessage(item.text, type, false, item.timestamp);
    });
  }

  clearHistory() {
    if (this.isResponding || this.isTyping) {
      this.cancelActiveResponse("history-cleared");
    }
    this.resetConversationView();
    this.handleAction(ROBOT_ACTIONS.START);
  }

  resetConversationView() {
    this.history = [];
    this.historyStore.clear();
    this.clearImagePreview();
    this.removeProfileCards();
    this.pendingRecoveryPrompt = "";

    withViewTransition(
      () => {
        if (this.robot.dom.messages) {
          while (this.robot.dom.messages.firstChild) {
            this.robot.dom.messages.removeChild(
              this.robot.dom.messages.firstChild,
            );
          }
        }
        this.syncComposerState();
      },
      { types: [VIEW_TRANSITION_TYPES.CHAT_CLEAR] },
    );

    void this._clearAgentHistory();
  }

  formatCloudflareMemoriesMessage(memories = [], retentionDays = 0) {
    if (!Array.isArray(memories) || memories.length === 0) {
      return "Aktuell sind keine Erinnerungen gespeichert.";
    }

    const source = memories;

    const lines = source.map((entry) => {
      const key = String(entry?.key || "memory");
      const value = String(entry?.value || "").trim() || "(leer)";
      const category = String(entry?.category || "note").trim() || "note";
      const priority = Number.parseInt(String(entry?.priority || ""), 10);
      const priorityText = Number.isFinite(priority)
        ? `Prioritaet ${priority}`
        : "Prioritaet n/a";
      const timestamp = Number(entry?.timestamp || 0);
      const tsText =
        Number.isFinite(timestamp) && timestamp > 0
          ? new Date(timestamp).toLocaleString("de-DE")
          : "unbekannt";
      return `- **${key}** (${category}, ${priorityText}): ${value} _(Zeit: ${tsText})_`;
    });

    const retentionInfo =
      Number.isFinite(Number(retentionDays)) && Number(retentionDays) > 0
        ? `\n\n_Auto-Retention: ${Number(retentionDays)} Tage_`
        : "";
    return (
      [`**Gespeicherte Erinnerungen:**`, ...lines].join("\n") + retentionInfo
    );
  }

  async confirmRecoveredProfile(recovery, _originalPrompt = "") {
    if (!recovery?.candidateUserId || this.isResponding) return;

    this.isResponding = true;
    this.syncComposerState();
    this.showTyping();
    const requestId = this.createResponseRequestId();

    try {
      const agentService = await this.robot.getAgentService();
      const result = await agentService.activateProfile?.(
        recovery.candidateUserId,
      );
      if (!this.isActiveResponseRequest(requestId)) return;
      this.removeTyping();

      if (!result?.success) {
        this.addMessage(
          result?.text || "Das Profil konnte nicht geladen werden.",
          "bot",
        );
        return;
      }

      this.removeProfileCards("recovery");
      this.pendingRecoveryPrompt = "";
      this.setProfileState({
        ...(result.profile || agentService.getProfileState?.()),
        recovery: null,
      });
      this.addMessage(
        formatRecoveredProfileSummary(result.memories || []),
        "bot",
      );
    } catch (error) {
      if (!this.isActiveResponseRequest(requestId)) return;
      this.removeTyping();
      log.warn("confirmRecoveredProfile failed", error);
      this.addMessage("Das Profil konnte nicht geladen werden.", "bot");
    } finally {
      if (this.isActiveResponseRequest(requestId)) {
        this.isResponding = false;
        this.syncComposerState();
      }
    }
  }

  async useDifferentProfile() {
    try {
      const agentService = await this.robot.getAgentService();
      const profileState = agentService.startFreshLocalProfile?.();
      this.pendingRecoveryPrompt = "";
      if (profileState)
        this.setProfileState({ ...profileState, recovery: null });
      this.removeProfileCards("recovery");
      this.addMessage(
        "Okay. Dieses Gerät nutzt jetzt ein anderes Profil. Nenne mir einfach deinen Namen oder teile neue Infos mit.",
        "bot",
      );
    } catch (error) {
      log.warn("useDifferentProfile failed", error);
    }
  }

  async switchActiveProfile() {
    if (this.isResponding) return;

    const confirmed =
      typeof window?.confirm !== "function" ||
      window.confirm(
        "Aktives Profil auf diesem Gerät trennen und für ein anderes Profil vorbereiten?",
      );
    if (!confirmed) return;

    this.isResponding = true;
    this.syncComposerState();

    try {
      const agentService = await this.robot.getAgentService();
      const result = await agentService.disconnectCurrentDevice?.();
      this.resetConversationView();
      this.pendingRecoveryPrompt = "";
      this.setProfileState({
        ...(result?.profile || agentService.getProfileState?.()),
        recovery: null,
      });
      this.addMessage(
        "Dieses Gerät ist jetzt frei für ein anderes Profil. Sag mir einfach deinen Namen.",
        "bot",
      );
    } catch (error) {
      log.warn("switchActiveProfile failed", error);
      this.addMessage("Das Profil konnte nicht gewechselt werden.", "bot");
    } finally {
      this.isResponding = false;
      this.syncComposerState();
    }
  }

  async disconnectCurrentDeviceProfile() {
    if (this.isResponding) return;

    const confirmed =
      typeof window?.confirm !== "function" ||
      window.confirm("Dieses Gerät wirklich vom aktiven Profil trennen?");
    if (!confirmed) return;

    this.isResponding = true;
    this.syncComposerState();

    try {
      const agentService = await this.robot.getAgentService();
      const result = await agentService.disconnectCurrentDevice?.();
      this.resetConversationView();
      this.pendingRecoveryPrompt = "";
      this.setProfileState({
        ...(result?.profile || agentService.getProfileState?.()),
        recovery: null,
      });
      this.addMessage(
        result?.text ||
          "Dieses Gerät ist nicht mehr mit einem Profil verbunden.",
        "bot",
      );
    } catch (error) {
      log.warn("disconnectCurrentDeviceProfile failed", error);
      this.addMessage("Das Gerät konnte nicht getrennt werden.", "bot");
    } finally {
      this.isResponding = false;
      this.syncComposerState();
    }
  }

  createMemoryEditorCard(memories = []) {
    const card = document.createElement("div");
    card.className = "chat-profile-card chat-profile-card--editor";
    card.dataset.cardKind = "editor";

    const title = document.createElement("div");
    title.className = "chat-profile-card__title";
    title.textContent = "Profil bearbeiten";

    const text = document.createElement("div");
    text.className = "chat-profile-card__text";
    text.textContent =
      memories.length > 0
        ? "Kerninfos direkt im Chat korrigieren oder entfernen."
        : "Noch keine Erinnerungen gespeichert.";

    const list = document.createElement("div");
    list.className = "chat-memory-editor";

    for (const entry of memories) {
      const row = document.createElement("div");
      row.className = "chat-memory-editor__row";

      const body = document.createElement("div");
      body.className = "chat-memory-editor__body";

      const key = document.createElement("div");
      key.className = "chat-memory-editor__key";
      key.textContent = String(entry?.key || "memory");

      const value = document.createElement("div");
      value.className = "chat-memory-editor__value";
      value.textContent = String(entry?.value || "").trim() || "(leer)";

      body.append(key, value);

      const actions = document.createElement("div");
      actions.className = "chat-memory-editor__actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "chat-memory-editor__btn";
      editBtn.textContent = "Bearbeiten";
      editBtn.addEventListener("click", () => {
        void this.editSingleMemory(entry);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className =
        "chat-memory-editor__btn chat-memory-editor__btn--danger";
      deleteBtn.textContent = "Entfernen";
      deleteBtn.addEventListener("click", () => {
        void this.deleteSingleMemory(entry);
      });

      actions.append(editBtn, deleteBtn);
      row.append(body, actions);
      list.appendChild(row);
    }

    const footer = document.createElement("div");
    footer.className = "chat-profile-card__actions";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "chat-profile-card__btn";
    closeBtn.textContent = "Schließen";
    closeBtn.addEventListener("click", () => card.remove());

    footer.appendChild(closeBtn);
    card.append(title, text, list, footer);
    return card;
  }

  async openMemoryEditor() {
    if (this.isResponding) return;

    this.removeProfileCards("editor");
    const agentService = await this.robot.getAgentService();
    const result = await agentService.listCloudflareMemories?.();
    if (!result?.success) {
      this.addMessage(
        result?.text || "Profil-Erinnerungen konnten nicht geladen werden.",
        "bot",
      );
      return;
    }

    this.setProfileState(result.profile || this.profileState);
    this.appendProfileCard(this.createMemoryEditorCard(result.memories || []));
  }

  async editSingleMemory(entry) {
    const currentValue = String(entry?.value || "").trim();
    const nextValue = window?.prompt?.(
      `${String(entry?.key || "memory")} aktualisieren`,
      currentValue,
    );
    if (nextValue == null) return;

    const value = String(nextValue).trim();
    if (!value) return;

    const agentService = await this.robot.getAgentService();
    const result = await agentService.updateCloudflareMemory?.({
      key: entry?.key,
      value,
      previousValue: currentValue,
    });

    if (!result?.success) {
      this.addMessage(
        result?.text || "Erinnerung konnte nicht aktualisiert werden.",
        "bot",
      );
      return;
    }

    this.setProfileState(result.profile || this.profileState);
    this.removeProfileCards("editor");
    this.appendProfileCard(this.createMemoryEditorCard(result.memories || []));
  }

  async deleteSingleMemory(entry) {
    const confirmed =
      typeof window?.confirm !== "function" ||
      window.confirm(`${String(entry?.key || "memory")} wirklich entfernen?`);
    if (!confirmed) return;

    const agentService = await this.robot.getAgentService();
    const result = await agentService.forgetCloudflareMemory?.({
      key: entry?.key,
      value: entry?.value,
    });

    if (!result?.success) {
      this.addMessage(
        result?.text || "Erinnerung konnte nicht entfernt werden.",
        "bot",
      );
      return;
    }

    this.setProfileState(result.profile || this.profileState);
    this.removeProfileCards("editor");
    this.appendProfileCard(this.createMemoryEditorCard(result.memories || []));
  }

  async showStoredCloudflareMemories() {
    if (this.isResponding) return;

    this.isResponding = true;
    this.syncComposerState();
    this.showTyping();
    const requestId = this.createResponseRequestId();

    try {
      const agentService = await this.robot.getAgentService();
      const result = await agentService.listCloudflareMemories?.();
      if (!this.isActiveResponseRequest(requestId)) return;
      this.removeTyping();

      if (result?.success) {
        this.setProfileState(result.profile || this.profileState);
        this.addMessage(
          this.formatCloudflareMemoriesMessage(
            result.memories || [],
            result.retentionDays || 0,
          ),
          "bot",
        );
        return;
      }

      this.addMessage(
        result?.text || "Cloudflare-Erinnerungen konnten nicht geladen werden.",
        "bot",
      );
    } catch (error) {
      if (!this.isActiveResponseRequest(requestId)) return;
      this.removeTyping();
      log.warn("showStoredCloudflareMemories failed", error);
      this.addMessage(
        "Cloudflare-Erinnerungen konnten nicht geladen werden.",
        "bot",
      );
    } finally {
      if (this.isActiveResponseRequest(requestId)) {
        this.isResponding = false;
        this.syncComposerState();
      }
    }
  }

  async _clearAgentHistory() {
    try {
      const agentService = this.robot.peekAgentService?.();
      if (!agentService) return;
      agentService.clearHistory?.();
    } catch {
      /* ignore */
    }
  }

  async _cancelAgentRequest(reason = "cancelled") {
    try {
      const agentService = this.robot.peekAgentService?.();
      if (!agentService) return;
      agentService.cancelActiveRequest?.(reason);
    } catch {
      /* ignore */
    }
  }

  async handleAction(actionKey) {
    this.robot.trackInteraction("action");

    if (actionKey === ROBOT_ACTIONS.SHOW_MEMORIES) {
      await this.showStoredCloudflareMemories();
      return;
    }

    if (actionKey === ROBOT_ACTIONS.EDIT_PROFILE) {
      await this.openMemoryEditor();
      return;
    }

    if (actionKey === ROBOT_ACTIONS.SWITCH_PROFILE) {
      await this.switchActiveProfile();
      return;
    }

    if (actionKey === ROBOT_ACTIONS.DISCONNECT_PROFILE) {
      await this.disconnectCurrentDeviceProfile();
      return;
    }

    if (actionKey === ROBOT_ACTIONS.CLEAR_CHAT) {
      this.clearHistory();
      return;
    }

    const prompt =
      ACTION_PROMPTS[actionKey] ||
      `Der Nutzer hat die Aktion "${actionKey}" angefragt. Hilf kurz auf Deutsch und nutze passende Tools nur wenn noetig.`;
    await this._routeToAI(actionKey, prompt);
  }

  /** Route action to AI for dynamic response */
  async _routeToAI(actionKey, prompt) {
    if (this.isResponding) return;

    this.isResponding = true;
    this.syncComposerState();
    this.showTyping();
    this.robot.animationModule.startThinking();
    this.robot.dom.avatar.classList.add("nod");
    this.robot._setTimeout(
      () => this.robot.dom.avatar.classList.remove("nod"),
      650,
    );
    const requestId = this.createResponseRequestId();

    try {
      const response = await this._streamAgentResponse(
        (agentService, onChunk) =>
          agentService.generateResponse(prompt, onChunk),
        { requestId },
      );
      if (response?.aborted || !this.isActiveResponseRequest(requestId)) return;
      this.applyAgentResponseMeta(response, { originalPrompt: prompt });
    } catch (error) {
      if (!this.isActiveResponseRequest(requestId)) return;
      log.warn(`Action routing failed (${actionKey})`, error);
      this.robot.animationModule.stopThinking();
      this.removeTyping();
      this.addMessage("Da ist etwas schiefgelaufen.", "bot");
    } finally {
      if (this.isActiveResponseRequest(requestId)) {
        this.isResponding = false;
        this.syncComposerState();
      }
    }
  }

  scrollToBottom() {
    if (this.robot.dom.messages) {
      this.robot.dom.messages.scrollTop = this.robot.dom.messages.scrollHeight;
    }
  }

  syncComposerState() {
    const sendBtn = this.robot.dom.sendBtn;
    if (!sendBtn) return;

    const hasText = Boolean(this.robot.dom.input?.value?.trim());
    const hasPendingImage = Boolean(this.pendingImage);
    const canSend =
      !this.isTyping && !this.isResponding && (hasText || hasPendingImage);

    sendBtn.disabled = !canSend;
    sendBtn.setAttribute("aria-disabled", String(!canSend));
    sendBtn.classList.toggle("is-ready", canSend);
  }

  clearBubbleSequence() {
    // Bubble sequencing is currently unused; reactions call show/hide directly.
  }
}

export const __test__ = {
  formatRecoveredProfileSummary,
  getRecoveryFollowUpAction,
};
