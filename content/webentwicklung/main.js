
// ===== Loading Screen =====
window.addEventListener('load', () => {
  const loadingScreen = document.getElementById('loadingScreen');
  setTimeout(() => {
    loadingScreen.classList.add('hide');
  }, 500);
});

// ===== Typed Text Animation =====
class TypeWriter {
  constructor(element, texts, wait = 3000) {
    this.element = element;
    this.texts = texts;
    this.wait = parseInt(wait, 10);
    this.textIndex = 0;
    this.txt = '';
    this.isDeleting = false;
    this.type();
  }

  type() {
    const current = this.textIndex % this.texts.length;
    const fullTxt = this.texts[current];

    if (this.isDeleting) {
      this.txt = fullTxt.substring(0, this.txt.length - 1);
    } else {
      this.txt = fullTxt.substring(0, this.txt.length + 1);
    }

    this.element.textContent = this.txt;

    let typeSpeed = 100;
    if (this.isDeleting) typeSpeed /= 2;

    if (!this.isDeleting && this.txt === fullTxt) {
      typeSpeed = this.wait;
      this.isDeleting = true;
    } else if (this.isDeleting && this.txt === '') {
      this.isDeleting = false;
      this.textIndex++;
      typeSpeed = 500;
    }

    setTimeout(() => this.type(), typeSpeed);
  }
}

// Initialize Typed Text
document.addEventListener('DOMContentLoaded', () => {
  const typedElement = document.getElementById('typedText');
  if (typedElement) {
    const texts = [
      'Full-Stack Developer',
      'UI/UX Designer',
      'Fotografie-Enthusiast',
      'Game Developer',
      'Kreativer Denker'
    ];
    // TypeWriter wird nur zur Initialisierung verwendet, keine weitere Nutzung nötig
    new TypeWriter(typedElement, texts);
  }
});

// ===== Greeting Time-based =====
function updateGreeting() {
  const greetingElement = document.getElementById('greeting');
  if (!greetingElement) return;
  
  const hour = new Date().getHours();
  let greeting;
  if (hour >= 5 && hour < 12) {
    greeting = 'Guten Morgen, ich bin';
  } else if (hour >= 12 && hour < 18) {
    greeting = 'Guten Tag, ich bin';
  } else if (hour >= 18 && hour < 22) {
    greeting = 'Guten Abend, ich bin';
  } else {
    greeting = 'Hallo, ich bin';
  }
  greetingElement.textContent = greeting;
}

updateGreeting();

