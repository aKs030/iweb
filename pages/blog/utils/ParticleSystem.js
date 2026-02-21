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

    this._onResize = () => {
      this.resize();
      this.init();
    };

    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('resize', this._onResize);
  }

  update() {
    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 150) {
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

    // Grid-based spatial partitioning for O(n) neighbor lookup
    const CONNECT_DIST = 150;
    const cellSize = CONNECT_DIST;
    const grid = new Map();

    for (const p of this.particles) {
      const cx = Math.floor(p.x / cellSize);
      const cy = Math.floor(p.y / cellSize);
      const key = `${cx},${cy}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(p);
    }

    for (const [key, cell] of grid) {
      const [cx, cy] = key.split(',').map(Number);
      for (let dx = 0; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy < 0) continue;
          const neighborKey = `${cx + dx},${cy + dy}`;
          const neighbor = grid.get(neighborKey);
          if (!neighbor) continue;

          const isSameCell = dx === 0 && dy === 0;
          for (let i = 0; i < cell.length; i++) {
            const jStart = isSameCell ? i + 1 : 0;
            for (let j = jStart; j < neighbor.length; j++) {
              const ddx = cell[i].x - neighbor[j].x;
              const ddy = cell[i].y - neighbor[j].y;
              const dist = Math.sqrt(ddx * ddx + ddy * ddy);

              if (dist < CONNECT_DIST) {
                this.ctx.beginPath();
                this.ctx.moveTo(cell[i].x, cell[i].y);
                this.ctx.lineTo(neighbor[j].x, neighbor[j].y);
                this.ctx.globalAlpha =
                  ((CONNECT_DIST - dist) / CONNECT_DIST) * 0.3;
                this.ctx.stroke();
              }
            }
          }
        }
      }
    }

    this.particles.forEach((p) => {
      const scale = 1000 / (1000 + p.z);
      const size = p.size * scale;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color + p.alpha + ')';
      this.ctx.globalAlpha = p.alpha * scale;
      this.ctx.fill();

      const gradient = this.ctx.createRadialGradient(
        p.x,
        p.y,
        0,
        p.x,
        p.y,
        size * 3,
      );
      gradient.addColorStop(0, p.color + p.alpha * 0.5 + ')');
      gradient.addColorStop(1, p.color + '0)');
      this.ctx.fillStyle = gradient;
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
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this._onResize = null;
    }
  }
}
