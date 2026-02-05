/**
 * Robot DOM Builder
 * Sichere DOM-Erstellung ohne innerHTML
 * @version 1.0.0
 */

/**
 * Robot DOM Builder Class
 * Erstellt DOM-Elemente auf sichere Weise
 */
export class RobotDOMBuilder {
  /**
   * Create main robot container
   * @returns {HTMLElement}
   */
  createContainer() {
    const container = document.createElement('div');
    container.id = 'robot-companion-container';
    container.style.opacity = '0';
    container.style.transition = 'opacity 220ms ease';

    const floatWrapper = this.createFloatWrapper();

    container.append(floatWrapper);

    return container;
  }

  /**
   * Create chat window
   * @returns {HTMLElement}
   */
  createChatWindow() {
    const window = document.createElement('div');
    window.className = 'robot-chat-window';
    window.id = 'robot-chat-window';

    const header = this.createChatHeader();
    const messages = this.createMessagesContainer();
    const controls = this.createControlsContainer();
    const inputArea = this.createInputArea();

    window.append(header, messages, controls, inputArea);

    return window;
  }

  /**
   * Create chat header
   * @returns {HTMLElement}
   */
  createChatHeader() {
    const header = document.createElement('div');
    header.className = 'chat-header u-inline-center';

    const title = document.createElement('div');
    title.className = 'chat-title';

    const statusDot = document.createElement('span');
    statusDot.className = 'chat-status-dot';

    const titleText = document.createTextNode('Cyber Assistant');

    title.append(statusDot, titleText);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'chat-close-btn';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Chat schließen');

    header.append(title, closeBtn);

    return header;
  }

  /**
   * Create messages container
   * @returns {HTMLElement}
   */
  createMessagesContainer() {
    const messages = document.createElement('div');
    messages.className = 'chat-messages';
    messages.id = 'robot-messages';
    messages.setAttribute('role', 'log');
    messages.setAttribute('aria-live', 'polite');

    return messages;
  }

  /**
   * Create controls container
   * @returns {HTMLElement}
   */
  createControlsContainer() {
    const controls = document.createElement('div');
    controls.className = 'chat-controls';
    controls.id = 'robot-controls';

    return controls;
  }

  /**
   * Create input area
   * @returns {HTMLElement}
   */
  createInputArea() {
    const inputArea = document.createElement('div');
    inputArea.className = 'chat-input-area';
    inputArea.id = 'robot-input-area';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'robot-chat-input';
    input.name = 'robot-message';
    input.placeholder = 'Frag mich etwas oder wähle eine Option...';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Chat-Nachricht eingeben');

    const sendBtn = document.createElement('button');
    sendBtn.id = 'robot-chat-send';
    sendBtn.textContent = '➤';
    sendBtn.setAttribute('aria-label', 'Nachricht senden');

    inputArea.append(input, sendBtn);

    return inputArea;
  }

  /**
   * Create float wrapper with bubble and avatar
   * @returns {HTMLElement}
   */
  createFloatWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'robot-float-wrapper';

    const bubble = this.createBubble();
    const avatar = this.createAvatar();

    wrapper.append(bubble, avatar);

