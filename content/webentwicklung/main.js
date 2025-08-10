// ===== Utils: Debounce & Throttle =====
function debounce(func, wait) {
  let timeout;
  function debounced(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  }
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
}

function throttle(func, limit) {
  let inThrottle;
  return function () {
    if (!inThrottle) {
      func.apply(this, arguments);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Export for testing (optional)
if (typeof module !== 'undefined') {
  module.exports = { debounce, throttle };
}

// ===== TypeWriter (mit Reservierung VOR dem Tippen + Lock) =====
class TypeWriter {
  constructor({
    textEl,
    authorEl,
    quotes,
    wait = 2400,
    typeSpeed = 85,
    deleteSpeed = 40,
    shuffle = true,
    loop = true,
    smartBreaks = true,
    containerEl = null,          // .hero-subtitle zum Locken
    onBeforeType = null          // Hook: vor dem Tippen reservieren + locken
  }) {
    if (!textEl || !authorEl || !Array.isArray(quotes) || quotes.length === 0) return;
    this.textEl = textEl;
    this.authorEl = authorEl;
    this.quotes = quotes.slice();
    this.wait = +wait;
    this.typeSpeed = +typeSpeed;
    this.deleteSpeed = +deleteSpeed;
    this.shuffle = !!shuffle;
    this.loop = !!loop;
    this.smartBreaks = !!smartBreaks;
    this.containerEl = containerEl;
    this.onBeforeType = typeof onBeforeType === 'function' ? onBeforeType : null;

    this._timer = null;
    this._isDeleting = false;
    this._txt = '';
    this._queue = this.shuffle ? this._shuffledIndices(this.quotes.length) : [...Array(this.quotes.length).keys()];
    this._index = this._queue.shift();
    this._current = this.quotes[this._index];

    // CSS-Fallback ausschalten
    document.body.classList.add('has-typingjs');

    // Vor dem ersten Tippen reservieren + locken
    if (this.onBeforeType) this.onBeforeType(this._current.text);

    this._tick();
  }

  destroy() {
    this._clearTimer();
    document.body.classList.remove('has-typingjs');
  }

  _shuffledIndices(n) {
    const arr = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  _nextQuote() {
    if (this._queue.length === 0) {
      if (!this.loop) return null;
      this._queue = this.shuffle ? this._shuffledIndices(this.quotes.length) : [...Array(this.quotes.length).keys()];
    }
    this._index = this._queue.shift();
    this._current = this.quotes[this._index];
    return this._current;
  }

  _schedule(ms) { this._timer = setTimeout(() => this._tick(), ms); }
  _clearTimer() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } }

  _renderText(text) {
    // smartBreaks: ", " → Komma behalten + <br>
    this.textEl.textContent = '';
    if (!this.smartBreaks) {
      this.textEl.textContent = text;
      return;
    }
    const parts = String(text).split(/(, )/);
    for (const part of parts) {
      if (part === ', ') {
        this.textEl.appendChild(document.createTextNode(','));
        this.textEl.appendChild(document.createElement('br'));
      } else {
        this.textEl.appendChild(document.createTextNode(part));
      }
    }
  }

  _tick() {
    const full = String(this._current.text || '');
    const author = String(this._current.author || '');

    this._txt = this._isDeleting
      ? full.substring(0, Math.max(0, this._txt.length - 1))
      : full.substring(0, Math.min(full.length, this._txt.length + 1));

    this._renderText(this._txt);
    this.authorEl.textContent = author;

    let delay = this._isDeleting ? this.deleteSpeed : this.typeSpeed;
    if (!this._isDeleting && this._txt.length > 0) {
      const ch = this._txt[this._txt.length - 1];
      const punctPause = { ',': 120, '.': 300, '…': 400, '!': 250, '?': 250, ';': 180, ':': 180 };
      if (punctPause[ch]) delay += punctPause[ch];
    }

    if (!this._isDeleting && this._txt === full) {
      delay = this.wait;
      this._isDeleting = true;
    } else if (this._isDeleting && this._txt === '') {
      this._isDeleting = false;
      // Lock entfernen; nächste Quote wird im onBeforeType neu gelockt
      if (this.containerEl) this.containerEl.classList.remove('is-locked');

      const next = this._nextQuote();
      if (!next) { this.destroy(); return; }

      if (this.onBeforeType) this.onBeforeType(next.text);
      delay = 600;
    }

    this._clearTimer();
    this._schedule(delay);
  }
}

// ===== Mess-Utility: Höhe VOR dem Tippen bestimmen =====
function makeLineMeasurer(subtitleEl) {
  const measurer = document.createElement('div');
  measurer.style.cssText = [
    'position:absolute','left:-9999px','top:0','visibility:hidden',
    'white-space:normal','pointer-events:none'
  ].join(';');
  document.body.appendChild(measurer);

  const cs = getComputedStyle(subtitleEl);
  ['font-size','line-height','font-family','font-weight','letter-spacing','word-spacing']
    .forEach(p => measurer.style.setProperty(p, cs.getPropertyValue(p)));

  function getLineHeightPx(){
    const lhRaw = cs.lineHeight.trim();
    if (lhRaw.endsWith('px')) {
      const v = parseFloat(lhRaw); if (!isNaN(v)) return v;
    }
    const num = parseFloat(lhRaw);
    if (!isNaN(num)) {
      const fsRaw = cs.fontSize.trim();
      const fs = parseFloat(fsRaw);
      if (!isNaN(fs)) return num * fs;
    }
    measurer.innerHTML = '';
    const one = document.createElement('span');
    one.textContent = 'A';
    one.style.display = 'inline-block';
    measurer.appendChild(one);
    const h = one.getBoundingClientRect().height;
    return h || 0;
  }

  function measure(text, smartBreaks){
    measurer.innerHTML = '';
    const span = document.createElement('span');
    if (smartBreaks){
      const parts = String(text).split(/(, )/);
      for (const part of parts){
        if (part === ', '){
          span.appendChild(document.createTextNode(','));
          span.appendChild(document.createElement('br'));
        } else {
          span.appendChild(document.createTextNode(part));
        }
      }
    } else {
      span.textContent = String(text);
    }
    measurer.appendChild(span);

    // echte verfügbare Breite ab linker Kante + Cap wie im CSS
    const rect = subtitleEl.getBoundingClientRect();
    const left = rect.left || 0;
    const safeMargin = 12;
    const available = Math.max(0, window.innerWidth - left - safeMargin);
    const cap = Math.min(window.innerWidth * 0.92, 820);
    const width = Math.max(1, Math.min(available || cap, cap));
    measurer.style.width = width + 'px';

    const lh = getLineHeightPx();
    const h  = span.getBoundingClientRect().height;
    if (!lh || !h) return 1;
    return Math.max(1, Math.min(3, Math.round(h / lh))); // clamp 1..3
  }

  return {
    reserveFor(text, smartBreaks = true){
      const lh = getLineHeightPx();
      subtitleEl.style.setProperty('--lh-px', lh ? `${lh}px` : '0px');
      subtitleEl.style.setProperty('--gap-px', lh ? `${(lh * 0.25)}px` : '0px');
      const lines = measure(text, smartBreaks);
      subtitleEl.style.setProperty('--lines', String(lines));
      subtitleEl.setAttribute('data-lines', String(lines));
      return lines;
    }
  };
}

// ===== Particles =====
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animationId;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 1;
      this.speedX = Math.random() * 2 - 1;
      this.speedY = Math.random() * 2 - 1;
      this.opacity = Math.random() * 0.5 + 0.2;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x > canvas.width || this.x < 0) this.speedX *= -1;
      if (this.y > canvas.height || this.y < 0) this.speedY *= -1;
    }
    draw() {
      ctx.fillStyle = `rgba(9, 139, 255, ${this.opacity})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function createParticles() {
    particles = [];
    const particleCount = Math.min(100, window.innerWidth / 10);
    for (let i = 0; i < particleCount; i++) particles.push(new Particle());
  }
  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    // Connections
    particles.forEach((p, i) => {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = p.x - particles[j].x, dy = p.y - particles[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 100) {
          ctx.strokeStyle = `rgba(9,139,255,${0.1 * (1 - dist / 100)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    });
    animationId = requestAnimationFrame(animateParticles);
  }
  resizeCanvas();
  createParticles();
  animateParticles();
  window.addEventListener('resize', throttle(() => {
    cancelAnimationFrame(animationId);
    resizeCanvas();
    createParticles();
    animateParticles();
  }, 250));
}

