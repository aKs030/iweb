/**
 * Robot Emotions Module
 * Handles facial expressions, gestures, and particle effects
 * @version 1.0.0
 */

export class RobotEmotions {
  constructor(robot) {
    this.robot = robot;
  }

  /**
   * Set mouth expression
   * @param {'neutral'|'happy'|'sad'|'surprised'} expression
   */
  setMouthExpression(expression) {
    if (!this.robot.dom.mouth) return;

    this.robot.dom.mouth.classList.remove(
      'happy',
      'sad',
      'surprised',
      'talking',
    );

    if (expression !== 'neutral') {
      this.robot.dom.mouth.classList.add(expression);
    }
  }

  /**
   * Animate talking
   * @param {number} duration - Duration in ms
   */
  startTalking(duration = 2000) {
    if (!this.robot.dom.mouth) return;

    this.robot.dom.mouth.classList.add('talking');

    setTimeout(() => {
      this.robot.dom.mouth?.classList.remove('talking');
    }, duration);
  }

  /**
   * Show thumbs up gesture
   * @param {number} duration - Duration in ms
   */
  showThumbsUp(duration = 1500) {
    const rightHand =
      this.robot.dom.container?.querySelector('.robot-hand.right');
    if (!rightHand) return;

    rightHand.classList.add('thumbs-up');
    this.setMouthExpression('happy');

    setTimeout(() => {
      rightHand.classList.remove('thumbs-up');
      this.setMouthExpression('neutral');
    }, duration);
  }

  /**
   * Animate gripping motion
   * @param {'left'|'right'} hand
   * @param {number} duration
   */
  grip(hand = 'left', duration = 500) {
    const handEl = this.robot.dom.container?.querySelector(
      `.robot-hand.${hand}`,
    );
    if (!handEl) return;

    handEl.classList.add('gripping');

    setTimeout(() => {
      handEl.classList.remove('gripping');
    }, duration);
  }

  /**
   * Head shake "No"
   */
  shakeNo() {
    if (!this.robot.dom.avatar) return;

    this.robot.dom.avatar.classList.add('shake-no');
    this.setMouthExpression('sad');

    setTimeout(() => {
      this.robot.dom.avatar?.classList.remove('shake-no');
      this.setMouthExpression('neutral');
    }, 500);
  }

  /**
   * Head nod "Yes"
   */
  nodYes() {
    if (!this.robot.dom.avatar) return;

    this.robot.dom.avatar.classList.add('nod-yes');
    this.setMouthExpression('happy');

    setTimeout(() => {
      this.robot.dom.avatar?.classList.remove('nod-yes');
      this.setMouthExpression('neutral');
    }, 600);
  }

  /**
   * Dance animation
   * @param {number} duration - Duration in ms
   */
  dance(duration = 3000) {
    if (!this.robot.dom.avatar) return;

    this.robot.dom.avatar.classList.add('dancing');
    this.setMouthExpression('happy');

    setTimeout(() => {
      this.robot.dom.avatar?.classList.remove('dancing');
      this.setMouthExpression('neutral');
    }, duration);
  }

  /**
   * Salute gesture
   */
  salute() {
    if (!this.robot.dom.avatar) return;

    this.robot.dom.avatar.classList.add('saluting');
    this.setMouthExpression('happy');

    setTimeout(() => {
      this.robot.dom.avatar?.classList.remove('saluting');
      this.setMouthExpression('neutral');
    }, 800);
  }

  /**
   * Sleep animation
   * @param {number} duration - Duration in ms
   */
  sleep(duration = 5000) {
    if (!this.robot.dom.avatar) return;

    this.robot.dom.avatar.classList.add('sleeping');

    setTimeout(() => {
      this.robot.dom.avatar?.classList.remove('sleeping');
    }, duration);
  }

  /**
   * Scared reaction
   */
  showScared() {
    if (!this.robot.dom.avatar) return;

    this.robot.dom.avatar.classList.add('scared');
    this.setMouthExpression('surprised');

    setTimeout(() => {
      this.robot.dom.avatar?.classList.remove('scared');
      this.setMouthExpression('neutral');
    }, 300);
  }

