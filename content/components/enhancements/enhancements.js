/**
 * Enhancements Module — Single Entry Point
 *
 * Phase 1: Section Dots · Reveal on Scroll
 * Phase 2: Skill Radar Chart · Search Filters
 * Phase 3: Voice Input/TTS · Easter Eggs
 *
 * @version 2.0.0
 */

import { createLogger } from "../../core/logger.js";
import { i18n } from "../../core/i18n.js";
import { resolvedTheme } from "../../core/state/theme-state.js";

const log = createLogger("Enhancements");

// ─── SVG Icons ──────────────────────────────────────────────────────
const SVG_NS = "http://www.w3.org/2000/svg";
const ICON_DEFS = {
  mic: [
    { tag: "path", attrs: { d: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" } },
    { tag: "path", attrs: { d: "M19 10v2a7 7 0 0 1-14 0v-2" } },
    { tag: "line", attrs: { x1: "12", y1: "19", x2: "12", y2: "23" } },
    { tag: "line", attrs: { x1: "8", y1: "23", x2: "16", y2: "23" } },
  ],
  speaker: [
    { tag: "polygon", attrs: { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5" } },
    { tag: "path", attrs: { d: "M19.07 4.93a10 10 0 0 1 0 14.14" } },
    { tag: "path", attrs: { d: "M15.54 8.46a5 5 0 0 1 0 7.07" } },
  ],
};

function createIcon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  (ICON_DEFS[name] || []).forEach(({ tag, attrs }) => {
    const child = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => {
      child.setAttribute(key, value);
    });
    svg.appendChild(child);
  });

  return svg;
}

// ─── Shared helpers ─────────────────────────────────────────────────
const RADAR_COLORS = ["#8b5cf6", "#06b6d4"];

// ═════════════════════════════════════════════════════════════════════
//  PHASE 1
// ═════════════════════════════════════════════════════════════════════

// ─── 1A: Section Dot Navigation ─────────────────────────────────────
function initSectionDots() {
  const sections = document.querySelectorAll("main section[id]");
  if (sections.length < 2) return;

  const nav = document.createElement("nav");
  nav.className = "section-dots";
  nav.setAttribute(
    "aria-label",
    i18n.tOrFallback("enhancements.section_navigation", "Seitennavigation")
  );
  nav.setAttribute("data-i18n-attrs", "aria-label:enhancements.section_navigation");

  /** @type {Array<{el: HTMLButtonElement, sectionId: string}>} */
  const dots = [];

  sections.forEach(section => {
    const dot = /** @type {HTMLButtonElement} */ (document.createElement("button"));
    dot.className = "section-dots__dot";
    dot.dataset.target = section.id;

    const labelKey = section.dataset.i18nSectionLabel || "";
    const fallbackLabel = section.getAttribute("aria-label") || section.id;
    const label = labelKey ? i18n.tOrFallback(labelKey, fallbackLabel) : fallbackLabel;
    dot.setAttribute("aria-label", label);
    dot.setAttribute("title", label);
    if (labelKey) {
      dot.setAttribute("data-i18n-attrs", `aria-label:${labelKey},title:${labelKey}`);
    }
    dot.addEventListener("click", () => section.scrollIntoView({ behavior: "smooth" }));

    nav.append(dot);
    dots.push({ el: dot, sectionId: section.id });
  });

  document.body.append(nav);

  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const d of dots) {
          d.el.classList.toggle("is-active", d.sectionId === entry.target.id);
        }
      }
    },
    { threshold: 0.3, rootMargin: "-10% 0px -10% 0px" }
  );

  sections.forEach(s => observer.observe(s));
  dots[0]?.el.classList.add("is-active");
  log.debug(`Section dots: ${sections.length} sections`);
}