// ===== Greeting (Zeit-basiert) =====
const greetings = {
  morning: [
    "Guten Morgen und willkommen auf meiner Website!",
    "Schön, dass du früh vorbeischaust!",
    "Moin! Entdecke meine Projekte.",
    "Einen erfolgreichen Start in den Tag!"
  ],
  day: [
    "Herzlich willkommen auf meiner Website!",
    "Schön, dass du hier bist!",
    "Willkommen – viel Spaß beim Stöbern!",
    "Entdecke meine Arbeiten und Projekte!"
  ],
  evening: [
    "Guten Abend und willkommen auf meiner Website!",
    "Schön, dass du abends reinschaust!",
    "Genieße den Abend und viel Spaß auf meiner Seite!",
    "Einen entspannten Abend wünsche ich dir!"
  ],
  night: [
    "Schön, dass du nachts hier bist – willkommen!",
    "Gute Nacht und viel Spaß beim Stöbern!",
    "Späte Besucher sind die besten Besucher!",
    "Willkommen zu später Stunde auf meiner Website!"
  ]
};
function getGreetingSet() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11)  return greetings.morning;
  if (hour >= 11 && hour < 17) return greetings.day;
  if (hour >= 17 && hour < 22) return greetings.evening;
  return greetings.night;
}
function setRandomGreetingHTML(animated = false) {
  const el = document.getElementById('greetingText');
  if (!el) return;
  const set = getGreetingSet();
  let random = set[Math.floor(Math.random() * set.length)];
  if (set.length > 1 && el.dataset.last === random) {
    do { random = set[Math.floor(Math.random() * set.length)]; }
    while (random === el.dataset.last);
  }
  el.dataset.last = random;
  if (animated) {
    el.classList.add('fade');
    setTimeout(() => { el.textContent = random; el.classList.remove('fade'); }, 400);
  } else {
    el.textContent = random;
  }
}