  /**
   * Applause animation
   * @param {number} duration - Duration in ms
   */
  applaud(duration = 2000) {
    if (!this.robot.dom.avatar) return;

    this.robot.dom.avatar.classList.add('applauding');
    this.setMouthExpression('happy');

    setTimeout(() => {
      this.robot.dom.avatar?.classList.remove('applauding');
      this.setMouthExpression('neutral');
    }, duration);
  }

  /**
   * Spawn star particles (success)
   * @param {number} count - Number of stars
   */
  spawnStars(count = 5) {
    if (!this.robot.dom.container) return;

    const rect = this.robot.dom.container.getBoundingClientRect();

    for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      star.className = 'robot-particle-star';
      star.textContent = '⭐';
      star.style.left = `${rect.left + rect.width / 2}px`;
      star.style.top = `${rect.top + rect.height / 2}px`;

      const angle = (Math.PI * 2 * i) / count;
      const distance = 40 + Math.random() * 20;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;

      star.style.setProperty('--tx', `${tx}px`);
      star.style.setProperty('--ty', `${ty}px`);

      document.body.appendChild(star);

      setTimeout(() => star.remove(), 1000);
    }
  }

  /**
   * Spawn heart particles (positive interaction)
   * @param {number} count - Number of hearts
   */
  spawnHearts(count = 3) {
    if (!this.robot.dom.container) return;

    const rect = this.robot.dom.container.getBoundingClientRect();

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const heart = document.createElement('div');
        heart.className = 'robot-particle-heart';
        heart.textContent = '❤️';
        heart.style.left = `${rect.left + rect.width / 2 + (Math.random() - 0.5) * 30}px`;
        heart.style.top = `${rect.top + rect.height / 2}px`;

        document.body.appendChild(heart);

        setTimeout(() => heart.remove(), 1500);
      }, i * 200);
    }
  }

  /**
   * Spawn question mark (confused)
   */
  spawnQuestionMark() {
    if (!this.robot.dom.container) return;

    const rect = this.robot.dom.container.getBoundingClientRect();

    const question = document.createElement('div');
    question.className = 'robot-particle-question';
    question.textContent = '❓';
    question.style.left = `${rect.left + rect.width / 2}px`;
    question.style.top = `${rect.top}px`;

    document.body.appendChild(question);

    setTimeout(() => question.remove(), 1000);
  }

  /**
   * Spawn sweat drop (difficult task)
   */
  spawnSweatDrop() {
    if (!this.robot.dom.container) return;

    const rect = this.robot.dom.container.getBoundingClientRect();

    const sweat = document.createElement('div');
    sweat.className = 'robot-particle-sweat';
    sweat.textContent = '💧';
    sweat.style.left = `${rect.left + rect.width * 0.7}px`;
    sweat.style.top = `${rect.top + 20}px`;

    document.body.appendChild(sweat);

    setTimeout(() => sweat.remove(), 800);
  }

  /**
   * Show confused state
   */
  showConfused() {
    this.setMouthExpression('surprised');
    this.spawnQuestionMark();

    setTimeout(() => {
      this.setMouthExpression('neutral');
    }, 2000);
  }

  /**
   * Show working hard state
   */
  showWorkingHard() {
    this.setMouthExpression('neutral');
    this.spawnSweatDrop();

    // Spawn multiple sweat drops
    setTimeout(() => this.spawnSweatDrop(), 400);
    setTimeout(() => this.spawnSweatDrop(), 800);
  }

  /**
   * Celebrate success
   */
  celebrate() {
    this.setMouthExpression('happy');
    this.spawnStars(6);
    this.dance(2000);
  }

  /**
   * Show love/appreciation
   */
  showLove() {
    this.setMouthExpression('happy');
    this.spawnHearts(4);
    this.showThumbsUp(2000);
  }
}
