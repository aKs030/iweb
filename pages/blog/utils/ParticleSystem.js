/**
 * 3D Particle System for Blog Background
 * @version 1.0.0
 */

export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: 0, y: 0 };
    this.animationId = null;
    this.resize();
    this.init();
    this.setupEvents();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  init() {
    const particleCount = window.innerWidth < 768 ? 50 : 100;
    this.particles = [];

    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        z: Math.random() * 1000,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        vz: (Math.random() - 0.5) * 2,
        size: Math.random() * 2 + 1,
        color: this.getRandomColor(),
        alpha: Math.random() * 0.5 + 0.3,
      });
    }

    this._initGlowCache();
  }

  _initGlowCache() {
    this.glowCache = new Map();
    const colors = [
      'rgba(59, 130, 246, ',
      'rgba(139, 92, 246, ',
      'rgba(236, 72, 153, ',
      'rgba(16, 185, 129, ',
    ];
    colors.forEach((col) => {
      const cvs = document.createElement('canvas');
      cvs.width = 64;
      cvs.height = 64;
      const ctx = cvs.getContext('2d');
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, col + '0.5)');
      grad.addColorStop(1, col + '0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      this.glowCache.set(col, cvs);
    });
  }

  getRandomColor() {
    const colors = [
      'rgba(59, 130, 246, ',
      'rgba(139, 92, 246, ',
      'rgba(236, 72, 153, ',
      'rgba(16, 185, 129, ',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  setupEvents() {
    this._onMouseMove = (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    };

    this._onTouchMove = (e) => {
      if (e.touches && e.touches.length > 0) {
        this.mouse.x = e.touches[0].clientX;
        this.mouse.y = e.touches[0].clientY;
      }
    };

    this._onResize = () => {
      this.resize();
      this.init();
    };

    window.addEventListener('mousemove', this._onMouseMove, { passive: true });
    window.addEventListener('touchstart', this._onTouchMove, { passive: true });
    window.addEventListener('touchmove', this._onTouchMove, { passive: true });
    window.addEventListener('resize', this._onResize, { passive: true });
  }

  update() {
    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < 22500) {
        // 150*150
        const dist = Math.sqrt(distSq);
        const force = (150 - dist) / 150;
        p.vx -= (dx / dist) * force * 0.1;
        p.vy -= (dy / dist) * force * 0.1;
      }

      if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;
      if (p.z < 0 || p.z > 1000) p.vz *= -1;

      p.vx *= 0.99;
      p.vy *= 0.99;
      p.vz *= 0.99;
    });
  }

  draw() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
    this.ctx.lineWidth = 1;

    // Simple O(N^2) lookup is faster for N<=100 and creates zero GC compared to map-based cell grids
    const CONNECT_DIST = 150;
    const CONNECT_DIST_SQ = CONNECT_DIST * CONNECT_DIST;

    this.ctx.beginPath();
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const dx = this.particles[i].x - this.particles[j].x;
        const dy = this.particles[i].y - this.particles[j].y;
        const distSq = dx * dx + dy * dy;

        if (distSq < CONNECT_DIST_SQ) {
          const dist = Math.sqrt(distSq);
          this.ctx.globalAlpha = ((CONNECT_DIST - dist) / CONNECT_DIST) * 0.3;
          this.ctx.beginPath();
          this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
          this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
          this.ctx.stroke();
        }
      }
    }

    this.particles.forEach((p) => {
      const scale = 1000 / (1000 + p.z);
      const size = p.size * scale;
      const glowScale = size * 3;

      this.ctx.globalAlpha = p.alpha * scale;

      // Draw pre-rendered Glow instead of creating radialGradient each frame
      if (this.glowCache && this.glowCache.has(p.color)) {
        const glowImg = this.glowCache.get(p.color);
        this.ctx.drawImage(
          glowImg,
          p.x - glowScale,
          p.y - glowScale,
          glowScale * 2,
          glowScale * 2,
        );
      }

      // Draw Center Core
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color + p.alpha + ')';
      this.ctx.fill();
    });

    this.ctx.globalAlpha = 1;
  }

  animate() {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  start() {
    this.animate();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this._onMouseMove) {
      window.removeEventListener('mousemove', this._onMouseMove);
      this._onMouseMove = null;
    }
    if (this._onTouchMove) {
      window.removeEventListener('touchstart', this._onTouchMove);
      window.removeEventListener('touchmove', this._onTouchMove);
      this._onTouchMove = null;
    }
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this._onResize = null;
    }
  }
}
