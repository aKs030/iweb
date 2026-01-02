import { GeminiService as u } from "./gemini-service.js";
import { RobotGames as b } from "./robot-games.js";
import { RobotCollision as m } from "./modules/robot-collision.js";
import { RobotAnimation as g } from "./modules/robot-animation.js";
import { RobotChat as p } from "./modules/robot-chat.js";
import { RobotIntelligence as f } from "./modules/robot-intelligence.js";
import { RobotSound as y } from "./modules/robot-sound.js";
import { createLogger as v } from "../../utils/shared-utilities.js";
const h = v("RobotCompanion");
class d {
  containerId = "robot-companion-container";
  texts = {};
  constructor() {
    (this.texts =
      (typeof globalThis < "u" && globalThis.robotCompanionTexts) ||
      this.texts ||
      {}),
      (this.gemini = new u()),
      (this.gameModule = new b(this)),
      (this.animationModule = new g(this)),
      (this.collisionModule = new m(this)),
      (this.chatModule = new p(this)),
      (this.intelligenceModule = new f(this)),
      (this.soundModule = new y(this)),
      (this.state = {}),
      (this.isKeyboardAdjustmentActive = !1),
      (this.initialLayoutHeight =
        typeof globalThis < "u" ? globalThis.innerHeight : 0),
      (this.currentObservedContext = null),
      (this._sectionObserver = null),
      (this.analytics = {
        sessions:
          Number.parseInt(localStorage.getItem("robot-sessions") || "0", 10) +
          1,
        sectionsVisited: [],
        interactions: Number.parseInt(
          localStorage.getItem("robot-interactions") || "0",
          10
        ),
        lastVisit:
          localStorage.getItem("robot-last-visit") || new Date().toISOString(),
      }),
      localStorage.setItem("robot-sessions", this.analytics.sessions),
      localStorage.setItem("robot-last-visit", new Date().toISOString()),
      (this.mood = this.calculateMood()),
      (this.easterEggFound = new Set(
        JSON.parse(localStorage.getItem("robot-easter-eggs") || "[]")
      )),
      (this.dom = {}),
      this.applyTexts(),
      (this._sectionCheckInterval = null),
      (this._scrollListener = null);
  }
  applyTexts() {
    const t =
        (typeof globalThis < "u" && globalThis.robotCompanionTexts) ||
        this.texts ||
        {},
      e = this.chatModule;
    (e.knowledgeBase = t.knowledgeBase ||
      e.knowledgeBase || { start: { text: "Hallo!", options: [] } }),
      (e.contextGreetings = t.contextGreetings ||
        e.contextGreetings || { default: [] }),
      (e.moodGreetings = t.moodGreetings ||
        e.moodGreetings || {
          normal: ["Hey! Wie kann ich helfen?", "Hi! Was brauchst du?"],
        }),
      (e.startMessageSuffix =
        t.startMessageSuffix || e.startMessageSuffix || {}),
      (e.initialBubbleGreetings = t.initialBubbleGreetings ||
        e.initialBubbleGreetings || ["Psst! Brauchst du Hilfe?"]),
      (e.initialBubblePools =
        t.initialBubblePools || e.initialBubblePools || []),
      (e.initialBubbleSequenceConfig = t.initialBubbleSequenceConfig ||
        e.initialBubbleSequenceConfig || {
          steps: 4,
          displayDuration: 1e4,
          pausesAfter: [0, 2e4, 2e4, 0],
        });
  }
  loadTexts() {
    return new Promise((t) => {
      if (typeof globalThis < "u" && globalThis.robotCompanionTexts) {
        (this.texts = globalThis.robotCompanionTexts), t();
        return;
      }
      if (document.querySelector('script[src*="robot-companion-texts.js"]')) {
        t();
        return;
      }
      const e = document.createElement("script");
      (e.src = "/content/components/robot-companion/robot-companion-texts.js"),
        (e.async = !0),
        (e.onload = () => {
          (this.texts =
            (typeof globalThis < "u" && globalThis.robotCompanionTexts) ||
            this.texts ||
            {}),
            t();
        }),
        (e.onerror = () => t()),
        document.head.appendChild(e);
    });
  }
  setupFooterOverlapCheck() {
    let t = !1;
    const e = () => {
        if (this.isKeyboardAdjustmentActive) {
          t = !1;
          return;
        }
        if (!this.dom.container) return;
        this.dom.footer ||
          (this.dom.footer =
            document.querySelector("footer") ||
            document.querySelector("#site-footer"));
        const o = this.dom.footer;
        if (!o) return;
        this.dom.container.style.bottom = "";
        const n = this.dom.container.getBoundingClientRect(),
          s = o.getBoundingClientRect(),
          r = Math.max(0, n.bottom - s.top);
        r > 0 && (this.dom.container.style.bottom = `${30 + r}px`),
          this.chatModule.isOpen || this.collisionModule.scanForCollisions(),
          (t = !1);
      },
      i = () => {
        t || (requestAnimationFrame(e), (t = !0));
      };
    typeof globalThis < "u" &&
      (globalThis.addEventListener("scroll", i, { passive: !0 }),
      globalThis.addEventListener("resize", i, { passive: !0 })),
      requestAnimationFrame(e),
      setInterval(i, 1e3);
  }
  setupMobileViewportHandler() {
    if (typeof globalThis > "u" || !globalThis.visualViewport) return;
    const t = () => {
      if (!this.dom.window || !this.dom.container) return;
      if (!this.chatModule.isOpen) {
        this.isKeyboardAdjustmentActive &&
          ((this.isKeyboardAdjustmentActive = !1),
          (this.dom.container.style.bottom = ""),
          (this.dom.window.style.maxHeight = ""));
        return;
      }
      const e =
          this.initialLayoutHeight ||
          (typeof globalThis < "u" ? globalThis.innerHeight : 0),
        i =
          typeof globalThis < "u" && globalThis.visualViewport
            ? globalThis.visualViewport.height
            : e,
        o = e - i,
        n = document.activeElement === this.dom.input;
      if (o > 150 || (n && o > 50)) {
        (this.isKeyboardAdjustmentActive = !0),
          this.dom.controls &&
            this.dom.controls.classList.add("hide-controls-mobile");
        const s = i - 10 * 2;
        (this.dom.window.style.maxHeight = `${s}px`),
          requestAnimationFrame(() => {
            if (!this.dom.window) return;
            const r = this.dom.window.offsetHeight,
              l = Math.max(0, i - r) / 2,
              c = o + l;
            this.dom.container.style.bottom = `${c}px`;
          }),
          (this.dom.container.style.bottom = `${o + 10}px`);
      } else
        (this.isKeyboardAdjustmentActive = !1),
          this.dom.controls &&
            !n &&
            this.dom.controls.classList.remove("hide-controls-mobile"),
          (this.dom.container.style.bottom = ""),
          (this.dom.window.style.maxHeight = "");
    };
    typeof globalThis < "u" &&
      globalThis.visualViewport &&
      (globalThis.visualViewport.addEventListener("resize", t),
      globalThis.visualViewport.addEventListener("scroll", t)),
      this.dom.input &&
        (this.dom.input.addEventListener("focus", t),
        this.dom.input.addEventListener("blur", () => setTimeout(t, 200)));
  }
  init() {
    this.dom.container ||
      (this.loadCSS(),
      this.createDOM(),
      this.attachEvents(),
      this.setupFooterOverlapCheck(),
      this.setupMobileViewportHandler(),
      setTimeout(() => {
        const t = this.getPageContext();
        if (!this.chatModule.isOpen && !this.chatModule.lastGreetedContext)
          if (
            this.chatModule.initialBubblePools &&
            this.chatModule.initialBubblePools.length > 0 &&
            Math.random() < 0.9
          )
            this.chatModule.startInitialBubbleSequence();
          else {
            const e =
                this.chatModule.initialBubbleGreetings &&
                this.chatModule.initialBubbleGreetings.length > 0
                  ? this.chatModule.initialBubbleGreetings[
                      Math.floor(
                        Math.random() *
                          this.chatModule.initialBubbleGreetings.length
                      )
                    ]
                  : "Hallo!",
              i =
                this.chatModule.contextGreetings[t] ||
                this.chatModule.contextGreetings.default ||
                [];
            let o = e;
            i.length &&
              Math.random() < 0.7 &&
              (o = String(
                i[Math.floor(Math.random() * i.length)] || ""
              ).trim()),
              this.chatModule.showBubble(o),
              (this.chatModule.lastGreetedContext = t);
          }
      }, 5e3),
      this.setupSectionChangeDetection(),
      setTimeout(() => {
        this.animationModule.startTypeWriterKnockbackAnimation();
      }, 1500),
      (this._onHeroTypingEnd = (t) => {
        try {
          const e = document.querySelector(".typewriter-title");
          if (!e || !this.dom?.container) return;
          const i = e.getBoundingClientRect(),
            o =
              (typeof globalThis < "u" ? globalThis.innerWidth : 0) -
              30 -
              80 -
              20;
          this.collisionModule.checkForTypewriterCollision(i, o);
        } catch (e) {
          h.warn("RobotCompanion: hero typing end handler failed", e);
        }
      }),
      document.addEventListener("hero:typingEnd", this._onHeroTypingEnd));
  }
  setupSectionChangeDetection() {
    this.setupSectionObservers();
    let t = this.getPageContext();
    const e = () => {
      if (this.chatModule.isOpen) return;
      const o = this.getPageContext();
      o !== t &&
        o !== this.chatModule.lastGreetedContext &&
        ((t = o),
        setTimeout(() => {
          this.getPageContext() === o &&
            !this.chatModule.isOpen &&
            this.chatModule.startInitialBubbleSequence();
        }, 2e3));
    };
    let i;
    (this._scrollListener = () => {
      clearTimeout(i),
        (i = setTimeout(() => {
          e();
          try {
            const o = document.querySelector(".typewriter-title");
            if (o && this.dom.container) {
              const n = o.getBoundingClientRect(),
                s =
                  (typeof globalThis < "u" ? globalThis.innerWidth : 0) -
                  30 -
                  80 -
                  20;
              this.collisionModule.checkForTypewriterCollision(n, s);
            }
          } catch (o) {
            h.warn("RobotCompanion: scroll handler collision check failed", o);
          }
        }, 500));
    }),
      typeof globalThis < "u" &&
        globalThis.addEventListener("scroll", this._scrollListener, {
          passive: !0,
        }),
      (this._sectionCheckInterval = setInterval(e, 3e3));
  }
  destroy() {
    this.chatModule.clearBubbleSequence(),
      this.animationModule.stopIdleEyeMovement(),
      this.animationModule.stopBlinkLoop(),
      this._sectionObserver &&
        (this._sectionObserver.disconnect(), (this._sectionObserver = null)),
      this._scrollListener &&
        (typeof globalThis < "u" &&
          globalThis.removeEventListener("scroll", this._scrollListener),
        (this._scrollListener = null)),
      this._onHeroTypingEnd &&
        (document.removeEventListener("hero:typingEnd", this._onHeroTypingEnd),
        (this._onHeroTypingEnd = null)),
      this._sectionCheckInterval &&
        (clearInterval(this._sectionCheckInterval),
        (this._sectionCheckInterval = null)),
      this.dom.container &&
        this.dom.container.parentNode &&
        this.dom.container?.remove();
  }
  calculateMood() {
    const t = new Date().getHours(),
      { sessions: e, interactions: i } = this.analytics;
    return t >= 0 && t < 6
      ? "night-owl"
      : t >= 6 && t < 10
      ? "sleepy"
      : t >= 10 && t < 17
      ? "energetic"
      : t >= 17 && t < 22
      ? "relaxed"
      : t >= 22
      ? "night-owl"
      : e > 10 || i > 50
      ? "enthusiastic"
      : "normal";
  }
  getMoodGreeting() {
    const t =
        this.chatModule.moodGreetings ||
        (typeof globalThis < "u" &&
          globalThis.robotCompanionTexts &&
          globalThis.robotCompanionTexts.moodGreetings) ||
        {},
      e = t[this.mood] || t.normal || ["Hey! Wie kann ich helfen?"];
    return e[Math.floor(Math.random() * e.length)];
  }
  trackInteraction(t = "general") {
    this.analytics.interactions++,
      localStorage.setItem("robot-interactions", this.analytics.interactions),
      this.analytics.interactions === 10 &&
        !this.easterEggFound.has("first-10") &&
        this.unlockEasterEgg(
          "first-10",
          "\u{1F389} Wow, 10 Interaktionen! Du bist hartn\xE4ckig! Hier ist ein Geschenk: Ein geheimes Mini-Game wurde freigeschaltet! \u{1F3AE}"
        ),
      this.analytics.interactions === 50 &&
        !this.easterEggFound.has("first-50") &&
        this.unlockEasterEgg(
          "first-50",
          "\u{1F3C6} 50 Interaktionen! Du bist ein echter Power-User! Respekt! \u{1F4AA}"
        );
  }
  unlockEasterEgg(t, e) {
    this.easterEggFound.add(t),
      localStorage.setItem(
        "robot-easter-eggs",
        JSON.stringify([...this.easterEggFound])
      ),
      this.chatModule.showBubble(e),
      setTimeout(() => this.chatModule.hideBubble(), 1e4);
  }
  trackSectionVisit(t) {
    this.analytics.sectionsVisited.includes(t) ||
      (this.analytics.sectionsVisited.push(t),
      ["hero", "features", "section3", "projects", "gallery", "footer"].every(
        (e) => this.analytics.sectionsVisited.includes(e)
      ) &&
        !this.easterEggFound.has("explorer") &&
        this.unlockEasterEgg(
          "explorer",
          "\u{1F5FA}\uFE0F Du hast alle Bereiche erkundet! Echter Explorer! \u{1F9ED}"
        ));
  }
  loadCSS() {
    if (!document.querySelector('link[href*="robot-companion.css"]')) {
      const t = document.createElement("link");
      (t.rel = "stylesheet"),
        (t.href = "/content/components/robot-companion/robot-companion.css"),
        document.head.appendChild(t);
    }
  }
  createDOM() {
    const t = document.createElement("div");
    t.id = this.containerId;
    const e = `
        <svg viewBox="0 0 100 100" class="robot-svg">
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
              </filter>
              <filter id="lidShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.35" />
              </filter>
              <linearGradient id="lidGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#0b1220" stop-opacity="0.95" />
                <stop offset="100%" stop-color="#0f172a" stop-opacity="1" />
              </linearGradient>
            </defs>
            <line x1="50" y1="15" x2="50" y2="25" stroke="#40e0d0" stroke-width="2" />
            <circle cx="50" cy="15" r="3" class="robot-antenna-light" fill="#ff4444" />
            <path d="M30,40 a20,20 0 0,1 40,0" fill="#1e293b" stroke="#40e0d0" stroke-width="2" />
            <rect x="30" y="40" width="40" height="15" fill="#1e293b" stroke="#40e0d0" stroke-width="2" />
            <g class="robot-eyes">
              <circle class="robot-pupil" cx="40" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" />
              <path class="robot-lid" d="M34 36 C36 30 44 30 46 36 L46 44 C44 38 36 38 34 44 Z" fill="url(#lidGradient)" filter="url(#lidShadow)" />
              <circle class="robot-pupil" cx="60" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" />
              <path class="robot-lid" d="M54 36 C56 30 64 30 66 36 L66 44 C64 38 56 38 54 44 Z" fill="url(#lidGradient)" filter="url(#lidShadow)" />
            </g>
            <path class="robot-legs" d="M30,60 L70,60 L65,90 L35,90 Z" fill="#0f172a" stroke="#40e0d0" stroke-width="2" />
            <g class="robot-arms">
                <path class="robot-arm left" d="M30,62 Q20,70 25,80" fill="none" stroke="#40e0d0" stroke-width="3" stroke-linecap="round" />
                <path class="robot-arm right" d="M70,62 Q80,70 75,80" fill="none" stroke="#40e0d0" stroke-width="3" stroke-linecap="round" />
            </g>
            <g class="robot-flame" style="opacity: 0;">
                <path d="M40,90 Q50,120 60,90 Q50,110 40,90" fill="#ff9900" />
                <path d="M45,90 Q50,110 55,90" fill="#ffff00" />
            </g>
            <g class="robot-particles" style="opacity: 0;">
                <circle class="particle" cx="20" cy="50" r="2" fill="#40e0d0" opacity="0.6"><animate attributeName="cy" values="50;30;50" dur="2s" repeatCount="indefinite" /></circle>
                <circle class="particle" cx="80" cy="60" r="1.5" fill="#40e0d0" opacity="0.5"><animate attributeName="cy" values="60;40;60" dur="2.5s" repeatCount="indefinite" /></circle>
                <circle class="particle" cx="15" cy="70" r="1" fill="#40e0d0" opacity="0.7"><animate attributeName="cy" values="70;50;70" dur="1.8s" repeatCount="indefinite" /></circle>
            </g>
            <g class="robot-thinking" style="opacity: 0;">
                <circle cx="70" cy="20" r="8" fill="rgba(64, 224, 208, 0.2)" stroke="#40e0d0" stroke-width="1" />
                <text x="70" y="25" font-size="12" fill="#40e0d0" text-anchor="middle">?</text>
            </g>
            <circle cx="50" cy="70" r="5" fill="#2563eb" opacity="0.8"><animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" /></circle>
        </svg>
    `;
    (t.innerHTML = `
            <div class="robot-chat-window" id="robot-chat-window">
                <div class="chat-header">
                    <div class="chat-title"><span class="chat-status-dot"></span>Cyber Assistant</div>
                    <button class="chat-close-btn">&times;</button>
                </div>
                <div class="chat-messages" id="robot-messages"></div>
                <div class="chat-controls" id="robot-controls"></div>
                <div class="chat-input-area" id="robot-input-area">
                    <input type="text" id="robot-chat-input" placeholder="Frag mich etwas oder w\xE4hle eine Option..." />
                    <button id="robot-chat-send">\u27A4</button>
                </div>
            </div>
            <div class="robot-float-wrapper">
                <div class="robot-bubble" id="robot-bubble">
                    <span id="robot-bubble-text">Hallo!</span>
                    <div class="robot-bubble-close">&times;</div>
                </div>
                <button class="robot-avatar" aria-label="Chat \xF6ffnen">${e}</button>
            </div>
        `),
      (t.style.opacity = "0"),
      (t.style.transition = "opacity 220ms ease"),
      document.body.appendChild(t),
      (this.dom.container = t),
      (this.dom.window = document.getElementById("robot-chat-window")),
      (this.dom.bubble = document.getElementById("robot-bubble")),
      (this.dom.bubbleText = document.getElementById("robot-bubble-text")),
      (this.dom.bubbleClose = t.querySelector(".robot-bubble-close")),
      (this.dom.messages = document.getElementById("robot-messages")),
      (this.dom.controls = document.getElementById("robot-controls")),
      (this.dom.inputArea = document.getElementById("robot-input-area")),
      (this.dom.input = document.getElementById("robot-chat-input")),
      (this.dom.sendBtn = document.getElementById("robot-chat-send")),
      (this.dom.avatar = t.querySelector(".robot-avatar")),
      (this.dom.svg = t.querySelector(".robot-svg")),
      (this.dom.eyes = t.querySelector(".robot-eyes")),
      (this.dom.flame = t.querySelector(".robot-flame")),
      (this.dom.legs = t.querySelector(".robot-legs")),
      (this.dom.arms = {
        left: t.querySelector(".robot-arm.left"),
        right: t.querySelector(".robot-arm.right"),
      }),
      (this.dom.particles = t.querySelector(".robot-particles")),
      (this.dom.thinking = t.querySelector(".robot-thinking")),
      (this.dom.closeBtn = t.querySelector(".chat-close-btn")),
      requestAnimationFrame(() => this.animationModule.startIdleEyeMovement());
  }
  attachEvents() {
    this.dom.avatar.addEventListener("click", () => this.handleAvatarClick()),
      this.dom.closeBtn.addEventListener("click", (t) => {
        t.stopPropagation(), this.toggleChat(!1);
      }),
      this.dom.bubbleClose.addEventListener("click", (t) => {
        t.stopPropagation();
        const e = this.getPageContext();
        (this.chatModule.lastGreetedContext = e),
          this.chatModule.clearBubbleSequence(),
          this.chatModule.hideBubble();
      }),
      this.dom.sendBtn &&
        this.dom.sendBtn.addEventListener("click", () =>
          this.handleUserMessage()
        ),
      this.dom.input &&
        (this.dom.input.addEventListener("keypress", (t) => {
          t.key === "Enter" && this.handleUserMessage();
        }),
        this.dom.input.addEventListener("focus", () => {
          this.dom.controls &&
            this.dom.controls.classList.add("hide-controls-mobile");
        }),
        this.dom.input.addEventListener("blur", () => {
          setTimeout(() => {
            this.dom.controls &&
              this.dom.controls.classList.remove("hide-controls-mobile");
          }, 200);
        }));
  }
  getPageContext() {
    try {
      if (this.currentObservedContext) return this.currentObservedContext;
      const t = (window.location && window.location.pathname) || "",
        e = t.split("/").pop() || "",
        i = t.toLowerCase(),
        o = (window.innerHeight || 0) / 2,
        n = (r) => {
          try {
            const l = document.querySelector(r);
            if (!l) return !1;
            const c = l.getBoundingClientRect();
            return c.top <= o && c.bottom >= o;
          } catch {
            return !1;
          }
        };
      let s = "default";
      if (n("#hero")) s = "hero";
      else if (n("#features")) s = "features";
      else if (n("#section3")) s = "about";
      else if (n("#footer-container") || n("footer")) s = "footer";
      else if (i.includes("projekte")) s = "projects";
      else if (i.includes("gallery") || i.includes("fotos")) s = "gallery";
      else if (i.includes("about") && e !== "index.html") s = "about";
      else if (i === "/" || e === "index.html" || e === "") s = "home";
      else {
        const r = document.querySelector("h1");
        if (r) {
          const l = (r.textContent || "").toLowerCase();
          l.includes("projekt")
            ? (s = "projects")
            : (l.includes("foto") || l.includes("galerie")) && (s = "gallery");
        }
      }
      return this.trackSectionVisit(s), s;
    } catch {
      return "default";
    }
  }
  setupSectionObservers() {
    if (this._sectionObserver) return;
    const t = [
        { selector: "#hero", ctx: "hero" },
        { selector: "#features", ctx: "features" },
        { selector: "#section3", ctx: "about" },
        { selector: "#footer-container", ctx: "footer" },
        { selector: "footer", ctx: "footer" },
      ],
      e = new IntersectionObserver(
        (i) => {
          i.forEach((o) => {
            if (o.isIntersecting && o.intersectionRatio > 0.35) {
              const n = t.find((s) => o.target.matches(s.selector));
              n && (this.currentObservedContext = n.ctx);
            }
          });
        },
        { threshold: [0.35, 0.5, 0.75] }
      );
    t.forEach((i) => {
      const o = document.querySelector(i.selector);
      o && e.observe(o);
    }),
      (this._sectionObserver = e);
  }
  showMoodInfo() {
    const t = {
        "night-owl": "\u{1F989}",
        sleepy: "\u{1F634}",
        energetic: "\u26A1",
        relaxed: "\u{1F60A}",
        enthusiastic: "\u{1F929}",
        normal: "\u{1F916}",
      },
      e = {
        "night-owl": "Nachteule-Modus aktiv! Ich bin hellwach! \u{1F319}",
        sleepy: "Etwas verschlafen heute... \u2615",
        energetic: "Voller Energie und bereit f\xFCr Action! \u{1F4AA}",
        relaxed: "Entspannt und gelassen unterwegs! \u{1F305}",
        enthusiastic: "Super enthusiastisch - du bist ja Power-User! \u{1F389}",
        normal: "Ganz normaler Roboter-Modus! \u{1F916}",
      },
      i = t[this.mood] || "\u{1F916}",
      o = e[this.mood] || "Normaler Modus",
      n = `
      \u{1F4CA} Deine Stats:
      \u2022 Sessions: ${this.analytics.sessions}
      \u2022 Interaktionen: ${this.analytics.interactions}
      \u2022 Easter Eggs: ${this.easterEggFound.size}
      \u2022 Mood: ${i} ${this.mood}
    `;
    this.chatModule.addMessage(o, "bot"),
      this.chatModule.addMessage(n, "bot"),
      setTimeout(() => this.chatModule.handleAction("start"), 2e3);
  }
  fetchAndShowSuggestion() {
    return this.chatModule.fetchAndShowSuggestion();
  }
  toggleChat(t) {
    return this.chatModule.toggleChat(t);
  }
  handleAvatarClick() {
    return this.chatModule.handleAvatarClick();
  }
  handleUserMessage() {
    return this.chatModule.handleUserMessage();
  }
  addMessage(t, e) {
    return this.chatModule.addMessage(t, e);
  }
  addOptions(t) {
    return this.chatModule.addOptions(t);
  }
  handleAction(t) {
    return this.chatModule.handleAction(t);
  }
  showBubble(t) {
    return this.chatModule.showBubble(t);
  }
  hideBubble() {
    return this.chatModule.hideBubble();
  }
  scrollToBottom() {
    return this.chatModule.scrollToBottom();
  }
  startInitialBubbleSequence() {
    return this.chatModule.startInitialBubbleSequence();
  }
  clearBubbleSequence() {
    return this.chatModule.clearBubbleSequence();
  }
  async initialize() {
    await this.loadTexts(),
      this.applyTexts(),
      this.dom.container || this.init();
  }
}
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", () => {
      new d()
        .initialize()
        .catch((a) => console.error("RobotCompanion init failed", a));
    })
  : new d()
      .initialize()
      .catch((a) => console.error("RobotCompanion init failed", a));
