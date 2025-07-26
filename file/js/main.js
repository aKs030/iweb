// js/main.js - Hauptfunktionalität für die optimierte Homepage

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
    new TypeWriter(typedElement, texts);
  }
});

// ===== Greeting Time-based =====
function updateGreeting() {
  const greetingElement = document.getElementById('greeting');
  if (!greetingElement) return;
  
  const hour = new Date().getHours();
  let greeting = 'Hallo, ich bin';
  
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
        
        // Count animation for stats
        if (entry.target.classList.contains('stat-number')) {
          countUp(entry.target);
        }
      }
    });
  }, observerOptions);
  
  // Observe all elements with data-aos attribute
  document.querySelectorAll('[data-aos]').forEach(element => {
    observer.observe(element);
  });
  
  // Observe stat numbers
  document.querySelectorAll('.stat-number').forEach(element => {
    observer.observe(element);
  });
}

// ===== Count Up Animation =====
function countUp(element) {
  const target = parseInt(element.getAttribute('data-count'));
  const duration = 2000;
  const increment = target / (duration / 16);
  let current = 0;
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    element.textContent = Math.floor(current);
  }, 16);
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
          card.style.display = 'block';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
          }, 10);
        } else {
          card.style.opacity = '0';
          card.style.transform = 'scale(0.8)';
          setTimeout(() => {
            card.style.display = 'none';
          }, 300);
        }
      });
    });
  });
}

// ===== Form Handling =====
function initForms() {
  // Contact Form
  const contactForm = document.getElementById('contactForm');
  const formStatus = document.getElementById('formStatus');
  
  contactForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(contactForm);
    const data = Object.fromEntries(formData);
    
    // Show loading state
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Wird gesendet...</span>';
    submitBtn.disabled = true;
    
    try {
      // Simulate API call (replace with actual endpoint)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Show success message
      formStatus.className = 'form-status success';
      formStatus.textContent = 'Nachricht erfolgreich gesendet! Ich melde mich bald bei dir.';
      formStatus.style.display = 'block';
      
      // Reset form
      contactForm.reset();
    } catch (error) {
      // Show error message
      formStatus.className = 'form-status error';
      formStatus.textContent = 'Etwas ist schiefgelaufen. Bitte versuche es später erneut.';
      formStatus.style.display = 'block';
    } finally {
      // Restore button
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
  
  // Newsletter Form
  const newsletterForm = document.getElementById('newsletterForm');
  
  newsletterForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = e.target.querySelector('input[type="email"]').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    // Show loading state
    submitBtn.disabled = true;
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Show success (replace with actual feedback)
      alert('Erfolgreich zum Newsletter angemeldet!');
      e.target.reset();
    } catch (error) {
      alert('Fehler bei der Newsletter-Anmeldung.');
    } finally {
      submitBtn.disabled = false;
    }
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

// ===== Menü dynamisch laden =====
document.addEventListener('DOMContentLoaded', () => {
  // Optimierte Fallback-Logik für menu.html
  function loadMenuHtml() {
    return fetch('/menu.html')
      .then(response => {
        if (response.ok) return response.text();
        // Fallback auf menu.html im Root
        return fetch('/menu.html').then(res => {
          if (res.ok) return res.text();
          throw new Error('menu.html konnte nicht geladen werden!');
        });
      });
  }
  loadMenuHtml()
    .then(html => {
      const menuContainer = document.getElementById('menu-container');
      if (menuContainer) {
        menuContainer.innerHTML = html;
        // Menü-Skript nachladen, damit Event-Handler funktionieren
        if (!document.querySelector('script[src="file/js/menu.js"]')) {
          const script = document.createElement('script');
          script.src = 'file/js/menu.js';
          script.onload = () => {
            // Warten, bis die Klasse im globalen Scope verfügbar ist
            let tries = 0;
            function tryInitMenuSystem() {
              if (typeof window.MenuSystem === 'function' || typeof window.MenuSystem === 'object' || typeof MenuSystem === 'function') {
                if (typeof MenuSystem === 'function') {
                  new MenuSystem();
                }
                return;
              }
              if (tries < 10) {
                tries++;
                setTimeout(tryInitMenuSystem, 50);
              } else {
                console.error('MenuSystem konnte nicht initialisiert werden!');
              }
            }
            tryInitMenuSystem();
          };
          document.body.appendChild(script);
        }
      }
    })
    .catch(error => {
      console.error('Fehler beim Laden des Menüs:', error);
    });
});

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