    return wrapper;
  }

  /**
   * Create speech bubble
   * @returns {HTMLElement}
   */
  createBubble() {
    const bubble = document.createElement('div');
    bubble.className = 'robot-bubble';
    bubble.id = 'robot-bubble';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');

    const text = document.createElement('span');
    text.id = 'robot-bubble-text';
    text.textContent = 'Hallo!';

    const closeBtn = document.createElement('div');
    closeBtn.className = 'robot-bubble-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Bubble schließen');

    bubble.append(text, closeBtn);

    return bubble;
  }

  /**
   * Create robot avatar button
   * @returns {HTMLElement}
   */
  createAvatar() {
    const button = document.createElement('button');
    button.className = 'robot-avatar';
    button.setAttribute('aria-label', 'Chat öffnen');

    const svg = this.createRobotSVG();
    button.appendChild(svg);

    return button;
  }

  /**
   * Create robot SVG
   * @returns {SVGElement}
   */
  createRobotSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.classList.add('robot-svg');

    // Defs
    const defs = this.createSVGDefs();
    svg.appendChild(defs);

    // Antenna
    const antenna = this.createAntenna();
    svg.appendChild(antenna);

    // Head
    const head = this.createHead();
    svg.appendChild(head);

    // Eyes
    const eyes = this.createEyes();
    svg.appendChild(eyes);

    // Body
    const body = this.createBody();
    svg.appendChild(body);

    // Arms
    const arms = this.createArms();
    svg.appendChild(arms);

    // Flame
    const flame = this.createFlame();
    svg.appendChild(flame);

    // Particles
    const particles = this.createParticles();
    svg.appendChild(particles);

    // Thinking bubble
    const thinking = this.createThinking();
    svg.appendChild(thinking);

    // Core light
    const coreLight = this.createCoreLight();
    svg.appendChild(coreLight);

    return svg;
  }

  /**
   * Create SVG defs (filters, gradients)
   * @returns {SVGDefsElement}
   */
  createSVGDefs() {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Glow filter
    const glowFilter = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'filter',
    );
    glowFilter.setAttribute('id', 'glow');
    glowFilter.setAttribute('x', '-20%');
    glowFilter.setAttribute('y', '-20%');
    glowFilter.setAttribute('width', '140%');
    glowFilter.setAttribute('height', '140%');

    const blur = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'feGaussianBlur',
    );
    blur.setAttribute('stdDeviation', '2');
    blur.setAttribute('result', 'blur');

    const composite = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'feComposite',
    );
    composite.setAttribute('in', 'SourceGraphic');
    composite.setAttribute('in2', 'blur');
    composite.setAttribute('operator', 'over');

    glowFilter.append(blur, composite);

    // Lid shadow filter
    const lidShadowFilter = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'filter',
    );
    lidShadowFilter.setAttribute('id', 'lidShadow');
    lidShadowFilter.setAttribute('x', '-50%');
    lidShadowFilter.setAttribute('y', '-50%');
    lidShadowFilter.setAttribute('width', '200%');
    lidShadowFilter.setAttribute('height', '200%');

    const dropShadow = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'feDropShadow',
    );
    dropShadow.setAttribute('dx', '0');
    dropShadow.setAttribute('dy', '1');
    dropShadow.setAttribute('stdDeviation', '1.2');
    dropShadow.setAttribute('flood-color', '#000000');
    dropShadow.setAttribute('flood-opacity', '0.35');

    lidShadowFilter.appendChild(dropShadow);

    // Lid gradient
    const lidGradient = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'linearGradient',
    );
    lidGradient.setAttribute('id', 'lidGradient');
    lidGradient.setAttribute('x1', '0');
    lidGradient.setAttribute('x2', '0');
    lidGradient.setAttribute('y1', '0');
    lidGradient.setAttribute('y2', '1');

    const stop1 = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'stop',
    );
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#0b1220');
    stop1.setAttribute('stop-opacity', '0.95');

    const stop2 = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'stop',
    );
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#0f172a');
    stop2.setAttribute('stop-opacity', '1');

    lidGradient.append(stop1, stop2);

    defs.append(glowFilter, lidShadowFilter, lidGradient);

    return defs;
  }

  /**
   * Create antenna
   * @returns {SVGGElement}
   */
  createAntenna() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '50');
    line.setAttribute('y1', '15');
    line.setAttribute('x2', '50');
    line.setAttribute('y2', '25');
    line.setAttribute('stroke', '#40e0d0');
    line.setAttribute('stroke-width', '2');

    const circle = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    circle.setAttribute('cx', '50');
    circle.setAttribute('cy', '15');
    circle.setAttribute('r', '3');
    circle.classList.add('robot-antenna-light');
    circle.setAttribute('fill', '#ff4444');

    g.append(line, circle);

    return g;
  }

  /**
   * Create head
   * @returns {SVGGElement}
   */
  createHead() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M30,40 a20,20 0 0,1 40,0');
    path.setAttribute('fill', '#1e293b');
    path.setAttribute('stroke', '#40e0d0');
    path.setAttribute('stroke-width', '2');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '30');
    rect.setAttribute('y', '40');
    rect.setAttribute('width', '40');
    rect.setAttribute('height', '15');
    rect.setAttribute('fill', '#1e293b');
    rect.setAttribute('stroke', '#40e0d0');
    rect.setAttribute('stroke-width', '2');

    g.append(path, rect);

    return g;
  }

  /**
   * Create eyes
   * @returns {SVGGElement}
   */
  createEyes() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('robot-eyes');

    // Left eye
    const leftPupil = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    leftPupil.classList.add('robot-pupil');
    leftPupil.setAttribute('cx', '40');
    leftPupil.setAttribute('cy', '42');
    leftPupil.setAttribute('r', '4');
    leftPupil.setAttribute('fill', '#40e0d0');
    leftPupil.setAttribute('filter', 'url(#glow)');

    const leftLid = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    leftLid.classList.add('robot-lid');
    leftLid.setAttribute(
      'd',
      'M34 36 C36 30 44 30 46 36 L46 44 C44 38 36 38 34 44 Z',
    );
    leftLid.setAttribute('fill', 'url(#lidGradient)');
    leftLid.setAttribute('filter', 'url(#lidShadow)');

    // Right eye
    const rightPupil = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    rightPupil.classList.add('robot-pupil');
    rightPupil.setAttribute('cx', '60');
    rightPupil.setAttribute('cy', '42');
    rightPupil.setAttribute('r', '4');
    rightPupil.setAttribute('fill', '#40e0d0');
    rightPupil.setAttribute('filter', 'url(#glow)');

    const rightLid = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    rightLid.classList.add('robot-lid');
    rightLid.setAttribute(
      'd',
      'M54 36 C56 30 64 30 66 36 L66 44 C64 38 56 38 54 44 Z',
    );
    rightLid.setAttribute('fill', 'url(#lidGradient)');
    rightLid.setAttribute('filter', 'url(#lidShadow)');

    g.append(leftPupil, leftLid, rightPupil, rightLid);

    return g;
  }

  /**
   * Create body/legs
   * @returns {SVGPathElement}
   */
  createBody() {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('robot-legs');
    path.setAttribute('d', 'M30,60 L70,60 L65,90 L35,90 Z');
    path.setAttribute('fill', '#0f172a');
    path.setAttribute('stroke', '#40e0d0');
    path.setAttribute('stroke-width', '2');

    return path;
  }

  /**
   * Create arms
   * @returns {SVGGElement}
   */
  createArms() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('robot-arms');

    const leftArm = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    leftArm.classList.add('robot-arm', 'left');
    leftArm.setAttribute('d', 'M30,62 Q20,70 25,80');
    leftArm.setAttribute('fill', 'none');
    leftArm.setAttribute('stroke', '#40e0d0');
    leftArm.setAttribute('stroke-width', '3');
    leftArm.setAttribute('stroke-linecap', 'round');

    const rightArm = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    rightArm.classList.add('robot-arm', 'right');
    rightArm.setAttribute('d', 'M70,62 Q80,70 75,80');
    rightArm.setAttribute('fill', 'none');
    rightArm.setAttribute('stroke', '#40e0d0');
    rightArm.setAttribute('stroke-width', '3');
    rightArm.setAttribute('stroke-linecap', 'round');

    g.append(leftArm, rightArm);

    return g;
  }

  /**
   * Create flame effect
   * @returns {SVGGElement}
   */
  createFlame() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('robot-flame');
    g.style.opacity = '0';

    const outerFlame = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    outerFlame.setAttribute('d', 'M40,90 Q50,120 60,90 Q50,110 40,90');
    outerFlame.setAttribute('fill', '#ff9900');

    const innerFlame = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    innerFlame.setAttribute('d', 'M45,90 Q50,110 55,90');
    innerFlame.setAttribute('fill', '#ffff00');

    g.append(outerFlame, innerFlame);

    return g;
  }

  /**
   * Create particles
   * @returns {SVGGElement}
   */
  createParticles() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('robot-particles');
    g.style.opacity = '0';

    // Create 3 animated particles
    const particles = [
      { cx: 20, cy: 50, r: 2, dur: '2s' },
      { cx: 80, cy: 60, r: 1.5, dur: '2.5s' },
      { cx: 15, cy: 70, r: 1, dur: '1.8s' },
    ];

    particles.forEach((p) => {
      const circle = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle',
      );
      circle.classList.add('particle');
      circle.setAttribute('cx', String(p.cx));
      circle.setAttribute('cy', String(p.cy));
      circle.setAttribute('r', String(p.r));
      circle.setAttribute('fill', '#40e0d0');
      circle.setAttribute('opacity', '0.6');

      const animate = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'animate',
      );
      animate.setAttribute('attributeName', 'cy');
      animate.setAttribute('values', `${p.cy};${p.cy - 20};${p.cy}`);
      animate.setAttribute('dur', p.dur);
      animate.setAttribute('repeatCount', 'indefinite');

      circle.appendChild(animate);
      g.appendChild(circle);
    });

    return g;
  }

  /**
   * Create thinking bubble
   * @returns {SVGGElement}
   */
  createThinking() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('robot-thinking');
    g.style.opacity = '0';

    const circle = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    circle.setAttribute('cx', '70');
    circle.setAttribute('cy', '20');
    circle.setAttribute('r', '8');
    circle.setAttribute('fill', 'rgba(64, 224, 208, 0.2)');
    circle.setAttribute('stroke', '#40e0d0');
    circle.setAttribute('stroke-width', '1');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '70');
    text.setAttribute('y', '25');
    text.setAttribute('font-size', '12');
    text.setAttribute('fill', '#40e0d0');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = '?';

    g.append(circle, text);

    return g;
  }

  /**
   * Create core light
   * @returns {SVGCircleElement}
   */
  createCoreLight() {
    const circle = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    circle.setAttribute('cx', '50');
    circle.setAttribute('cy', '70');
    circle.setAttribute('r', '5');
    circle.setAttribute('fill', '#2563eb');
    circle.setAttribute('opacity', '0.8');

    const animate = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'animate',
    );
    animate.setAttribute('attributeName', 'opacity');
    animate.setAttribute('values', '0.4;1;0.4');
    animate.setAttribute('dur', '2s');
    animate.setAttribute('repeatCount', 'indefinite');

    circle.appendChild(animate);

    return circle;
  }

  /**
   * Create message element
   * @param {string} text - Message text
   * @param {'user'|'bot'} type - Message type
   * @returns {HTMLElement}
   */
  createMessage(text, type = 'bot') {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.textContent = text;

    return msg;
  }

  /**
   * Create option button
   * @param {string} label - Button label
   * @param {Function} onClick - Click handler
   * @returns {HTMLElement}
   */
  createOptionButton(label, onClick) {
    const btn = document.createElement('button');
    btn.className = 'chat-option-btn';
    btn.textContent = label;
    btn.onclick = onClick;

    return btn;
  }

  /**
   * Create typing indicator
   * @returns {HTMLElement}
   */
  createTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'typing-indicator';
    div.id = 'robot-typing';

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'typing-dot';
      div.appendChild(dot);
    }

    return div;
  }
}
