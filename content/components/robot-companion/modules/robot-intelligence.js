export class RobotIntelligence {
  constructor(robot) {
    this.robot = robot;
    this.mouse = { x: 0, y: 0, lastX: 0, lastY: 0, speed: 0 };
    this.lastMoveTime = Date.now();

    this.setupListeners();
  }

  setupListeners() {
    // Passive listener for performance
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e), { passive: true });
  }

  handleMouseMove(e) {
    const now = Date.now();
    const dt = now - this.lastMoveTime;

    // Calculate speed every 100ms
    if (dt > 100) {
      const dist = Math.hypot(e.clientX - this.mouse.lastX, e.clientY - this.mouse.lastY);
      this.mouse.speed = dist / dt; // pixels per ms

      this.mouse.lastX = e.clientX;
      this.mouse.lastY = e.clientY;
      this.lastMoveTime = now;

      // High speed detection (> 3px/ms is very fast)
      if (this.mouse.speed > 3.5) {
        this.triggerHecticReaction();
      }
    }
  }

  triggerHecticReaction() {
    if (this.robot.chatModule.isOpen || Math.random() > 0.02) return; // Low chance to not annoy

    const texts = [
      "Whoa, nicht so schnell! 🏎️",
      "Alles okay? Du wirkst eilig! 💨",
      "Ich werde schwindelig... 😵‍💫",
      "Suchst du etwas Bestimmtes? 🔍"
    ];

    const text = texts[Math.floor(Math.random() * texts.length)];
    this.robot.chatModule.showBubble(text);
    setTimeout(() => this.robot.chatModule.hideBubble(), 2500);
  }
}