// ===== Particle Animation =====
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
      
      if (this.x > canvas.width || this.x < 0) {
        this.speedX = -this.speedX;
      }
      if (this.y > canvas.height || this.y < 0) {
        this.speedY = -this.speedY;
      }
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
    
    particles.forEach(particle => {
      particle.update();
      particle.draw();
    });
    
    // Draw connections
    particles.forEach((particle, i) => {
      particles.slice(i + 1).forEach(otherParticle => {
        const dx = particle.x - otherParticle.x;
        const dy = particle.y - otherParticle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 100) {
          ctx.strokeStyle = `rgba(9, 139, 255, ${0.1 * (1 - distance / 100)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(otherParticle.x, otherParticle.y);
          ctx.stroke();
        }
      });
    });
    
    animationId = requestAnimationFrame(animateParticles);
  }
  
  resizeCanvas();
  createParticles();
  animateParticles();
  
  window.addEventListener('resize', () => {
    cancelAnimationFrame(animationId);
    resizeCanvas();
    createParticles();
    animateParticles();
  });
}

initParticles();

// ===== Scroll Animations =====
function initScrollAnimations() {
  // Back to Top Button
  const backToTopBtn = document.getElementById('backToTop');
  
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
      backToTopBtn?.classList.add('show');
    } else {
      backToTopBtn?.classList.remove('show');
    }
  });
  
  backToTopBtn?.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
  
  // AOS-like animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('aos-animate');
      }
    });
  }, observerOptions);
  
  // Observe all elements with data-aos attribute
  document.querySelectorAll('[data-aos]').forEach(element => {
    observer.observe(element);
  });
  
}


// ===== Project Filter =====
function initProjectFilter() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');
  
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Update active button
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      const filter = button.getAttribute('data-filter');
      // Filter projects
      projectCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filter === 'all' || category === filter) {
          showCard(card);
        } else {
          hideCard(card);
        }
      });
    });
  });
  // Hilfsfunktionen für Animationen
  function showCard(card) {
    card.style.display = 'block';
    setTimeout(() => {
      card.style.opacity = '1';
      card.style.transform = 'scale(1)';
    }, 10);
  }
  function hideCard(card) {
    card.style.opacity = '0';
    card.style.transform = 'scale(0.8)';
    setTimeout(() => {
      card.style.display = 'none';
    }, 300);
  }
}

// ===== Form Handling =====
function initForms() {
  // Contact Form
  const contactForm = document.getElementById('contactForm');
  const formStatus = document.getElementById('formStatus');
  
  contactForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Show loading state
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Wird gesendet...</span>';
    submitBtn.disabled = true;
    // Simulate API call (replace with actual endpoint)
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Show success message
    formStatus.className = 'form-status success';
    formStatus.textContent = 'Nachricht erfolgreich gesendet! Ich melde mich bald bei dir.';
    formStatus.style.display = 'block';
    // Reset form
    contactForm.reset();
    // Restore button
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  });
  
  // Newsletter Form
  const newsletterForm = document.getElementById('newsletterForm');
  
  newsletterForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    // Show loading state
    submitBtn.disabled = true;
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Show success (replace with actual feedback)
    alert('Erfolgreich zum Newsletter angemeldet!');
    e.target.reset();
    submitBtn.disabled = false;
  });
}

// ===== Smooth Scroll for Anchor Links =====
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      
      if (target) {
        const offset = 80; // Header height
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ===== Initialize Everything =====
document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  initProjectFilter();
  initForms();
  initSmoothScroll();
  
  // Add animation delays
  document.querySelectorAll('[data-aos]').forEach((element, index) => {
    if (!element.hasAttribute('data-aos-delay')) {
      element.setAttribute('data-aos-delay', index * 50);
    }
  });
});

// ===== Performance Optimization =====
// Debounce function for scroll events
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function for resize events
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Apply optimizations
window.addEventListener('scroll', debounce(() => {
  // Scroll-based animations
}, 10));

window.addEventListener('resize', throttle(() => {
  // Resize-based updates
}, 250));

// ===== Dynamisches Laden von Menü-Styles und Menü-Script =====
function loadMenuAssets() {
  // Menü-CSS laden
  if (!document.querySelector('link[href="/content/webentwicklung/menu/menu.css"]')) {
    const menuCss = document.createElement('link');
    menuCss.rel = 'stylesheet';
    menuCss.href = '/content/webentwicklung/menu/menu.css';
    document.head.appendChild(menuCss);
  }
  // Menü-JS laden
  if (!document.querySelector('script[src="/content/webentwicklung/menu/menu.js"]')) {
    const menuScript = document.createElement('script');
    menuScript.src = '/content/webentwicklung/menu/menu.js';
    menuScript.defer = true;
    document.body.appendChild(menuScript);
  }
}

document.addEventListener('DOMContentLoaded', loadMenuAssets);

// ===== Update Input File for SCM =====

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

// Initial anzeigen:
setRandomGreetingHTML();
let scrollTimeout = null;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => setRandomGreetingHTML(true), 100);
});


// ===== Update Input File for SCM =====

document.addEventListener('DOMContentLoaded', () => {
  const sections = [...document.querySelectorAll('.section, article')];
  let isScrolling = false;
  let scrollTimeout;

  const getCurrentIndex = () => {
    const midpoint = window.innerHeight / 2;
    let bestIndex = 0;
    let minDistance = Infinity;

    sections.forEach((section, i) => {
      const { top, height } = section.getBoundingClientRect();
      const center = top + height / 2;
      const distance = Math.abs(center - midpoint);
      if (distance < minDistance) {
        minDistance = distance;
        bestIndex = i;
      }
    });

    return bestIndex;
  };

  const scrollToIndex = (index) => {
    if (!sections[index]) return;

    isScrolling = true;
    clearTimeout(scrollTimeout);

    window.scrollTo({
      top: sections[index].offsetTop,
      behavior: 'smooth'
    });

    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, 800);
  };

  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, 150);
  });

  window.addEventListener(
    'wheel',
    (e) => {
      if (isScrolling) return;

      const current = getCurrentIndex();
      const direction = e.deltaY > 0 ? 1 : -1;
      let target = current + direction;

      // Begrenzung auf gültigen Bereich
      if (target >= 0 && target < sections.length) {
        e.preventDefault(); // verhindert natives Scrollen
        scrollToIndex(target);
      }
    },
    { passive: false }
  );
});