// ─── 1B: Reveal on Scroll ──────────────────────────────────────────
function initRevealOnScroll() {
  const elements = document.querySelectorAll("[data-reveal]");
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const target = /** @type {HTMLElement} */ (entry.target);
        const delay = target.dataset.revealDelay ?? 0;
        setTimeout(() => target.classList.add("revealed"), +delay);
        observer.unobserve(target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  elements.forEach(el => observer.observe(el));
  log.debug(`Reveal: ${elements.length} elements`);
}

// ═════════════════════════════════════════════════════════════════════
//  PHASE 2
// ═════════════════════════════════════════════════════════════════════

// ─── 2A: Skill Radar Chart ──────────────────────────────────────────
const SKILLS = {
  Frontend: [
    { name: "JavaScript", value: 95 },
    { name: "CSS/Design", value: 90 },
    { name: "Three.js", value: 85 },
    { name: "React", value: 80 },
    { name: "Web APIs", value: 90 },
    { name: "TypeScript", value: 75 },
  ],
  Backend: [
    { name: "Cloudflare Workers", value: 90 },
    { name: "Node.js", value: 80 },
    { name: "AI/ML APIs", value: 85 },
    { name: "Edge Computing", value: 88 },
    { name: "Databases", value: 75 },
    { name: "Security", value: 78 },
  ],
};

function drawRadar(container, dataset, opts = {}) {
  const size = opts.size ?? 280;
  const dpr = devicePixelRatio || 1;

  const canvas = document.createElement("canvas");
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.cssText = `width:${size}px;height:${size}px`;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const values = dataset.map(d => d.value / 100);
  const n = dataset.length;
  const step = (Math.PI * 2) / n;

  const root = getComputedStyle(document.documentElement);
  const gridColor = root.getPropertyValue("--text-secondary")?.trim() || "#475569";
  const fillColor = opts.color ?? RADAR_COLORS[0];

  // Grid rings
  for (let ring = 1; ring <= 4; ring++) {
    const r = (ring / 4) * maxR;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i * step - Math.PI / 2;
      const fn = i === 0 ? "moveTo" : "lineTo";
      ctx[fn](cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.25;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Axes + labels
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillStyle = gridColor;
  ctx.textAlign = "center";

  for (let i = 0; i < n; i++) {
    const a = i * step - Math.PI / 2;
    const xEnd = cx + maxR * Math.cos(a);
    const yEnd = cy + maxR * Math.sin(a);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(xEnd, yEnd);
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    const lR = maxR + 18;
    ctx.fillText(dataset[i].name, cx + lR * Math.cos(a), cy + lR * Math.sin(a) + 3);
  }

  // Data polygon
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const idx = i % n;
    const a = idx * step - Math.PI / 2;
    const r = values[idx] * maxR;
    const fn = i === 0 ? "moveTo" : "lineTo";
    ctx[fn](cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.globalAlpha = 0.18;
  ctx.fill();
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Data points
  for (let i = 0; i < n; i++) {
    const a = i * step - Math.PI / 2;
    const r = values[i] * maxR;
    ctx.beginPath();
    ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 3, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  container.append(canvas);
}

function initSkillRadar() {
  const target = document.querySelector(".skill-radar-mount");
  if (!target) return;

  const wrapper = document.createElement("div");
  wrapper.className = "skill-radar";

  const heading = document.createElement("h4");
  heading.className = "about__subheading";
  heading.textContent = "Skill Übersicht";
  heading.classList.add("skill-radar__heading");
  wrapper.append(heading);

  const charts = document.createElement("div");
  charts.className = "skill-radar__charts";

  const entries = Object.entries(SKILLS);

  const buildCharts = () => {
    // Clear existing canvases
    charts.querySelectorAll("canvas").forEach(c => c.remove());

    entries.forEach(([, data], i) => {
      const col = charts.children[i];
      if (!col) return;
      const label = col.querySelector(".skill-radar__item");
      drawRadar(col, data, { color: RADAR_COLORS[i], size: 240 });
      // Ensure canvas is before label
      const canvas = col.querySelector("canvas");
      if (label && canvas) col.insertBefore(canvas, label);
    });
  };

  entries.forEach(([name], i) => {
    const col = document.createElement("div");
    col.className = "skill-radar__chart-col";
    const label = document.createElement("span");
    label.className = "skill-radar__item";
    const dot = document.createElement("span");
    dot.className = `skill-radar__dot skill-radar__dot--${i % RADAR_COLORS.length}`;
    label.append(dot, document.createTextNode(name));
    col.append(label);
    charts.append(col);
  });

  wrapper.append(charts);
  target.append(wrapper);

  // Initial draw + redraw on theme change
  buildCharts();
  resolvedTheme.subscribe(() => buildCharts());

  log.debug("Skill radar ready");
}

// ─── 2B: Search Filters ─────────────────────────────────────────────
function initSearchFilters() {
  document.addEventListener(
    "menu:loaded",
    () => {
      const menu = document.querySelector("site-menu");
      if (!menu) return;

      const root = menu.shadowRoot || menu;
      const searchInput = root.querySelector('.search-input, input[type="search"]');
      if (!searchInput) return;

      const filterBar = document.createElement("div");
      filterBar.className = "search-filter-bar";

      const filters = ["Alle", "Projekte", "Blog", "Seiten"];
      let activeFilter = "Alle";

      filters.forEach(label => {
        const chip = document.createElement("button");
        chip.className = `search-filter-chip${label === activeFilter ? " is-active" : ""}`;
        chip.textContent = label;

        chip.addEventListener("click", () => {
          activeFilter = label;
          filterBar
            .querySelectorAll(".search-filter-chip")
            .forEach(b => b.classList.remove("is-active"));
          chip.classList.add("is-active");
          searchInput.dispatchEvent(
            new CustomEvent("search:filter", { detail: { filter: label } })
          );
        });

        filterBar.append(chip);
      });

      searchInput.parentElement?.after(filterBar);
      log.debug("Search filters ready");
    },
    { once: true }
  );
}

// ═════════════════════════════════════════════════════════════════════
//  PHASE 3
// ═════════════════════════════════════════════════════════════════════

// ─── 3A: Voice Input ────────────────────────────────────────────────
function initVoiceInput() {
  const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  const insertVoiceBtn = () => {
    const chatInput = document.querySelector(
      "#robot-chat-input, .robot-chat-input, .chat-input, [data-chat-input]"
    );
    if (!chatInput) return;

    const composer = chatInput.closest?.(".chat-composer");
    const inputStack = chatInput.closest?.(".chat-input-stack");
    const scope = composer || chatInput.parentElement;
    if (scope?.querySelector(".voice-btn")) return;

    const btn = document.createElement("button");
    btn.className = "voice-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Spracheingabe starten");
    btn.setAttribute("title", "Spracheingabe");
    btn.appendChild(createIcon("mic"));

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    let isListening = false;

    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join("");
      if (chatInput instanceof HTMLInputElement || chatInput instanceof HTMLTextAreaElement) {
        chatInput.value = transcript;
        chatInput.dispatchEvent(new Event("input", { bubbles: true }));
        chatInput.focus();
      }
    };

    const stopListening = () => {
      isListening = false;
      btn.removeAttribute("data-listening");
      btn.setAttribute("aria-label", "Spracheingabe starten");
    };

    recognition.onend = stopListening;
    recognition.onerror = e => {
      log.warn("Speech error:", e.error);
      stopListening();
    };

    btn.addEventListener("click", () => {
      if (isListening) {
        recognition.stop();
      } else {
        recognition.lang = document.documentElement.lang || "de-DE";
        recognition.start();
        isListening = true;
        btn.setAttribute("data-listening", "");
        btn.setAttribute("aria-label", "Spracheingabe stoppen");
      }
    });

    if (composer && inputStack) {
      btn.classList.add("voice-btn--chat");
      composer.classList.add("chat-composer--voice-enabled");
      composer.insertBefore(btn, inputStack);
    } else {
      chatInput.parentElement.style.position = "relative";
      chatInput.after(btn);
    }
  };

  insertVoiceBtn();
  document.addEventListener("robot:chat-opened", insertVoiceBtn);
  log.debug("Voice input ready");
}

// ─── 3B: Text-to-Speech ─────────────────────────────────────────────
function initTTS() {
  if (!("speechSynthesis" in globalThis)) return;

  const addTTSButtons = () => {
    const messages = document.querySelectorAll(
      ".robot-message:not([data-tts]), .chat-message.ai:not([data-tts])"
    );

    for (const msg of messages) {
      msg.setAttribute("data-tts", "");

      const btn = document.createElement("button");
      btn.className = "tts-btn";
      btn.setAttribute("aria-label", "Antwort vorlesen");
      btn.setAttribute("title", "Vorlesen");
      btn.appendChild(createIcon("speaker"));

      btn.addEventListener("click", () => {
        if (speechSynthesis.speaking) {
          speechSynthesis.cancel();
          return;
        }
        const text = msg.textContent?.trim();
        if (!text) return;

        const utterance = new SpeechSynthesisUtterance(text.slice(0, 500));
        utterance.lang = document.documentElement.lang || "de-DE";
        speechSynthesis.speak(utterance);
      });

      const htmlMsg = /** @type {HTMLElement} */ (msg);
      htmlMsg.style.position = "relative";
      htmlMsg.append(btn);
    }
  };

  // Only observe the robot-companion area, not the entire body
  const observeTarget = document.querySelector(".robot-companion, [data-robot]") || document.body;
  new MutationObserver(addTTSButtons).observe(observeTarget, {
    childList: true,
    subtree: true,
  });
  log.debug("TTS ready");
}

// ─── 3C: Easter Eggs (Konami Code) ──────────────────────────────────
function initEasterEggs() {
  const KONAMI = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ];
  let idx = 0;

  document.addEventListener("keydown", e => {
    idx = e.key === KONAMI[idx] ? idx + 1 : 0;
    if (idx === KONAMI.length) {
      idx = 0;
      triggerMatrixRain();
    }
  });
}

function triggerMatrixRain() {
  if (document.querySelector(".matrix-rain")) {
    document.querySelector(".matrix-rain").remove();
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "matrix-rain";
  document.body.append(canvas);

  const ctx = canvas.getContext("2d");
  canvas.width = innerWidth;
  canvas.height = innerHeight;

  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*<>{}[]";
  const SIZE = 14;
  const cols = Math.floor(canvas.width / SIZE);
  const drops = Array.from({ length: cols }, () => Math.random() * -50);

  requestAnimationFrame(() => canvas.classList.add("active"));

  const draw = () => {
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${SIZE}px monospace`;

    for (let i = 0; i < drops.length; i++) {
      ctx.fillStyle =
        Math.random() > 0.96
          ? "#fff"
          : `hsl(${120 + Math.random() * 30},100%,${50 + Math.random() * 20}%)`;
      ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * SIZE, drops[i] * SIZE);
      if (drops[i] * SIZE > canvas.height && Math.random() > 0.98) drops[i] = 0;
      drops[i]++;
    }
  };

  const interval = setInterval(draw, 45);
  const dismiss = () => {
    canvas.classList.remove("active");
    setTimeout(() => {
      clearInterval(interval);
      canvas.remove();
    }, 500);
  };

  canvas.addEventListener("click", dismiss);
  setTimeout(dismiss, 8000);
  log.info("🐰 Matrix rain!");
}

// ═════════════════════════════════════════════════════════════════════
//  INIT
// ═════════════════════════════════════════════════════════════════════

/** Initialize all enhancements. Call after DOM is ready. */
export function initEnhancements() {
  try {
    // Phase 1
    initSectionDots();
    initRevealOnScroll();

    // Phase 2
    initSkillRadar();
    initSearchFilters();

    // Phase 3
    initVoiceInput();
    initTTS();
    initEasterEggs();

    log.info("Enhancements ready ✨");
  } catch (error) {
    log.error("Enhancement init failed:", error);
  }
}
