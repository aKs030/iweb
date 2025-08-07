// ===== Debounce & Throttle =====
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
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

// ===== Typed Text Animation =====
class TypeWriter {
  constructor(textElement, authorElement, quotes, wait = 3000) {
    this.textElement = textElement;
    this.authorElement = authorElement;
    this.quotes = quotes;
    this.wait = parseInt(wait, 10);
    this.previousIndex = -1;
    this.currentQuote = this.getRandomQuote();
    this.txt = '';
    this.isDeleting = false;
    this.type();
  }

  getRandomQuote() {
    let index;
    do {
      index = Math.floor(Math.random() * this.quotes.length);
    } while (index === this.previousIndex && this.quotes.length > 1);
    this.previousIndex = index;
    return this.quotes[index];
  }

  type() {
    const fullTxt = this.currentQuote.text;
    const author = this.currentQuote.author;

    this.txt = this.isDeleting
      ? fullTxt.substring(0, this.txt.length - 1)
      : fullTxt.substring(0, this.txt.length + 1);

    this.textElement.innerHTML = this.txt.replace(/,\s*/g, ',<br>');
    this.authorElement.textContent = author;

    let typeSpeed = this.isDeleting ? 40 : 80;

    if (!this.isDeleting && this.txt === fullTxt) {
      typeSpeed = this.wait;
      this.isDeleting = true;
    } else if (this.isDeleting && this.txt === '') {
      this.isDeleting = false;
      this.currentQuote = this.getRandomQuote();
      typeSpeed = 600;
    }

    setTimeout(() => this.type(), typeSpeed);
  }
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
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
  }
  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    // Connections
    particles.forEach((p, i) => {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = p.x - particles[j].x, dy = p.y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
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

// ===== Greeting Time-based =====
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
    do {
      random = set[Math.floor(Math.random() * set.length)];
    } while (random === el.dataset.last);
  }
  el.dataset.last = random;
  if (animated) {
    el.classList.add('fade');
    setTimeout(() => {
      el.textContent = random;
      el.classList.remove('fade');
    }, 400);
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
    setTimeout(() => {
      card.style.opacity = '1';
      card.style.transform = 'scale(1)';
    }, 10);
  }
  function hideCard(card) {
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    setTimeout(() => {
      card.style.display = 'none';
    }, 300);
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
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ===== Scroll Animations =====
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
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('aos-animate');
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('[data-aos]').forEach(el => observer.observe(el));
}

// ===== Dynamisches Laden von Menü-Styles und Menü-Script =====
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
  setTimeout(() => {
    loadingScreen?.classList.add('hide');
  }, 500);
}

// ===== Main Initialization =====
document.addEventListener('DOMContentLoaded', () => {
  // Loading screen (muss früh raus)
  window.addEventListener('load', initLoadingScreen);

  // Typewriter
const typedText = document.getElementById('typedText');
const typedAuthor = document.getElementById('typedAuthor');

if (typedText && typedAuthor) {
  new TypeWriter(typedText, typedAuthor, [
    { author: "Rumi", text: "Der Schmerz reinigt das Herz." },
    { author: "Nietzsche", text: "Wer ein Warum zum Leben hat, erträgt fast jedes Wie." },
    { author: "Konfuzius", text: "Der Weg ist das Ziel." },
    { author: "Goethe", text: "Auch aus Steinen, die einem in den Weg gelegt werden, kann man Schönes bauen." },
    { author: "aKs", text: "Das Licht ist nicht laut – es überzeugt durch Klarheit." }
  ]);
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

  // Add animation delays
  document.querySelectorAll('[data-aos]').forEach((element, index) => {
    if (!element.hasAttribute('data-aos-delay')) {
      element.setAttribute('data-aos-delay', index * 50);
    }
  });

  // Menü dynamisch nachladen
  loadMenuAssets();
});

// Performance-Optimierungen: global scroll & resize
window.addEventListener('scroll', debounce(handleScrollEvents, 75));