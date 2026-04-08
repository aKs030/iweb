import { createLogger } from '#core/logger.js';

const log = createLogger('CardManager');

export class CardManager {
  constructor(THREE, scene, camera, renderer) {
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.cards = [];
    this.raycaster = new THREE.Raycaster();
    this.isVisible = false;

    // Internal state
    this._hovered = null;
    this._hoverCandidate = null;
    this._hoverFrames = 0;
    this._resizeRAF = null;
    this._sharedGeometry = null;
    this._sharedGlowTexture = null;
    this._tmpVec = new THREE.Vector3();
    this._orientDummy = new THREE.Object3D();

    // Group to hold all cards
    this.cardGroup = new THREE.Group();
    this.scene.add(this.cardGroup);
    this.cardGroup.visible = false;

    // Texture cache to reuse generated canvases / textures when card content is identical
    this._textureCache = new Map();

    // Profiling
    this._profile = {
      texturesCreated: 0,
      texturesDisposed: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    // Pointer/touch handling state
    this._lastPointerPos = { x: 0, y: 0 };
    this._pointerDown = false;
    this._pointerDownPos = null;
    this._boundPointerMove = null;
    this._boundPointerDown = null;
    this._boundPointerUp = null;
  }

  _getCardTextureScale() {
    const dpr = Math.min(globalThis.window?.devicePixelRatio || 1, 2);
    const vw = globalThis.window?.innerWidth || 1440;
    const vh = globalThis.window?.innerHeight || 900;
    let scale = dpr * 1.35;

    if (vw <= 560) scale *= 0.78;
    else if (vw <= 960) scale *= 0.92;

    if (vh < 760) scale *= 0.92;

    return Math.max(2, Math.min(3, Math.round(scale)));
  }

  _getCardTextureAnisotropy() {
    const maxAnisotropy =
      this.renderer?.capabilities?.getMaxAnisotropy?.() ?? 0;

    return Math.min(maxAnisotropy, 4);
  }

  // Convert a vertical pixel offset to world-space Y delta at z ~= 0 using the current camera
  _pixelsToWorldY(pixels) {
    if (!this.renderer || !this.camera) return 0;

    // Use visual viewport on mobile to handle keyboard appearance
    const isMobile = globalThis.window?.innerWidth < 768;
    let height;

    if (isMobile && globalThis.window?.visualViewport) {
      height = globalThis.window.visualViewport.height;
    } else {
      const canvasRect = this.renderer.domElement.getBoundingClientRect();
      height = canvasRect.height || (globalThis.window?.innerHeight ?? 800);
    }

    if (!height) return 0;

    // NDC delta (top/bottom range is -1..1 => total 2 units)
    const ndcDelta = (pixels / height) * 2;

    // Reuse temp vectors (create on demand if missing on instance)
    if (!this._pv1) this._pv1 = new this.THREE.Vector3();
    if (!this._pv2) this._pv2 = new this.THREE.Vector3();

    this._pv1.set(0, 0, 0.5);
    this._pv2.set(0, -ndcDelta, 0.5);

    this._pv1.unproject(this.camera);
    this._pv2.unproject(this.camera);

    return this._pv2.y - this._pv1.y;
  }

  _pixelsToWorldX(pixels) {
    if (!this.renderer || !this.camera) return 0;

    const canvasRect = this.renderer.domElement.getBoundingClientRect();
    const width = canvasRect.width || (globalThis.window?.innerWidth ?? 800);

    if (!width) return 0;

    const ndcDelta = (pixels / width) * 2;

    if (!this._ph1) this._ph1 = new this.THREE.Vector3();
    if (!this._ph2) this._ph2 = new this.THREE.Vector3();

    this._ph1.set(0, 0, 0.5);
    this._ph2.set(ndcDelta, 0, 0.5);

    this._ph1.unproject(this.camera);
    this._ph2.unproject(this.camera);

    return this._ph2.x - this._ph1.x;
  }

  _setCardHoverMeta(card, hoverLift) {
    card.userData.originalY = card.position.y;
    card.userData.hoverY = card.position.y + hoverLift;
    card.userData.originalZ = card.position.z;
  }

  _getCardScreenCenter(card) {
    if (!this.renderer || !this.camera || !card) return null;

    const canvasRect = this.renderer.domElement.getBoundingClientRect();
    const width = canvasRect.width;
    const height = canvasRect.height;

    if (!width || !height) return null;

    if (!this._screenVec) this._screenVec = new this.THREE.Vector3();

    card.updateMatrixWorld();
    card.getWorldPosition(this._screenVec);
    this._screenVec.project(this.camera);

    return {
      x: (this._screenVec.x * 0.5 + 0.5) * width + canvasRect.left,
      y: (-this._screenVec.y * 0.5 + 0.5) * height + canvasRect.top,
    };
  }

  _nudgeCardOnScreen(card, deltaXPx = 0, deltaYPx = 0) {
    const moveAxis = (axis, pixels, toWorld, screenKey) => {
      if (!pixels) return;

      const magnitude = Math.abs(toWorld.call(this, Math.abs(pixels)));

      if (!magnitude) return;

      const targetDirection = Math.sign(pixels);
      const original = card.position[axis];
      const baseCenter = this._getCardScreenCenter(card);

      if (!baseCenter) return;

      /** @type {{ sign: number; screenShift: number } | null} */
      let bestCandidate = null;

      [1, -1].forEach((sign) => {
        card.position[axis] = original + sign * magnitude;

        const shiftedCenter = this._getCardScreenCenter(card);
        const screenShift = shiftedCenter
          ? shiftedCenter[screenKey] - baseCenter[screenKey]
          : 0;

        if (
          Math.sign(screenShift) === targetDirection &&
          Math.abs(screenShift) > 0.5
        ) {
          bestCandidate = {
            sign,
            screenShift,
          };
        }
      });

      card.position[axis] = original;

      if (!bestCandidate) return;

      const factor = Math.min(
        2.8,
        Math.max(0.7, Math.abs(pixels / bestCandidate.screenShift)),
      );

      card.position[axis] = original + bestCandidate.sign * magnitude * factor;
    };

    moveAxis('x', deltaXPx, this._pixelsToWorldX, 'x');
    moveAxis('y', deltaYPx, this._pixelsToWorldY, 'y');
  }

  _expandRect(rect, paddingX, paddingY = paddingX) {
    return {
      left: rect.left - paddingX,
      right: rect.right + paddingX,
      top: rect.top - paddingY,
      bottom: rect.bottom + paddingY,
    };
  }

  _isStackedLayout(layoutMode) {
    return layoutMode === 'phone' || layoutMode.startsWith('tablet');
  }

  _getLayoutMode(vw, vh) {
    const isShortViewport = vh < 720;

    if (vw <= 560 || (vw <= 720 && isShortViewport)) return 'phone';

    if (vw <= 960) {
      return vh > vw * 1.02 ? 'tablet-portrait' : 'tablet-landscape';
    }

    if (vw <= 1360 || vh < 820) return 'desktop-compact';

    return 'desktop-wide';
  }

  _getUiSafeZones({ layoutMode }) {
    if (typeof document === 'undefined') return [];

    const stackedLayout = this._isStackedLayout(layoutMode);
    const phoneLayout = layoutMode === 'phone';
    const zones = [];

    zones.push({
      kind: 'top-band',
      rect: {
        left: 0,
        right: window.innerWidth,
        top: 0,
        bottom: phoneLayout ? 114 : stackedLayout ? 104 : 88,
      },
      biasX: 0,
      biasY: 1,
      padding: phoneLayout ? 10 : stackedLayout ? 10 : 12,
    });

    const copy = document.querySelector('.features-copy');

    if (copy) {
      const rect = copy.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        zones.push({
          kind: 'copy',
          rect: this._expandRect(
            rect,
            phoneLayout ? 10 : stackedLayout ? 12 : 14,
            phoneLayout ? 10 : stackedLayout ? 12 : 14,
          ),
          biasX: 1,
          biasY: stackedLayout ? 1 : 0.35,
          padding: 10,
        });
      }
    }

    const note = document.querySelector('.features-note');

    if (note) {
      const rect = note.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        zones.push({
          kind: 'note',
          rect: this._expandRect(
            rect,
            phoneLayout ? 10 : stackedLayout ? 12 : 14,
            phoneLayout ? 10 : stackedLayout ? 12 : 12,
          ),
          biasX: stackedLayout ? 1 : -1,
          biasY: -1,
          padding: 10,
        });
      }
    }