// ===== Project Filter =====
function initProjectFilter() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      const filter = button.getAttribute('data-filter');
      projectCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filter === 'all' || category === filter) showCard(card);
        else hideCard(card);
      });
    });
  });
  const activeBtn = document.querySelector('.filter-btn.active') || filterButtons[0];
  if (activeBtn) activeBtn.click();
  function showCard(card) {
    card.style.display = 'block';
    setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'scale(1)'; }, 10);
  }
  function hideCard(card) {
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    setTimeout(() => { card.style.display = 'none'; }, 300);
  }
}

// ===== Smooth Scroll for Anchor Links =====
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const offset = 80;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      }
    });
  });
}

// ===== Scroll Animations & BackToTop =====
function handleScrollEvents() {
  const backToTopBtn = document.getElementById('backToTop');
  if (backToTopBtn) {
    if (window.pageYOffset > 300) backToTopBtn.classList.add('show');
    else backToTopBtn.classList.remove('show');
  }
}
function initScrollAnimations() {
  const backToTopBtn = document.getElementById('backToTop');
  backToTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('aos-animate'); });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('[data-aos]').forEach(el => observer.observe(el));
}

// ===== Menü-Assets =====
function loadMenuAssets() {
  if (!document.getElementById('menu-container')) return;
  if (!document.querySelector('link[href="/content/webentwicklung/menu/menu.css"]')) {
    const menuCss = document.createElement('link');
    menuCss.rel = 'stylesheet';
    menuCss.href = '/content/webentwicklung/menu/menu.css';
    document.head.appendChild(menuCss);
  }
  if (!document.querySelector('script[src="/content/webentwicklung/menu/menu.js"]')) {
    const menuScript = document.createElement('script');
    menuScript.src = '/content/webentwicklung/menu/menu.js';
    menuScript.defer = true;
    document.body.appendChild(menuScript);
  }
}

// ===== Loading Screen =====
function initLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  setTimeout(() => { loadingScreen?.classList.add('hide'); }, 500);
}

