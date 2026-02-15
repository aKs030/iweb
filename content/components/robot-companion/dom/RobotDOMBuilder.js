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

    // Arms (now includes magnifying glass in left arm group)
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

    // Flame clip path (to keep flame contained within original bounds while allowing overflow elsewhere)
    const flameClip = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'clipPath',
    );
    flameClip.setAttribute('id', 'flame-clip');
    const flameRect = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'rect',
    );
    flameRect.setAttribute('x', '0');
    flameRect.setAttribute('y', '0');
    flameRect.setAttribute('width', '100');
    flameRect.setAttribute('height', '100');
    flameClip.appendChild(flameRect);

    defs.append(glowFilter, lidShadowFilter, lidGradient, flameClip);

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

    // Left Arm Group (includes arm, hand, and magnifying glass)
    const leftArmGroup = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g',
    );
    leftArmGroup.classList.add('robot-arm', 'left');

    const leftArm = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    // Adjusted grip to wrap around the handle at approx (22, 82) - Viewer's Left
    // Mirrored from old right arm: M30,62 Q18,72 22,82
    leftArm.setAttribute('d', 'M30,62 Q18,72 22,82');
    leftArm.setAttribute('fill', 'none');
    leftArm.setAttribute('stroke', '#40e0d0');
    leftArm.setAttribute('stroke-width', '3');
    leftArm.setAttribute('stroke-linecap', 'round');

    // Left Hand (Grip Circle) - Viewer's Left
    const leftHand = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    leftHand.setAttribute('cx', '22');
    leftHand.setAttribute('cy', '82');
    leftHand.setAttribute('r', '3'); // Simple round grip
    leftHand.setAttribute('fill', '#40e0d0');

    // Add magnifying glass to left arm group
    const magnifyingGlass = this.createMagnifyingGlass();

    leftArmGroup.append(leftArm, leftHand, magnifyingGlass);

    // Right Arm Group (includes arm and hand)
    const rightArmGroup = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g',
    );
    rightArmGroup.classList.add('robot-arm', 'right');

    const rightArm = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    // Normal arm for right side (Viewer's Right)
    // Mirrored from old left arm: M70,62 Q80,70 75,80
    rightArm.setAttribute('d', 'M70,62 Q80,70 75,80');
    rightArm.setAttribute('fill', 'none');
    rightArm.setAttribute('stroke', '#40e0d0');
    rightArm.setAttribute('stroke-width', '3');
    rightArm.setAttribute('stroke-linecap', 'round');

    // Right Hand (Grip Circle) - Viewer's Right
    const rightHand = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    rightHand.setAttribute('cx', '75');
    rightHand.setAttribute('cy', '80');
    rightHand.setAttribute('r', '3'); // Simple round grip
    rightHand.setAttribute('fill', '#40e0d0');

    rightArmGroup.append(rightArm, rightHand);

    g.append(leftArmGroup, rightArmGroup);

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
    // Apply clip-path to restore original clipping behavior for the flame
    g.setAttribute('clip-path', 'url(#flame-clip)');

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
   * Create magnifying glass
   * @returns {SVGGElement}
   */
  createMagnifyingGlass() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('robot-magnifying-glass');
    g.style.opacity = '0';
    // Remove transformBox: fill-box and transformOrigin: center to rely on coordinate system origin (0,0)
    // which we will position at the hand grip.
    // g.style.transformBox = 'fill-box'; // Removed to avoid rotation around bounding box center
    // g.style.transformOrigin = 'center'; // Removed

    // Position adjusted to be held by the LEFT hand (Viewer's Left)
    // Left arm ends around 22, 82.
    // We want to rotate it so it points towards the left/top-left.
    // Handle (0,0) is at grip. Handle extends UP (0, -12).
    // Rotation -45 deg: Handle points Top-Left.
    g.setAttribute('transform', 'translate(22, 82) rotate(-45) scale(0.9)');

    // Handle - extending from hand (0,0) UPWARDS/OUTWARDS to the lens center
    // Let's define the handle going straight UP relative to the group's local coords (0,-10).
    // --- Definitions for Photorealism ---
    const localDefs = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'defs',
    );

    // 1. Handle Gradient (Cylindrical Black/Dark Grey)
    const handleGradientId = 'handleGradient';
    const handleGradient = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'linearGradient',
    );
    handleGradient.setAttribute('id', handleGradientId);
    handleGradient.setAttribute('x1', '0%');
    handleGradient.setAttribute('y1', '0%');
    handleGradient.setAttribute('x2', '100%');
    handleGradient.setAttribute('y2', '0%'); // Horizontal gradient across width

    // Left edge (shadow)
    const stopH1 = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'stop',
    );
    stopH1.setAttribute('offset', '0%');
    stopH1.setAttribute('stop-color', '#1e293b'); // Dark Slate
    // Center (highlight)
    const stopH2 = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'stop',
    );
    stopH2.setAttribute('offset', '40%');
    stopH2.setAttribute('stop-color', '#475569'); // Lighter Slate
    // Right edge (shadow)
    const stopH3 = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'stop',
    );
    stopH3.setAttribute('offset', '100%');
    stopH3.setAttribute('stop-color', '#0f172a'); // Very Dark

    handleGradient.append(stopH1, stopH2, stopH3);

    // 2. Realistic Chrome Rim Gradient
    const chromeGradientId = 'chromeGradient';
    const chromeGradient = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'linearGradient',
    );
    chromeGradient.setAttribute('id', chromeGradientId);
    chromeGradient.setAttribute('x1', '0%');
    chromeGradient.setAttribute('y1', '0%');
    chromeGradient.setAttribute('x2', '100%');
    chromeGradient.setAttribute('y2', '100%'); // Diagonal light

    // Complex metallic reflection stops
    const stops = [
      { off: '0%', col: '#e2e8f0' }, // Highlight
      { off: '25%', col: '#cbd5e1' }, // Mid
      { off: '50%', col: '#64748b' }, // Shadow
      { off: '51%', col: '#ffffff' }, // Specular flash
      { off: '75%', col: '#94a3b8' }, // Mid
      { off: '100%', col: '#475569' }, // Dark
    ];
    stops.forEach((s) => {
      const stop = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'stop',
      );
      stop.setAttribute('offset', s.off);
      stop.setAttribute('stop-color', s.col);
      chromeGradient.appendChild(stop);
    });

    // 3. Realistic Glass Gradient (Clear with subtle refraction)
    const realGlassGradientId = 'realGlassGradient';
    const realGlassGradient = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'radialGradient',
    );
    realGlassGradient.setAttribute('id', realGlassGradientId);
    realGlassGradient.setAttribute('cx', '50%');
    realGlassGradient.setAttribute('cy', '50%');
    realGlassGradient.setAttribute('r', '50%');

    // Center - Ultra clear
    const stopRG1 = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'stop',
    );
    stopRG1.setAttribute('offset', '70%');
    stopRG1.setAttribute('stop-color', 'rgba(255, 255, 255, 0.01)');

    // Edge - Subtle dark/green tint (common in real glass)
    const stopRG2 = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'stop',
    );
    stopRG2.setAttribute('offset', '100%');
    stopRG2.setAttribute('stop-color', 'rgba(200, 230, 230, 0.15)');

    realGlassGradient.append(stopRG1, stopRG2);

    // 4. Drop Shadow Filter
    const shadowFilter = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'filter',
    );
    shadowFilter.setAttribute('id', 'magShadow');
    shadowFilter.setAttribute('x', '-50%');
    shadowFilter.setAttribute('y', '-50%');
    shadowFilter.setAttribute('width', '200%');
    shadowFilter.setAttribute('height', '200%');
    const feDropShadow = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'feDropShadow',
    );
    feDropShadow.setAttribute('dx', '1');
    feDropShadow.setAttribute('dy', '2');
    feDropShadow.setAttribute('stdDeviation', '2');
    feDropShadow.setAttribute('flood-color', '#000000');
    feDropShadow.setAttribute('flood-opacity', '0.3');
    shadowFilter.appendChild(feDropShadow);

    localDefs.append(
      handleGradient,
      chromeGradient,
      realGlassGradient,
      shadowFilter,
    );
    g.append(localDefs);

    // Apply shadow to group? Or better to specific elements. Let's apply to rim/handle.
    // Actually, applying to the whole group might be heavy during animation. Let's apply to rim.

    // --- Construction ---

    // 1. Handle (Cylindrical)
    const handleRect = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'rect',
    );
    handleRect.setAttribute('x', '-2');
    handleRect.setAttribute('y', '-14'); // Length 14 + 2 inside hand
    handleRect.setAttribute('width', '4');
    handleRect.setAttribute('height', '16');
    handleRect.setAttribute('rx', '1');
    handleRect.setAttribute('fill', `url(#${handleGradientId})`);
    // Add a cap at the bottom
    const handleCap = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    handleCap.setAttribute('cx', '0');
    handleCap.setAttribute('cy', '1');
    handleCap.setAttribute('r', '2');
    handleCap.setAttribute('fill', '#0f172a'); // Dark cap

    // 2. Connector (Chrome Neck)
    const connector = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    connector.setAttribute('d', 'M-1.5,-14 L1.5,-14 L2.5,-17 L-2.5,-17 Z');
    connector.setAttribute('fill', `url(#${chromeGradientId})`);

    // 3. Rim (Chrome Ring) - Using stroke
    const cx = 0;
    const cy = -29; // handle -14, connector -3, radius 12 -> -29 center
    const radius = 12;

    const rim = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    rim.setAttribute('cx', String(cx));
    rim.setAttribute('cy', String(cy));
    rim.setAttribute('r', String(radius));
    rim.setAttribute('fill', 'none');
    rim.setAttribute('stroke', `url(#${chromeGradientId})`);
    rim.setAttribute('stroke-width', '2.5');
    rim.setAttribute('filter', 'url(#magShadow)'); // Add shadow for depth

    // 4. Lens (Glass)
    const lens = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    lens.setAttribute('cx', String(cx));
    lens.setAttribute('cy', String(cy));
    lens.setAttribute('r', String(radius - 1.25)); // Just inside rim
    lens.setAttribute('fill', `url(#${realGlassGradientId})`);
    // Inner bevel shadow (inset) simulation using stroke
    lens.setAttribute('stroke', 'rgba(0,0,0,0.1)');
    lens.setAttribute('stroke-width', '0.5');

    // 5. Realistic Reflections (Photorealism)
    // Soft, wide glare across top half
    const glare = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    glare.setAttribute(
      'd',
      `M${cx - 9},${cy - 5} Q${cx},${cy - 14} ${cx + 9},${cy - 5} Q${cx},${cy - 9} ${cx - 9},${cy - 5}`,
    );
    glare.setAttribute('fill', 'rgba(255, 255, 255, 0.15)');
    glare.setAttribute('filter', 'blur(1px)');

    // Sharp specular highlight (Point light source)
    const specular = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'ellipse',
    );
    specular.setAttribute('cx', String(cx - 5));
    specular.setAttribute('cy', String(cy - 6));
    specular.setAttribute('rx', '2.5');
    specular.setAttribute('ry', '1.5');
    specular.setAttribute('transform', `rotate(-45, ${cx - 5}, ${cy - 6})`);
    specular.setAttribute('fill', 'white');
    specular.setAttribute('opacity', '0.7');
    specular.setAttribute('filter', 'blur(0.5px)');

    // Bottom edge refraction (internal reflection)
    const refraction = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    refraction.setAttribute(
      'd',
      `M${cx - 8},${cy + 4} Q${cx},${cy + 10} ${cx + 8},${cy + 4}`,
    );
    refraction.setAttribute('fill', 'none');
    refraction.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
    refraction.setAttribute('stroke-width', '1.5');
    refraction.setAttribute('stroke-linecap', 'round');
    refraction.setAttribute('opacity', '0.6');

    g.append(
      handleRect,
      handleCap,
      connector,
      rim,
      lens,
      glare,
      specular,
      refraction,
    );

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