    return zones;
  }

  _resolveUiSafeZones({ layoutMode }) {
    const safeZones = this._getUiSafeZones({ layoutMode });

    if (safeZones.length === 0) return;

    for (let iteration = 0; iteration < 4; iteration++) {
      this.alignCardsToCameraImmediate();
      this.scene.updateMatrixWorld?.(true);

      const rects = this.getCardScreenRects();
      let adjusted = false;

      this.cards.forEach((card, index) => {
        const rect = rects[index];

        if (!rect) return;

        safeZones.forEach((zone) => {
          if (zone.kind === 'top-band') {
            if (rect.top < zone.rect.bottom) {
              this._nudgeCardOnScreen(
                card,
                0,
                zone.rect.bottom - rect.top + zone.padding,
              );
              adjusted = true;
            }

            return;
          }

          const overlapX =
            Math.min(rect.right, zone.rect.right) -
            Math.max(rect.left, zone.rect.left);
          const overlapY =
            Math.min(rect.bottom, zone.rect.bottom) -
            Math.max(rect.top, zone.rect.top);

          if (overlapX <= 0 || overlapY <= 0) return;

          const moveX =
            zone.biasX === 0
              ? 0
              : (overlapX + zone.padding) * Math.sign(zone.biasX);
          const moveY =
            zone.biasY === 0
              ? 0
              : (overlapY + zone.padding) * Math.sign(zone.biasY);

          this._nudgeCardOnScreen(card, moveX, moveY);
          adjusted = true;
        });
      });

      if (!adjusted) break;
    }
  }

  _resolveViewportBounds({ layoutMode }) {
    if (!this.renderer || !this.camera || this.cards.length === 0) return;

    const stackedLayout = this._isStackedLayout(layoutMode);
    const phoneLayout = layoutMode === 'phone';
    const copy = !stackedLayout
      ? document.querySelector('.features-copy')
      : null;
    const copyRect = copy?.getBoundingClientRect?.();
    const note = !stackedLayout
      ? document.querySelector('.features-note')
      : null;
    const noteRectRaw = note?.getBoundingClientRect?.();
    const noteRect =
      !stackedLayout && noteRectRaw?.width
        ? this._expandRect(noteRectRaw, 10, 8)
        : null;
    const leftBound = Math.max(
      phoneLayout ? 10 : stackedLayout ? 14 : 26,
      !stackedLayout && copyRect?.width ? copyRect.right + 24 : 0,
    );
    const rightBound =
      window.innerWidth - (phoneLayout ? 10 : stackedLayout ? 14 : 46);
    const topBound = phoneLayout ? 104 : stackedLayout ? 96 : 92;
    const bottomBound =
      window.innerHeight - (phoneLayout ? 82 : stackedLayout ? 88 : 118);

    for (let iteration = 0; iteration < 6; iteration++) {
      this.alignCardsToCameraImmediate();
      this.scene.updateMatrixWorld?.(true);

      const rects = this.getCardScreenRects();
      let moved = false;

      this.cards.forEach((card, index) => {
        const rect = rects[index];

        if (!rect) return;

        let shiftX = 0;
        let shiftY = 0;

        if (rect.left < leftBound) shiftX += leftBound - rect.left;
        if (rect.right > rightBound) shiftX -= rect.right - rightBound;
        if (rect.top < topBound) shiftY += topBound - rect.top;
        if (rect.bottom > bottomBound) shiftY -= rect.bottom - bottomBound;

        if (noteRect) {
          const overlapX =
            Math.min(rect.right, noteRect.right) -
            Math.max(rect.left, noteRect.left);
          const overlapY =
            Math.min(rect.bottom, noteRect.bottom) -
            Math.max(rect.top, noteRect.top);

          if (overlapX > 0 && overlapY > 0) {
            shiftX -= overlapX + 36;
          }
        }

        if (!shiftX && !shiftY) return;

        this._nudgeCardOnScreen(card, shiftX, shiftY);
        moved = true;
      });

      if (!moved) break;
    }
  }

  _getDesktopStageOffsetX() {
    if (typeof document === 'undefined') return 0;

    const viewportWidth = globalThis.window?.innerWidth || 0;
    if (!viewportWidth) return 0;

    const copyRect = document
      .querySelector('.features-copy')
      ?.getBoundingClientRect?.();
    const noteRect = document
      .querySelector('.features-note')
      ?.getBoundingClientRect?.();

    const leftEdge = copyRect?.right
      ? Math.min(viewportWidth - 180, copyRect.right + 42)
      : viewportWidth * 0.28;
    const rightEdge = noteRect?.left
      ? Math.max(leftEdge + 220, noteRect.left - 56)
      : viewportWidth - 72;
    const stageCenterPx = (leftEdge + rightEdge) * 0.5;
    const viewportCenterPx = viewportWidth * 0.5;

    return this._pixelsToWorldX(stageCenterPx - viewportCenterPx);
  }

  _applyLayoutPositions({
    positions,
    scale,
    spreadX = 1,
    spreadY = 1,
    offsetX = 0,
    offsetY = 0,
    hoverLift = 0.2,
  }) {
    this.cards.forEach((card, idx) => {
      const position = positions[idx] || positions[positions.length - 1];
      const cardScale = scale * (position.scale ?? 1);
      const x = position.x * spreadX + offsetX;
      const y = position.y * spreadY + offsetY;
      const z = position.z ?? 0;

      card.scale.setScalar(cardScale);
      card.position.set(x, y, z);
      card.userData.layoutAnchor = { x, y, z, scale: cardScale, hoverLift };

      this._setCardHoverMeta(card, hoverLift);
    });
  }

  _applyResponsiveLayout(vw, vh, layoutMode) {
    const safeAreaTop =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--safe-top',
        ),
      ) || 0;

    if (layoutMode === 'phone') {
      this._applyLayoutPositions({
        scale: Math.min(0.92, Math.max(0.74, Math.min(vw / 420, vh / 860))),
        spreadX: Math.min(1.02, Math.max(0.92, vw / 420)),
        spreadY: Math.min(1.04, Math.max(0.92, vh / 860)),
        offsetY: -this._pixelsToWorldY(88 + safeAreaTop),
        hoverLift: 0.16,
        positions: [
          { x: -1.28, y: 1.18, z: 0.18, scale: 0.84 },
          { x: 1.24, y: 1.34, z: 0.28, scale: 0.9 },
          { x: -1.08, y: -1.24, z: 0.08, scale: 0.82 },
          { x: 1.12, y: -1.02, z: 0.16, scale: 0.84 },
          { x: 0, y: -3.58, z: 0.12, scale: 0.9 },
        ],
      });
      return;
    }

    if (layoutMode === 'tablet-portrait') {
      this._applyLayoutPositions({
        scale: Math.min(1, Math.max(0.82, Math.min(vw / 780, vh / 980))),
        spreadX: Math.min(1.08, Math.max(0.98, vw / 820)),
        spreadY: Math.min(1.06, Math.max(0.94, vh / 980)),
        offsetY: -this._pixelsToWorldY(72 + safeAreaTop),
        hoverLift: 0.18,
        positions: [
          { x: -1.74, y: 1.62, z: 0.12, scale: 0.88 },
          { x: 1.68, y: 1.82, z: 0.24, scale: 0.95 },
          { x: -1.38, y: -0.96, z: 0.08, scale: 0.86 },
          { x: 1.42, y: -0.78, z: 0.14, scale: 0.88 },
          { x: 0.04, y: -3.42, z: 0.1, scale: 0.94 },
        ],
      });
      return;
    }

    if (layoutMode === 'tablet-landscape') {
      this._applyLayoutPositions({
        scale: Math.min(0.98, Math.max(0.82, Math.min(vw / 1040, vh / 760))),
        spreadX: Math.min(1.02, Math.max(0.95, vw / 960)),
        spreadY: Math.min(1.05, Math.max(0.94, vh / 760)),
        offsetY: -this._pixelsToWorldY(68 + safeAreaTop),
        hoverLift: 0.18,
        positions: [
          { x: -2.18, y: 1.3, z: 0.06, scale: 0.84 },
          { x: -0.06, y: 1.54, z: 0.16, scale: 0.95 },
          { x: 2.18, y: 1.02, z: 0.08, scale: 0.84 },
          { x: -1.32, y: -1.28, z: 0.02, scale: 0.86 },
          { x: 1.38, y: -1.56, z: 0.08, scale: 0.88 },
        ],
      });
      return;
    }

    if (layoutMode === 'desktop-compact') {
      const offsetX = this._getDesktopStageOffsetX();

      this._applyLayoutPositions({
        scale: Math.min(0.92, Math.max(0.8, Math.min(vw / 1320, vh / 860))),
        spreadX: 1,
        spreadY: 1,
        offsetX,
        hoverLift: 0.2,
        positions: [
          { x: -2.58, y: 1.72, z: 0.04, scale: 0.84 },
          { x: 0, y: 1.92, z: 0.16, scale: 0.9 },
          { x: 2.58, y: 1.72, z: 0.08, scale: 0.84 },
          { x: -1.34, y: -1.02, z: 0.02, scale: 0.86 },
          { x: 1.34, y: -1.12, z: 0.1, scale: 0.88 },
        ],
      });
      return;
    }

    const offsetX = this._getDesktopStageOffsetX();

    this._applyLayoutPositions({
      scale: Math.min(0.96, Math.max(0.84, Math.min(vw / 1520, vh / 940))),
      spreadX: 1,
      spreadY: 1,
      offsetX,
      hoverLift: 0.22,
      positions: [
        { x: -2.84, y: 1.84, z: 0.05, scale: 0.86 },
        { x: 0, y: 2.02, z: 0.18, scale: 0.92 },
        { x: 2.84, y: 1.84, z: 0.08, scale: 0.86 },
        { x: -1.48, y: -1.1, z: 0.03, scale: 0.88 },
        { x: 1.48, y: -1.24, z: 0.12, scale: 0.9 },
      ],
    });
  }

  _compactCardCluster({ layoutMode }) {
    if (!this.renderer || !this.camera || this.cards.length === 0) return;

    const stackedLayout = this._isStackedLayout(layoutMode);
    const phoneLayout = layoutMode === 'phone';
    const pullFactor = phoneLayout ? 0.3 : stackedLayout ? 0.22 : 0;
    const scalePull = phoneLayout ? 0.36 : stackedLayout ? 0.28 : 0;
    const maxWorldPullX = this._pixelsToWorldX(
      phoneLayout ? 34 : stackedLayout ? 26 : 14,
    );
    const maxWorldPullY = Math.abs(
      this._pixelsToWorldY(phoneLayout ? 28 : stackedLayout ? 22 : 12),
    );

    this.cards.forEach((card) => {
      const anchor = card.userData.layoutAnchor;

      if (!anchor) return;

      const deltaX = anchor.x - card.position.x;
      const deltaY = anchor.y - card.position.y;
      const moveX =
        Math.sign(deltaX) *
        Math.min(Math.abs(deltaX) * pullFactor, maxWorldPullX);
      const moveY =
        Math.sign(deltaY) *
        Math.min(Math.abs(deltaY) * pullFactor, maxWorldPullY);

      card.position.x += moveX;
      card.position.y += moveY;
      card.position.z += (anchor.z - card.position.z) * 0.24;
      card.scale.setScalar(
        card.scale.x + (anchor.scale - card.scale.x) * scalePull,
      );

      this._setCardHoverMeta(card, anchor.hoverLift ?? 0.2);
    });
  }

  _resolveCardOverlaps({ layoutMode }) {
    if (!this.renderer || !this.camera || this.cards.length < 2) return;

    const stackedLayout = this._isStackedLayout(layoutMode);
    const phoneLayout = layoutMode === 'phone';
    const minGapPx = phoneLayout ? 20 : stackedLayout ? 18 : 60;
    const horizontalWeight = phoneLayout ? 0.34 : stackedLayout ? 0.42 : 0.62;
    const verticalWeight = phoneLayout ? 0.52 : stackedLayout ? 0.34 : 0.44;
    const scaleStep = phoneLayout ? 0.018 : stackedLayout ? 0.014 : 0.01;
    const minScale = phoneLayout ? 0.68 : stackedLayout ? 0.76 : 0.78;

    for (let iteration = 0; iteration < 14; iteration++) {
      this.alignCardsToCameraImmediate();
      this.scene.updateMatrixWorld?.(true);

      const rects = this.getCardScreenRects();
      let overlapCount = 0;

      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const rectA = rects[i];
          const rectB = rects[j];
          const overlapX =
            Math.min(rectA.right, rectB.right) -
            Math.max(rectA.left, rectB.left);
          const overlapY =
            Math.min(rectA.bottom, rectB.bottom) -
            Math.max(rectA.top, rectB.top);
          const pushX = Math.max(0, overlapX + minGapPx);
          const pushY = Math.max(0, overlapY + minGapPx);

          if (pushX === 0 || pushY === 0) continue;

          overlapCount++;

          const cardA = this.cards[i];
          const cardB = this.cards[j];
          const centerAX = (rectA.left + rectA.right) * 0.5;
          const centerBX = (rectB.left + rectB.right) * 0.5;
          const centerAY = (rectA.top + rectA.bottom) * 0.5;
          const centerBY = (rectB.top + rectB.bottom) * 0.5;
          const dirX = centerAX <= centerBX ? -1 : 1;
          const dirY = centerAY <= centerBY ? 1 : -1;
          const worldPushX = this._pixelsToWorldX(
            pushX * 0.5 * horizontalWeight,
          );
          const worldPushY = this._pixelsToWorldY(pushY * 0.5 * verticalWeight);

          if (worldPushX > 0) {
            cardA.position.x += dirX * worldPushX;
            cardB.position.x -= dirX * worldPushX;
          }

          if (worldPushY > 0) {
            cardA.position.y += dirY * worldPushY;
            cardB.position.y -= dirY * worldPushY;
          }
        }
      }

      if (overlapCount === 0) break;

      if (iteration > 0 && iteration % 3 === 2) {
        let scaledDown = false;

        this.cards.forEach((card) => {
          const nextScale = Math.max(minScale, card.scale.x - scaleStep);

          if (nextScale < card.scale.x) {
            card.scale.setScalar(nextScale);
            scaledDown = true;
          }
        });

        if (!scaledDown) break;
      }
    }

    this.cards.forEach((card) => {
      this._setCardHoverMeta(
        card,
        card.userData.layoutAnchor?.hoverLift ?? (stackedLayout ? 0.18 : 0.24),
      );
    });
  }

  initFromData(dataArray) {
    if (this.cards.length > 0) return;
    if (!Array.isArray(dataArray) || dataArray.length === 0) return;

    const cardCount = dataArray.length;
    // Base dimensions for the card plane
    const baseW = 2.54;
    const baseH = 3.42;

    this._baseW = baseW;
    this._baseH = baseH;
    const centerOffset = (cardCount - 1) / 2;

    // Default Layout - positions will be refined in _onResize
    const positions = dataArray.map((d, i) => ({
      x: (i - centerOffset) * (baseW * 1.2),
      y: 0,
      z: 0,
      color: d.color || ['#07a1ff', '#a107ff', '#ff07a1'][i] || '#ffffff',
    }));

    // Shared geometry reused across cards
    this._sharedGeometry = new this.THREE.PlaneGeometry(baseW, baseH);

    // Prepare shared glow texture once
    if (!this._sharedGlowTexture)
      this._sharedGlowTexture = this.createGlowTexture();

    dataArray.forEach((d, index) => {
      const data = {
        id: index,
        title: d.title || '',
        subtitle: d.subtitle || '',
        text: d.text || '',
        link: d.link || '#',
        cta: d.cta || '',
        meta: d.meta || '',
        routeLabel: d.routeLabel || '',
        iconChar: d.iconChar || '',
        color: positions[index].color,
        position: positions[index],
      };

      const mesh = this._createMeshFromData(data, index, baseW, baseH);
      mesh.userData.entranceDelay = index * 100; // Stagger entrance by 100ms
      this.cardGroup.add(mesh);
      this.cards.push(mesh);
    });

    if (this.isVisible) {
      this.cardGroup.visible = true;
    }

    // Dynamic Resize & Layout Logic
    this._onResize = () => {
      if (this._resizeRAF) cancelAnimationFrame(this._resizeRAF);
      this._resizeRAF = requestAnimationFrame(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const layoutMode = this._getLayoutMode(vw, vh);

        this._applyResponsiveLayout(vw, vh, layoutMode);

        this.alignCardsToCameraImmediate();
        this._resolveUiSafeZones({ layoutMode });
        this._resolveCardOverlaps({ layoutMode });
        this._resolveViewportBounds({ layoutMode });
        this._compactCardCluster({ layoutMode });
        this._resolveCardOverlaps({ layoutMode });
        this._resolveUiSafeZones({ layoutMode });
        this._resolveViewportBounds({ layoutMode });

        this._resizeRAF = null;
      });
    };

    if (globalThis.window !== undefined) {
      window.addEventListener('resize', this._onResize, { passive: true });
      // Force initial layout
      this._onResize();
    }
  }

  getCardScreenRects() {
    if (!this.renderer || !this.camera || this.cards.length === 0) return [];

    const canvasRect = this.renderer.domElement.getBoundingClientRect();
    const width = canvasRect.width;
    const height = canvasRect.height;

    const tmpVec = new this.THREE.Vector3();
    const tmpVec2 = new this.THREE.Vector3();

    return this.cards.map((card) => {
      card.updateMatrixWorld();
      card.getWorldPosition(tmpVec);
      tmpVec.project(this.camera);
      const cx = (tmpVec.x * 0.5 + 0.5) * width + canvasRect.left;
      const cy = (-tmpVec.y * 0.5 + 0.5) * height + canvasRect.top;

      const halfWWorld = (this._baseW || 2.2) * 0.5 * card.scale.x;
      const halfHWorld = (this._baseH || 2.8) * 0.5 * card.scale.y;

      tmpVec2.set(halfWWorld, 0, 0).applyMatrix4(card.matrixWorld);
      tmpVec2.project(this.camera);
      const rx = (tmpVec2.x * 0.5 + 0.5) * width + canvasRect.left;

      tmpVec2.set(0, halfHWorld, 0).applyMatrix4(card.matrixWorld);
      tmpVec2.project(this.camera);
      const ty = (-tmpVec2.y * 0.5 + 0.5) * height + canvasRect.top;

      const left = Math.min(cx, rx) - Math.abs(rx - cx);
      const right = Math.max(cx, rx);
      const top = Math.min(cy, ty) - Math.abs(ty - cy);
      const bottom = Math.max(cy, ty);

      return { left, top, right, bottom };
    });
  }

  createCardTexture(data) {
    const S = this._getCardTextureScale();

    const W = 700 * S;
    const H = 944 * S;

    const keyObj = {
      title: (data.title || '').slice(0, 256),
      subtitle: (data.subtitle || '').slice(0, 128),
      text: (data.text || '').slice(0, 512),
      cta: (data.cta || '').slice(0, 128),
      meta: (data.meta || '').slice(0, 128),
      routeLabel: (data.routeLabel || '').slice(0, 64),
      iconChar: data.iconChar || '',
      color: data.color || '#ffffff',
      scale: S, // Include scale in key
    };
    const key = JSON.stringify(keyObj);

    const cached = this._textureCache.get(key);
    if (cached?.texture) {
      cached.count++;
      this._profile.cacheHits++;
      return cached.texture;
    }

    this._profile.cacheMisses++;

    let canvas, ctx;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(W, H);
      } else {
        canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
      }
      // Transparency required for rounded corners
      ctx =
        /** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} */ (
          canvas.getContext('2d')
        );
    } catch (e) {
      log.warn('CardManager: canvas creation failed', e);
    }

    if (!ctx) {
      log.warn('CardManager: 2D canvas context unavailable');
      if (!canvas) {
        canvas =
          typeof OffscreenCanvas !== 'undefined'
            ? new OffscreenCanvas(1, 1)
            : document.createElement('canvas');
        if (typeof OffscreenCanvas === 'undefined') {
          canvas.width = 1;
          canvas.height = 1;
        }
      }
      const texture = new this.THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    const titleFontFamily =
      '"Space Grotesk", "SF Pro Display", Arial, sans-serif';
    const bodyFontFamily = '"Manrope", "Inter", Arial, sans-serif';
    const accent = this.hexToRgb(data.color);
    const accentStrong = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.92)`;
    const accentMedium = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.42)`;
    const accentSoft = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.16)`;
    const accentGlow = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.26)`;
    const textStrong = 'rgba(248, 250, 255, 0.98)';
    const textMuted = 'rgba(236, 243, 252, 0.9)';
    const textFaint = 'rgba(223, 232, 246, 0.74)';
    const subtitleText = (data.subtitle || '').trim();
    const metaText = (data.meta || '').trim();
    const routeText = (data.routeLabel || '').trim();
    const titleText = (data.title || '').trim();
    const ctaText = (data.cta || '').trim() || 'Oeffnen';
    const serial = String((data.id ?? 0) + 1).padStart(2, '0');
    const routeDisplay = routeText || 'Bereich';
    const contentInsetX = 72 * S;
    const contentWidth = W - contentInsetX * 2;
    const cardRadius = 52 * S;
    const shellInset = 12 * S;
    const topPanelX = 28 * S;
    const topPanelY = 28 * S;
    const topPanelW = W - 56 * S;
    const topPanelH = 320 * S;
    const footerPanelX = 28 * S;
    const footerPanelY = 730 * S;
    const footerPanelW = W - 56 * S;
    const footerPanelH = 162 * S;

    const backdropGradient = ctx.createLinearGradient(0, 0, W, H);
    backdropGradient.addColorStop(0, 'rgba(6, 10, 22, 0.995)');
    backdropGradient.addColorStop(0.52, 'rgba(7, 12, 26, 0.998)');
    backdropGradient.addColorStop(1, 'rgba(2, 5, 14, 1)');

    this.roundRect(ctx, 0, 0, W, H, cardRadius);
    ctx.fillStyle = backdropGradient;
    ctx.fill();

    ctx.save();
    this.roundRect(ctx, 0, 0, W, H, cardRadius);
    ctx.clip();

    const ambientTop = ctx.createRadialGradient(
      W * 0.82,
      H * 0.12,
      0,
      W * 0.82,
      H * 0.12,
      W * 0.74,
    );
    ambientTop.addColorStop(
      0,
      `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.44)`,
    );
    ambientTop.addColorStop(
      0.4,
      `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.16)`,
    );
    ambientTop.addColorStop(
      1,
      `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0)`,
    );
    ctx.fillStyle = ambientTop;
    ctx.fillRect(0, 0, W, H);

    const ambientBottom = ctx.createRadialGradient(
      W * 0.12,
      H * 0.94,
      0,
      W * 0.12,
      H * 0.94,
      W * 0.56,
    );
    ambientBottom.addColorStop(0, accentGlow);
    ambientBottom.addColorStop(
      0.5,
      `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.08)`,
    );
    ambientBottom.addColorStop(
      1,
      `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0)`,
    );
    ctx.fillStyle = ambientBottom;
    ctx.fillRect(0, 0, W, H);

    const topPanelGradient = ctx.createLinearGradient(
      topPanelX,
      topPanelY,
      topPanelX + topPanelW,
      topPanelY + topPanelH,
    );
    topPanelGradient.addColorStop(
      0,
      `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.34)`,
    );
    topPanelGradient.addColorStop(
      0.3,
      `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.16)`,
    );
    topPanelGradient.addColorStop(0.62, 'rgba(18, 28, 52, 0.42)');
    topPanelGradient.addColorStop(1, 'rgba(8, 12, 24, 0.72)');
    this.roundRect(ctx, topPanelX, topPanelY, topPanelW, topPanelH, 40 * S);
    ctx.fillStyle = topPanelGradient;
    ctx.fill();

    ctx.save();
    this.roundRect(ctx, topPanelX, topPanelY, topPanelW, topPanelH, 40 * S);
    ctx.clip();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
    ctx.lineWidth = 2 * S;
    for (
      let offset = -topPanelH;
      offset < topPanelW + topPanelH;
      offset += 34 * S
    ) {
      ctx.beginPath();
      ctx.moveTo(topPanelX + offset, topPanelY);
      ctx.lineTo(topPanelX + offset + topPanelH, topPanelY + topPanelH);
      ctx.stroke();
    }

    const sweepGradient = ctx.createLinearGradient(
      topPanelX,
      topPanelY,
      topPanelX + topPanelW * 0.64,
      topPanelY + topPanelH,
    );
    sweepGradient.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    sweepGradient.addColorStop(0.28, 'rgba(255, 255, 255, 0.04)');
    sweepGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sweepGradient;
    ctx.fillRect(topPanelX, topPanelY, topPanelW, topPanelH);

    ctx.restore();
    ctx.restore();

    this.drawStarBorder(ctx, 0, 0, W, H, cardRadius, S);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2 * S;
    this.roundRect(
      ctx,
      shellInset,
      shellInset,
      W - shellInset * 2,
      H - shellInset * 2,
      42 * S,
    );
    ctx.stroke();

    ctx.strokeStyle = accentMedium;
    ctx.lineWidth = 2 * S;
    this.roundRect(ctx, topPanelX, topPanelY, topPanelW, topPanelH, 40 * S);
    ctx.stroke();

    ctx.font = `700 ${132 * S}px ${titleFontFamily}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.15)`;
    ctx.fillText(serial, W - 56 * S, 244 * S);

    const subtitleSize = this.fitTextToWidth(
      ctx,
      subtitleText,
      250 * S,
      '700',
      22 * S,
      14 * S,
      bodyFontFamily,
    );
    ctx.font = `700 ${subtitleSize}px ${bodyFontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const subtitleWidth = Math.max(
      160 * S,
      ctx.measureText(subtitleText).width + 56 * S,
    );
    this.drawPill(
      ctx,
      contentInsetX,
      54 * S,
      subtitleWidth,
      48 * S,
      24 * S,
      'rgba(3, 8, 18, 0.32)',
      'rgba(255, 255, 255, 0.14)',
      2 * S,
    );
    ctx.fillStyle = textStrong;
    ctx.fillText(subtitleText, contentInsetX + 28 * S, 78 * S);

    ctx.font = `600 ${18 * S}px ${bodyFontFamily}`;
    ctx.textAlign = 'center';
    const routeChipWidth = Math.max(
      124 * S,
      ctx.measureText(routeDisplay).width + 46 * S,
    );
    this.drawPill(
      ctx,
      W - routeChipWidth - 56 * S,
      56 * S,
      routeChipWidth,
      44 * S,
      22 * S,
      accentSoft,
      accentMedium,
      2 * S,
    );
    ctx.fillStyle = accentStrong;
    ctx.textBaseline = 'middle';
    ctx.fillText(routeDisplay, W - routeChipWidth / 2 - 56 * S, 78 * S);

    const iconBoxX = contentInsetX;
    const iconBoxY = topPanelY + topPanelH - 104 * S;
    const iconBoxSize = 78 * S;
    this.drawPill(
      ctx,
      iconBoxX,
      iconBoxY,
      iconBoxSize,
      iconBoxSize,
      24 * S,
      'rgba(3, 9, 20, 0.34)',
      'rgba(255, 255, 255, 0.16)',
      2 * S,
    );
    ctx.fillStyle = '#ffffff';
    ctx.font = `${50 * S}px "Apple Color Emoji", "Segoe UI Emoji", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      data.iconChar,
      iconBoxX + iconBoxSize / 2,
      iconBoxY + iconBoxSize / 2 + 2 * S,
    );

    ctx.textAlign = 'left';
    ctx.fillStyle = textFaint;
    ctx.font = `700 ${14 * S}px ${bodyFontFamily}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(
      metaText || 'Direkter Einstieg',
      iconBoxX + 96 * S,
      iconBoxY + 26 * S,
    );
    ctx.fillStyle = textStrong;
    ctx.font = `700 ${28 * S}px ${titleFontFamily}`;
    ctx.fillText(routeDisplay, iconBoxX + 96 * S, iconBoxY + 64 * S);

    const titleSize = this.fitTextToWidth(
      ctx,
      titleText,
      contentWidth,
      '700',
      88 * S,
      46 * S,
      titleFontFamily,
    );
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${titleSize}px ${titleFontFamily}`;
    ctx.fillStyle = textStrong;
    ctx.fillText(titleText, contentInsetX, 470 * S);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = textMuted;
    ctx.font = `600 ${18 * S}px ${bodyFontFamily}`;
    ctx.fillText('Direkter Einstieg', contentInsetX, 520 * S);

    const footerGradient = ctx.createLinearGradient(
      footerPanelX,
      footerPanelY,
      footerPanelX + footerPanelW,
      footerPanelY + footerPanelH,
    );
    footerGradient.addColorStop(0, 'rgba(8, 13, 24, 0.96)');
    footerGradient.addColorStop(1, 'rgba(5, 9, 18, 0.98)');
    this.drawPill(
      ctx,
      footerPanelX,
      footerPanelY,
      footerPanelW,
      footerPanelH,
      34 * S,
      footerGradient,
      'rgba(255, 255, 255, 0.1)',
      2 * S,
    );

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = textFaint;
    ctx.font = `700 ${18 * S}px ${bodyFontFamily}`;
    ctx.fillText(routeDisplay, contentInsetX, footerPanelY + 36 * S);

    const ctaHeadlineSize = this.fitTextToWidth(
      ctx,
      ctaText,
      contentWidth - 112 * S,
      '700',
      52 * S,
      24 * S,
      titleFontFamily,
    );
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${ctaHeadlineSize}px ${titleFontFamily}`;
    ctx.fillStyle = textStrong;
    ctx.fillText(ctaText, contentInsetX, footerPanelY + 96 * S);

    ctx.fillStyle = textMuted;
    ctx.font = `600 ${16 * S}px ${bodyFontFamily}`;
    ctx.fillText('Tippen oder klicken', contentInsetX, footerPanelY + 132 * S);

    const arrowCenterX = W - 110 * S;
    const arrowCenterY = footerPanelY + footerPanelH / 2;
    const arrowGradient = ctx.createLinearGradient(
      arrowCenterX - 46 * S,
      arrowCenterY - 46 * S,
      arrowCenterX + 46 * S,
      arrowCenterY + 46 * S,
    );
    arrowGradient.addColorStop(
      0,
      `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.82)`,
    );
    arrowGradient.addColorStop(
      1,
      `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.42)`,
    );
    ctx.beginPath();
    ctx.arc(arrowCenterX, arrowCenterY, 44 * S, 0, Math.PI * 2);
    ctx.fillStyle = arrowGradient;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 2 * S;
    ctx.stroke();

    ctx.fillStyle = '#08111f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${38 * S}px ${titleFontFamily}`;
    ctx.fillText('\u2197', arrowCenterX, arrowCenterY + 2 * S);

    const texture = new this.THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = this.THREE.LinearMipmapLinearFilter;
    texture.magFilter = this.THREE.LinearFilter;
    texture.anisotropy = this._getCardTextureAnisotropy();
    if ('colorSpace' in texture && this.THREE.SRGBColorSpace) {
      texture.colorSpace = this.THREE.SRGBColorSpace;
    }
    texture.needsUpdate = true;

    this._textureCache.set(key, { texture, count: 1 });
    this._profile.texturesCreated++;

    return texture;
  }

  createGlowTexture() {
    const DPR = globalThis.devicePixelRatio
      ? Math.min(globalThis.devicePixelRatio, 2)
      : 1;
    const size = Math.floor(128 * DPR);
    const canvas =
      typeof OffscreenCanvas === 'undefined'
        ? document.createElement('canvas')
        : new OffscreenCanvas(size, size);
    if (typeof OffscreenCanvas === 'undefined') {
      canvas.width = size;
      canvas.height = size;
    }
    const ctx =
      /** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} */ (
        canvas.getContext('2d')
      );
    if (!ctx) {
      const tex = new this.THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    }

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.45;
    const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    const tex = new this.THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = this.THREE.LinearMipmapLinearFilter;
    tex.magFilter = this.THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  drawStarBorder(ctx, x, y, w, h, r, scale) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.08 * scale;
    this.roundRect(ctx, x, y, w, h, r);
    ctx.stroke();

    const tick = 22 * scale;
    const inset = 18 * scale;
    const corners = [
      { x: x + inset, y: y + inset, sx: 1, sy: 1 },
      { x: x + w - inset, y: y + inset, sx: -1, sy: 1 },
      { x: x + inset, y: y + h - inset, sx: 1, sy: -1 },
      { x: x + w - inset, y: y + h - inset, sx: -1, sy: -1 },
    ];

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.8 * scale;

    corners.forEach((corner) => {
      ctx.beginPath();
      ctx.moveTo(corner.x, corner.y);
      ctx.lineTo(corner.x + tick * corner.sx, corner.y);
      ctx.moveTo(corner.x, corner.y);
      ctx.lineTo(corner.x, corner.y + tick * corner.sy);
      ctx.stroke();
    });

    const nodeRadius = 1.5 * scale;
    const nodes = [
      [x + w * 0.18, y + 1.5 * scale],
      [x + w * 0.82, y + 1.5 * scale],
      [x + 1.5 * scale, y + h * 0.26],
      [x + w - 1.5 * scale, y + h * 0.74],
      [x + w * 0.3, y + h - 1.5 * scale],
      [x + w * 0.7, y + h - 1.5 * scale],
    ];

    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    nodes.forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, nodeRadius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  drawPill(ctx, x, y, w, h, r, fillStyle, strokeStyle = null, lineWidth = 1) {
    ctx.save();
    this.roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = fillStyle;
    ctx.fill();

    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    ctx.restore();
  }

  hexToRgb(hex) {
    const raw = String(hex || '')
      .trim()
      .replace('#', '');
    const normalized =
      raw.length === 3
        ? raw
            .split('')
            .map((chunk) => chunk + chunk)
            .join('')
        : raw;
    const parsed = Number.parseInt(normalized.slice(0, 6), 16);

    if (Number.isNaN(parsed)) {
      return { r: 255, g: 255, b: 255 };
    }

    return {
      r: (parsed >> 16) & 255,
      g: (parsed >> 8) & 255,
      b: parsed & 255,
    };
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 5) {
    const words = (text || '').split(' ');
    let line = '';
    let lineCount = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
        lineCount++;
        if (lineCount >= maxLines) {
          line += '...';
          break;
        }
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  fitTextToWidth(
    ctx,
    text,
    maxWidth,
    fontWeight,
    initialSize,
    minSize,
    fontFamily,
  ) {
    if (!text) return minSize;

    // Edge case: if initialSize < minSize, return immediately
    if (initialSize < minSize) {
      log.warn(
        `fitTextToWidth: initialSize (${initialSize}) < minSize (${minSize}), returning minSize`,
      );
      return minSize;
    }

    // Binary search for optimal font size: O(log n) instead of O(n).
    // Reduces ctx.measureText() calls from ~40 (linear) to ~5 (binary).
    let low = minSize;
    let high = initialSize;
    let result = minSize;
    let lastSize = null; // Cache size value to avoid redundant ctx.font assignments

    while (low <= high) {
      const mid = Math.round((low + high) / 2);

      // Only set ctx.font if size changed (Browser font parsing is expensive).
      // Compare numeric size instead of full font string for O(1) comparison.
      if (mid !== lastSize) {
        ctx.font = `${fontWeight} ${mid}px ${fontFamily}`;
        lastSize = mid;
      }

      // measureText can theoretically throw if context is invalid
      let w;
      try {
        w = ctx.measureText(text).width;
      } catch (e) {
        log.warn('measureText failed, returning minSize', e);
        return minSize;
      }

      if (w <= maxWidth) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result;
  }

  setVisible(visible) {
    this.isVisible = visible;
    this.setProgress(visible ? 1 : 0);
  }

  setProgress(progress) {
    const p = Math.max(
      0,
      Math.min(
        1,
        typeof progress === 'number' && !Number.isNaN(progress) ? progress : 0,
      ),
    );
    const wasVisible = this.cardGroup.visible;
    this.cardGroup.visible = p > 0.01;

    if (this.cardGroup.visible && !wasVisible) {
      this.alignCardsToCameraImmediate();
    }

    this.cards.forEach((card) => {
      // Stagger entrance slightly
      const stagger = (card.userData.entranceDelay || 0) / 800;
      const local = Math.max(
        0,
        Math.min(1, (p - stagger) / Math.max(0.0001, 1 - stagger)),
      );
      card.userData.entranceTarget = local;
      card.userData.targetOpacity = local > 0 ? 1 : 0;
    });
  }

  getHoveredCardFromScreen(mousePos) {
    if (!this.raycaster || !this.camera) return null;
    this.raycaster.setFromCamera(mousePos, this.camera);
    const intersects = this.raycaster.intersectObjects(this.cards, false);
    return intersects.length > 0 ? intersects[0].object : null;
  }

  update(time) {
    if (!this.cardGroup.visible) return;

    this.camera.getWorldPosition(this._tmpVec);

    this.cards.forEach((card) => {
      this._updateCardEntranceAndOpacity(card);
      // Removed hover tilt/motion as mouse tracking is disabled
      this._applyOrientation(card);
      this._updateCardGlow(card, time);
    });

    if (
      !this.isVisible &&
      this.cards[0] &&
      this.cards[0].material.opacity < 0.01
    ) {
      this.cardGroup.visible = false;
    }
  }

  _updateCardEntranceAndOpacity(card) {
    const targetEntrance =
      typeof card.userData.entranceTarget === 'number'
        ? card.userData.entranceTarget
        : this.isVisible
          ? 1
          : 0;

    // Speed up the animation so it feels super fluid and snappy (0.12 instead of 0.02)
    card.userData.entranceProgress +=
      (targetEntrance - card.userData.entranceProgress) * 0.15;

    // Lock to zero if it's super close, preventing zombie artifacts during transitions
    if (targetEntrance === 0 && card.userData.entranceProgress < 0.005) {
      card.userData.entranceProgress = 0;
      card.material.opacity = 0;
      return;
    }

    const baseOpacity = card.userData.targetOpacity || 1;
    card.material.opacity =
      baseOpacity * (0.08 + 0.92 * card.userData.entranceProgress);
  }

  _applyOrientation(card) {
    this._orientDummy.position.copy(card.position);
    this._orientDummy.lookAt(this._tmpVec.x, card.position.y, this._tmpVec.z);
    card.quaternion.slerp(this._orientDummy.quaternion, 0.05);
  }

  _updateCardGlow(card, time) {
    if (card.userData?.glow?.material) {
      const glow = card.userData.glow;
      glow.material.opacity =
        Math.max(
          0.05,
          0.56 * (0.5 + 0.5 * Math.sin(time * 0.002 + card.userData.id)),
        ) * card.userData.entranceProgress;
    }
  }

  handleClick(mousePos) {
    const pos = mousePos || this._lastPointerPos || { x: 0, y: 0 };
    if (!this.cardGroup.visible) return;
    const clickedCard = this.getHoveredCardFromScreen(pos);
    if (clickedCard) {
      const link = clickedCard.userData.link;
      if (!link || link === '#') return;
      globalThis.location.href = link;
    }
  }

  attachPointerHandlers(domElement) {
    const el = domElement || this.renderer?.domElement || globalThis;
    if (this._boundPointerMove) this.detachPointerHandlers();

    this._boundPointerMove = (e) => {
      const rect = el.getBoundingClientRect?.() ?? {
        left: 0,
        top: 0,
        width: globalThis.innerWidth,
        height: globalThis.innerHeight,
      };
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._lastPointerPos.x = x;
      this._lastPointerPos.y = y;
    };

    this._boundPointerDown = () => {
      this._pointerDown = true;
      this._pointerDownPos = { ...this._lastPointerPos };
    };

    this._boundPointerUp = () => {
      if (!this._pointerDown) return;
      this._pointerDown = false;
      if (!this._pointerDownPos) return;
      const dx = this._lastPointerPos.x - this._pointerDownPos.x;
      const dy = this._lastPointerPos.y - this._pointerDownPos.y;
      if (Math.hypot(dx, dy) < 0.04) this.handleClick(this._lastPointerPos);
      this._pointerDownPos = null;
    };

    el.addEventListener('pointermove', this._boundPointerMove, {
      passive: true,
    });
    el.addEventListener('pointerdown', this._boundPointerDown, {
      passive: true,
    });
    el.addEventListener('pointerup', this._boundPointerUp, {
      passive: true,
    });
    this._pointerElement = el;
  }

  detachPointerHandlers() {
    const el = this._pointerElement || this.renderer?.domElement || globalThis;
    if (!el) return;
    if (this._boundPointerMove)
      el.removeEventListener('pointermove', this._boundPointerMove);
    if (this._boundPointerDown)
      el.removeEventListener('pointerdown', this._boundPointerDown);
    if (this._boundPointerUp)
      el.removeEventListener('pointerup', this._boundPointerUp);
    this._pointerElement = null;
  }

  getProfilingData() {
    return {
      texturesCreated: this._profile.texturesCreated,
      texturesDisposed: this._profile.texturesDisposed,
      cacheHits: this._profile.cacheHits,
      cacheMisses: this._profile.cacheMisses,
      cachedTextures: this._textureCache.size,
    };
  }

  alignCardsToCameraImmediate() {
    if (!this.camera) return;
    this.camera.getWorldPosition(this._tmpVec);
    this.cards.forEach((card) => {
      this._orientDummy.position.copy(card.position);
      this._orientDummy.lookAt(this._tmpVec.x, card.position.y, this._tmpVec.z);
      card.quaternion.copy(this._orientDummy.quaternion);
    });
  }

  cleanup() {
    this.scene.remove(this.cardGroup);
    this.cards.forEach((card) => this._disposeCardResources(card));
    if (this._sharedGeometry) {
      this._sharedGeometry.dispose();
      this._sharedGeometry = null;
    }
    if (this._sharedGlowTexture?.dispose) {
      this._sharedGlowTexture.dispose();
      this._sharedGlowTexture = null;
    }
    this.cards = [];
    this._disposeCachedTextures();
    try {
      this.detachPointerHandlers();
    } catch {
      /* ignore */
    }
    this._removeResizeHandler();
  }

  _disposeCardResources(card) {
    try {
      if (card.geometry?.dispose && card.geometry !== this._sharedGeometry)
        card.geometry.dispose();
      if (card.material) {
        this._releaseTextureFromCache(card.material.map);
        card.material.map = null;
        card.material.dispose?.();
      }
      const glow = card.userData?.glow;
      if (glow?.material) this._disposeGlowMaterial(glow);
    } catch (err) {
      log.warn('EarthCards: disposal error', err);
    }
  }

  _disposeCachedTextures() {
    for (const [, v] of this._textureCache.entries()) {
      try {
        if (v.texture?.dispose) {
          v.texture.dispose();
          this._profile.texturesDisposed++;
        }
      } catch (err) {
        log.warn('EarthCards: error disposing cached texture', err);
      }
    }
    this._textureCache.clear();
  }

  _releaseTextureFromCache(map) {
    if (!map) return;
    try {
      let foundKey = null;
      for (const [k, v] of this._textureCache.entries()) {
        if (v.texture === map) {
          foundKey = k;
          v.count--;
          if (v.count <= 0) {
            if (v.texture?.dispose) {
              v.texture.dispose();
              this._profile.texturesDisposed++;
            }
            this._textureCache.delete(k);
          }
          break;
        }
      }
      if (!foundKey && map?.dispose) map.dispose();
    } catch (err) {
      log.warn('EarthCards: releaseTextureFromCache failed', err);
    }
  }

  _disposeGlowMaterial(glow) {
    try {
      if (
        glow.material.map?.dispose &&
        glow.material.map !== this._sharedGlowTexture
      )
        glow.material.map.dispose();
      glow.material.dispose?.();
    } catch (err) {
      log.warn('EarthCards: glow dispose failed', err);
    }
  }

  _removeResizeHandler() {
    try {
      globalThis.removeEventListener('resize', this._onResize);
    } catch {
      /* ignore */
    }
    this._onResize = null;
    if (this._resizeRAF) {
      cancelAnimationFrame(this._resizeRAF);
      this._resizeRAF = null;
    }
  }

  _createMeshFromData(data, index, baseW, baseH) {
    const texture = this.createCardTexture(data);
    const material = new this.THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: this.THREE.DoubleSide,
      opacity: 0,
      alphaTest: 0.03,
      depthWrite: false,
    });

    const mesh = new this.THREE.Mesh(this._sharedGeometry, material);
    mesh.position.set(data.position.x, data.position.y - 0.8, data.position.z);
    mesh.renderOrder = 12;

    const viewportScale = Math.min(1, (globalThis.innerWidth || 1200) / 1200);
    const scale = 1.06 * Math.max(0.94, viewportScale);
    mesh.scale.setScalar(scale);

    mesh.userData = {
      isCard: true,
      link: data.link,
      originalY: data.position.y,
      hoverY: data.position.y + 0.5,
      originalZ: 0,
      baseScale: scale, // Store for hover calculation
      targetOpacity: 1,
      id: data.id,
      entranceDelay: index * 80,
      entranceProgress: 0,
      hoverProgress: 0,
      parallaxStrength: 0.14,
    };

    const glowMat = new this.THREE.SpriteMaterial({
      map: this._sharedGlowTexture,
      color: data.color,
      transparent: true,
      blending: this.THREE.AdditiveBlending,
      depthWrite: false,
    });

    const glow = new this.THREE.Sprite(glowMat);
    glow.scale.set(baseW * 1.22, baseH * 0.82, 1);
    glow.position.set(0, 0.02, -0.01);
    glow.renderOrder = 11;
    mesh.add(glow);
    mesh.userData.glow = glow;

    return mesh;
  }
}