// ===== Main =====
document.addEventListener('DOMContentLoaded', () => {
  // Loading screen
  window.addEventListener('load', initLoadingScreen);

// Prevent overscroll/bounce ONLY am ersten Snap (Home) und letzten (Footer)
(function () {
  // Grenzen bestimmen: erstes .section (oder #hero), letztes .section, Footer bevorzugen
  function getSnapBounds() {
    const sections = Array.from(document.querySelectorAll('.section'));
    let first = sections[0] || document.querySelector('#hero') || document.body;
    let last  = sections[sections.length - 1] || document.querySelector('footer') || document.body;
    const realFooter = document.querySelector('footer');
    if (realFooter) last = realFooter;
    return { first, last };
  }

  function atTopOfFirst() {
    const { first } = getSnapBounds();
    const top = Math.max(0, first?.offsetTop || 0);
    return window.scrollY <= top + 1; // 1px Toleranz
  }

  function atBottomOfLast() {
    const { last } = getSnapBounds();
    const lastTop = last?.offsetTop || 0;
    const lastBottom = lastTop + (last?.offsetHeight || 0);
    const viewBottom = window.scrollY + window.innerHeight;
    return viewBottom >= lastBottom - 1; // 1px Toleranz
  }

  // Desktop (Mausrad / Trackpad): nur an den Rändern blockieren
  window.addEventListener('wheel', (e) => {
    const dy = e.deltaY;
    if ((dy < 0 && atTopOfFirst()) || (dy > 0 && atBottomOfLast())) {
      e.preventDefault();
    }
  }, { passive: false });

  // Touch (Mobile/iOS): Bounce an den Rändern verhindern
  let startY = 0;
  window.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    const y = e.touches[0].clientY;
    const goingDown = y > startY; // Finger runter => Scroll nach oben
    const goingUp   = y < startY; // Finger rauf   => Scroll nach unten
    if ((goingDown && atTopOfFirst()) || (goingUp && atBottomOfLast())) {
      e.preventDefault();
    }
  }, { passive: false });
})();

  const subtitleEl = document.querySelector('.hero-subtitle');
  const typedText  = document.getElementById('typedText');
  const typedAuthor= document.getElementById('typedAuthor');

  if (subtitleEl && typedText && typedAuthor) {
    const measurer = makeLineMeasurer(subtitleEl);

    const startTypewriter = () => {
      new TypeWriter({
        textEl: typedText,
        authorEl: typedAuthor,
        quotes: [
          { author: 'Rumi',      text: 'Der Schmerz reinigt das Herz.' },
          { author: 'Nietzsche', text: 'Wer ein Warum zum Leben hat, erträgt fast jedes Wie.' },
          { author: 'Konfuzius', text: 'Der Weg ist das Ziel.' },
          { author: 'Goethe',    text: 'Auch aus Steinen, die einem in den Weg gelegt werden, kann man Schönes bauen.' },
          { author: 'aKs',       text: 'Das Licht ist nicht laut, es überzeugt durch Klarheit.' }
        ],
        wait: 2400,
        typeSpeed: 85,
        deleteSpeed: 40,
        shuffle: true,
        loop: true,
        smartBreaks: true,
        containerEl: subtitleEl,
onBeforeType: (fullText) => {
  const lines = measurer.reserveFor(fullText, true);
  const cs  = getComputedStyle(subtitleEl);
  const lh  = parseFloat(cs.getPropertyValue('--lh-px')) || 0;
  const gap = parseFloat(cs.getPropertyValue('--gap-px')) || 0;
  const boxH = (1 * lh) + (lines * lh) + gap; // 1 Autorzeile + N Quotezeilen + 1x Abstand
  subtitleEl.style.setProperty('--box-h', `${boxH}px`);
}
      });
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(startTypewriter);
    } else {
      startTypewriter();
    }
  }

  // Greeting
  setRandomGreetingHTML();

  // Particles
  initParticles();

  // Project-Filter
  initProjectFilter();

  // Scroll / Intersection / BackToTop
  initScrollAnimations();

  // Smooth Anchor Scroll
  initSmoothScroll();

  // AOS-Delays
  document.querySelectorAll('[data-aos]').forEach((el, idx) => {
    if (!el.hasAttribute('data-aos-delay')) el.setAttribute('data-aos-delay', idx * 50);
  });

  // Menü dynamisch nachladen
  loadMenuAssets();
});

// Performance: Scroll-Handler
window.addEventListener('scroll', debounce(handleScrollEvents, 75));
