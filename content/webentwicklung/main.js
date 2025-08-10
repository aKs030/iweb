// ===== Dynamic Imports + Fallbacks =====
let debounce = (fn, wait) => {
  // Fallback: no debouncing
  return function (...args) { return fn.apply(this, args); };
};
let throttle = (fn /*, limit */) => {
  // Fallback: no throttling
  return function (...args) { return fn.apply(this, args); };
};
let TypeWriter = null;
let makeLineMeasurer = null;
let quotes = [];

async function loadTypedModules() {
  try {
    const timing = await import('./typed/timing.js');
    debounce = timing.debounce || debounce;
    throttle = timing.throttle || throttle;
  } catch (e) { console.error('[typed] timing.js fehlgeschlagen:', e); }

  try {
    const mod = await import('./typed/TypeWriter.js');
    TypeWriter = mod.default || mod.TypeWriter || TypeWriter;
  } catch (e) { console.error('[typed] TypeWriter.js fehlgeschlagen:', e); }

  try {
    const lm = await import('./typed/lineMeasurer.js');
    makeLineMeasurer = lm.makeLineMeasurer || makeLineMeasurer;
  } catch (e) { console.error('[typed] lineMeasurer.js fehlgeschlagen:', e); }

  try {
    const q = await import('./typed/quotes-de.js');
    quotes = q.default || q.quotes || quotes;
  } catch (e) { console.error('[typed] quotes-de.js fehlgeschlagen:', e); }
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

// ===== Loader State =====
let __modulesReady = false;
let __windowLoaded = false;
let __loaderStart = 0;
const __MIN_LOADER_MS = 700; // Mindestanzeige, damit man den Loader sieht

// ===== Loading Screen (robust) =====
function hideLoadingScreen() {
  const el = document.getElementById('loadingScreen');
  if (!el) return;
  el.classList.add('hide');
  el.setAttribute('aria-hidden', 'true');
  // Hard inline styles als Fallback, falls CSS-Klasse fehlt
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  el.style.visibility = 'hidden';
  // Nach Transition endgültig aus dem Layout nehmen
  const remove = () => {
    el.style.display = 'none';
    el.removeEventListener('transitionend', remove);
  };
  el.addEventListener('transitionend', remove);
  setTimeout(remove, 700); // Fallback, falls keine Transition feuert
}

// ===== Main =====
document.addEventListener('DOMContentLoaded', async () => {
  // Loading screen: sichtbar lassen, bis Module + window load fertig sind
  __loaderStart = performance.now();

  function tryHideLoader() {
    // nur schließen, wenn Module geladen
    if (!__modulesReady) return;
    // warte bis window "load" oder readyState complete (Assets geladen)
    if (!__windowLoaded && document.readyState !== 'complete') return;
    const elapsed = performance.now() - __loaderStart;
    const wait = Math.max(0, __MIN_LOADER_MS - elapsed);
    setTimeout(hideLoadingScreen, wait);
  }

  window.addEventListener('load', () => { __windowLoaded = true; tryHideLoader(); });

  // Module laden (dynamisch). Wenn fertig, erneut prüfen.
  await loadTypedModules();
  __modulesReady = true;
  tryHideLoader();

  // Hard fallback, falls irgendwas schiefgeht
  setTimeout(hideLoadingScreen, 5000);

  // Prevent overscroll/bounce NUR am ersten Snap und letzten (Footer)
  (function () {
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
      return window.scrollY <= top + 1;
    }
    function atBottomOfLast() {
      const { last } = getSnapBounds();
      const lastTop = last?.offsetTop || 0;
      const lastBottom = lastTop + (last?.offsetHeight || 0);
      const viewBottom = window.scrollY + window.innerHeight;
      return viewBottom >= lastBottom - 1;
    }
    // Desktop
    window.addEventListener('wheel', (e) => {
      const dy = e.deltaY;
      if ((dy < 0 && atTopOfFirst()) || (dy > 0 && atBottomOfLast())) e.preventDefault();
    }, { passive: false });
    // Touch
    let startY = 0;
    window.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      const y = e.touches[0].clientY;
      const goingDown = y > startY;
      const goingUp   = y < startY;
      if ((goingDown && atTopOfFirst()) || (goingUp && atBottomOfLast())) e.preventDefault();
    }, { passive: false });
  })();

  // ===== Typing initialisieren (ausgelagert) =====
  const subtitleEl  = document.querySelector('.hero-subtitle');
  const typedText   = document.getElementById('typedText');
  const typedAuthor = document.getElementById('typedAuthor');

  if (subtitleEl && typedText && typedAuthor && TypeWriter && makeLineMeasurer) {
    const measurer = makeLineMeasurer(subtitleEl);

    const startTypewriter = () => {
      new TypeWriter({
        textEl: typedText,
        authorEl: typedAuthor,
        quotes,
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

  // Performance: Scroll-Handler (nach geladener timing.js)
  window.addEventListener('scroll', debounce(handleScrollEvents, 75));

  // Smooth Anchor Scroll
  initSmoothScroll();

  // AOS-Delays
  document.querySelectorAll('[data-aos]').forEach((el, idx) => {
    if (!el.hasAttribute('data-aos-delay')) el.setAttribute('data-aos-delay', idx * 50);
  });

  // Menü dynamisch nachladen
  loadMenuAssets();
});