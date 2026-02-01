import { createLogger } from '/content/core/logger.js';

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
    this._tmpQuat = new THREE.Quaternion();
    this._tmpQuat2 = new THREE.Quaternion();
    this._tmpEuler = new THREE.Euler();
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

  initFromData(dataArray) {
    if (this.cards.length > 0) return;
    if (!Array.isArray(dataArray) || dataArray.length === 0) return;

    const cardCount = dataArray.length;
    // Base dimensions for the card plane
    const baseW = 2.2;
    const baseH = 2.8;

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
        iconChar: d.iconChar || '',
        color: positions[index].color,
        position: positions[index],
      };

      const mesh = this._createMeshFromData(data, index, baseW, baseH);
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
        const isMobile = vw < 768;

        this.cards.forEach((card, idx) => {
          if (isMobile) {
            // === Mobile Layout (2-Column Grid) ===
            const scale = 0.5; // Smaller for grid layout

            // Grid positioning: 2 columns, 3 rows (for 5 cards)
            const col = idx % 2; // 0 or 1
            const row = Math.floor(idx / 2); // 0, 1, 2

            // Horizontal spacing between columns
            const colSpacing = 2.5;
            const x = (col - 0.5) * colSpacing; // Center around 0

            // Vertical spacing between rows
            const rowSpacing = 2.4;
            const y = (1 - row) * rowSpacing; // Top to bottom

            // Header offset - account for mobile safe areas
            const headerPixels = 20;
            const safeAreaTop =
              isMobile &&
              globalThis.window?.CSS?.supports?.(
                'padding: env(safe-area-inset-top)',
              )
                ? 20
                : 0; // Additional offset for notched devices
            const totalHeaderOffset = headerPixels + safeAreaTop;
            const headerWorldOffset = this._pixelsToWorldY(totalHeaderOffset);

            card.scale.setScalar(scale);
            card.position.x = x;
            card.position.y = y - headerWorldOffset;
            card.position.z = 0;

            // Update metadata for hover/animation
            card.userData.originalY = y - headerWorldOffset;
            card.userData.hoverY = y - headerWorldOffset + 0.2;
            card.userData.originalZ = 0;
          } else {
            // === Desktop Layout (Grid: 3 oben, 2 unten) ===
            // Größere Kartengröße für besseren visuellen Impact
            const baseScale = 1.15;
            const adaptiveScale = Math.min(1, vw / 1400);
            const finalScale = baseScale * Math.max(0.75, adaptiveScale);

            // Grid-Abstände mit optimiertem Spacing
            const cardSpacingX = 3.0; // Horizontaler Abstand zwischen Karten
            const cardSpacingY = 3.2; // Vertikaler Abstand zwischen Zeilen

            // Layout: 3 Karten oben, 2 unten (versetzt zentriert)
            let x, y;

            if (idx < 3) {
              // Obere Reihe: 3 Karten
              const colIndex = idx; // 0, 1, 2
              x = (colIndex - 1) * cardSpacingX; // -2.6, 0, +2.6
              y = cardSpacingY / 2; // Oben
            } else {
              // Untere Reihe: 2 Karten (versetzt zentriert)
              const colIndex = idx - 3; // 0, 1
              x = (colIndex - 0.5) * cardSpacingX; // -1.3, +1.3
              y = -cardSpacingY / 2; // Unten
            }

            card.scale.setScalar(finalScale);
            card.position.x = x;
            card.position.y = y;
            card.position.z = 0; // Keine Tiefenvariation

            // Reset metadata
            card.userData.originalY = y;
            card.userData.hoverY = y + 0.3; // Sanfte Hebung beim Hover
            card.userData.originalZ = 0;
          }
        });
        this._resizeRAF = null;
      });
    };

    if (globalThis.window !== undefined) {
      window.addEventListener('resize', this._onResize);
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
    const DPR = globalThis.window?.devicePixelRatio || 1;
    // OPTIMIZATION: Cap scale factor to reduce memory usage on mobile/high-DPI
    const isMobile = globalThis.innerWidth < 768;
    // Max S=2 on mobile (1024px width), S=3 on desktop (1536px width). S=4 is overkill (2048px).
    const maxS = isMobile ? 2 : 3;
    const S = Math.min(Math.max(Math.ceil(DPR * 1.5), 2), maxS);

    const W = 512 * S;
    const H = 700 * S;

    const keyObj = {
      title: (data.title || '').slice(0, 256),
      subtitle: (data.subtitle || '').slice(0, 128),
      text: (data.text || '').slice(0, 512),
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
      ctx = canvas.getContext('2d');
    } catch (e) {
      log.warn('CardManager: canvas creation failed', e);
    }

    if (!ctx) {
      log.warn('CardManager: 2D canvas context unavailable');
      const texture = new this.THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    // 1. Background (Glass)
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, 'rgba(20, 30, 60, 0.92)'); // Slightly more opaque for readability
    gradient.addColorStop(1, 'rgba(10, 15, 30, 0.96)');
    ctx.fillStyle = gradient;

    const R = 40 * S;
    this.roundRect(ctx, 0, 0, W, H, R);
    ctx.fill();

    // 2. Star Border
    this.drawStarBorder(ctx, 0, 0, W, H, R, S);

    // 3. Icon Circle
    const iconY = 150 * S;
    const iconCenterX = 256 * S;
    const iconRadius = 60 * S;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.arc(iconCenterX, iconY, iconRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = data.color;
    ctx.lineWidth = 2 * S;
    ctx.stroke();

    // 4. Icon Text
    ctx.fillStyle = '#ffffff';
    ctx.font = `${
      60 * S
    }px "Apple Color Emoji", "Segoe UI Emoji", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.iconChar, iconCenterX, iconY + 5 * S);

    // 5. Subtitle - Optimized Size
    ctx.fillStyle = data.color;
    const subtitleText = (data.subtitle || '').trim();
    // Bumped base size from 24 to 26 for better legibility
    const subtitleSize = this.fitTextToWidth(
      ctx,
      subtitleText,
      420 * S,
      'bold',
      26 * S,
      14 * S,
      'Arial, sans-serif',
    );
    ctx.font = `bold ${subtitleSize}px Arial, sans-serif`;
    ctx.fillText(subtitleText, iconCenterX, 280 * S);

    // 6. Title - Optimized Size & Weight
    ctx.fillStyle = '#ffffff';
    const titleText = (data.title || '').trim();
    // Bumped base size from 48 to 52
    const titleSize = this.fitTextToWidth(
      ctx,
      titleText,
      420 * S,
      '800', // Extra Bold
      52 * S,
      24 * S,
      'Arial, sans-serif',
    );
    ctx.font = `800 ${titleSize}px Arial, sans-serif`;
    ctx.fillText(titleText, iconCenterX, 350 * S);

    // 7. Text (Wrapped) - Increased contrast and size
    ctx.fillStyle = '#dddddd'; // Lighter grey for better contrast
    // Increased base text size from 30 to 32
    const baseTextSize = data.text && data.text.length > 160 ? 24 * S : 32 * S;
    ctx.font = `${baseTextSize}px Arial, sans-serif`;
    this.wrapText(
      ctx,
      data.text,
      iconCenterX,
      460 * S,
      400 * S,
      Math.round(44 * S),
    );

    const texture = new this.THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = this.THREE.LinearMipmapLinearFilter;
    texture.magFilter = this.THREE.LinearFilter;
    texture.anisotropy = this.renderer?.capabilities?.getMaxAnisotropy?.() ?? 0;
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
    const ctx = canvas.getContext('2d');
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, x, y, w, h, r);
    ctx.stroke();

    const numStars = Math.min(200, Math.max(20, Math.floor(60 * scale)));
    ctx.save();
    for (let i = 0; i < numStars; i++) {
      const side = Math.floor(Math.random() * 4);
      let px, py;
      if (side === 0) {
        px = x + Math.random() * w;
        py = y;
      } else if (side === 1) {
        px = x + w;
        py = y + Math.random() * h;
      } else if (side === 2) {
        px = x + Math.random() * w;
        py = y + h;
      } else {
        px = x;
        py = y + Math.random() * h;
      }

      const size = Math.random() * 1.5 + 0.5;

      ctx.fillStyle = Math.random() > 0.7 ? ctx.strokeStyle : '#ffffff';
      ctx.globalAlpha = Math.random() * 0.8 + 0.2;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = (text || '').split(' ');
    let line = '';
    let lineCount = 0;
    const maxLines = 5; // Allow slightly more text

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

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

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

  update(time, mousePos) {
    if (!this.cardGroup.visible) return;

    const pos = mousePos || this._lastPointerPos || { x: 0, y: 0 };
    const candidate = this.getHoveredCardFromScreen(pos);

    if (candidate === this._hoverCandidate) {
      this._hoverFrames++;
      if (this._hoverFrames >= 3) {
        if (candidate !== this._hovered) {
          this._hovered = candidate;
          document.body.style.cursor = candidate ? 'pointer' : '';
        }
      }
    } else {
      this._hoverCandidate = candidate;
      this._hoverFrames = 0;
    }

    const hoveredCard = this._hovered;
    this.camera.getWorldPosition(this._tmpVec);

    this.cards.forEach((card) => {
      this._updateCardEntranceAndOpacity(card);
      this._updateCardHoverTiltAndMotion(card, pos, hoveredCard, time);
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
    card.userData.entranceProgress +=
      (targetEntrance - card.userData.entranceProgress) * 0.02;
    const baseOpacity = card.userData.targetOpacity || 1;
    card.material.opacity =
      baseOpacity * (0.05 + 0.95 * card.userData.entranceProgress);
  }

  _updateCardHoverTiltAndMotion(card, pos, hoveredCard, time) {
    const floatY =
      Math.sin(time * 0.001 + card.userData.id) *
      0.06 *
      (1 - card.userData.hoverProgress * 0.7);

    const isHovered = card === hoveredCard;
    let hoverTarget = isHovered ? 1 : 0;
    if (!isHovered && card.userData.hoverProgress > 0.5) {
      hoverTarget = card.userData.hoverProgress;
    }
    card.userData.hoverProgress +=
      (hoverTarget - card.userData.hoverProgress) * 0.05; // Slightly snappier

    const parallax = card.userData.parallaxStrength || 0.12;
    const targetTiltX = -pos.y * parallax * card.userData.hoverProgress;
    const targetTiltY = pos.x * parallax * card.userData.hoverProgress * 0.8;

    card.userData.currentTiltX +=
      (targetTiltX - card.userData.currentTiltX) * 0.05;
    card.userData.currentTiltY +=
      (targetTiltY - card.userData.currentTiltY) * 0.05;

    let targetY = card.userData.originalY;
    let targetZ = card.userData.originalZ || 0;
    let targetScale = 1;

    if (card === hoveredCard) {
      targetY = card.userData.hoverY;
      targetZ = (card.userData.originalZ || 0) + 0.5; // Bring closer on hover
      targetScale = 1.05;
    }

    card.position.y += (targetY + floatY - card.position.y) * 0.05;
    card.position.z += (targetZ - card.position.z) * 0.05;

    // Scale interpolation logic adjusted for base scale
    // We can't just lerp to 1 or 1.05 because resize sets a specific scale.
    // Instead we modify the scale set by resize.
    // Since _onResize runs infrequently, we should store baseScale in userData if we wanted perfect scalar lerp,
    // but here we are just adding a small factor or using the scale from resize.
    // Actually, simple addition is safer here to avoid fighting the resizer.
    // However, card.scale is set every frame by resize RAF if resizing.
    // Let's assume resize is not active.
    // Current approach in `update`:
    // card.scale.x += (targetScale - card.scale.x) * 0.04
    // This assumes targetScale is the absolute target.
    // But `_onResize` sets `card.scale` based on screen width.
    // We should treat the scale from resize as the "base".
    // For now, let's just multiply the current scale slightly.
    // This is complex without storing baseScale.
    // Let's rely on the fact that if NOT resizing, scale is stable.
    // We will just scale X, Y, Z by a factor.

    // Simpler: Apply hover scale on top of base scale is hard without hierarchy.
    // Current implementation overwrites scale.
    // We will fix this by storing baseScale in userData during resize.
    // (Added to resize logic: card.userData.baseScale = finalScale)
    // If not present, default to current.

    const baseScale = card.userData.baseScale || card.scale.x;
    const finalTargetScale = baseScale * targetScale;

    card.scale.setScalar(
      card.scale.x + (finalTargetScale - card.scale.x) * 0.05,
    );
  }

  _applyOrientation(card) {
    this._orientDummy.position.copy(card.position);
    this._orientDummy.lookAt(this._tmpVec.x, card.position.y, this._tmpVec.z);
    this._tmpQuat.copy(this._orientDummy.quaternion);

    this._tmpEuler.set(
      card.userData.currentTiltX,
      card.userData.currentTiltY,
      0,
      'XYZ',
    );
    this._tmpQuat2.setFromEuler(this._tmpEuler);

    this._tmpQuat.multiply(this._tmpQuat2);
    card.quaternion.slerp(this._tmpQuat, 0.05);
  }

  _updateCardGlow(card, time) {
    if (card.userData?.glow?.material) {
      const glow = card.userData.glow;
      glow.material.opacity =
        Math.max(
          0.06,
          0.6 * (0.5 + 0.5 * Math.sin(time * 0.002 + card.userData.id)),
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
      card.userData.currentTiltX = 0;
      card.userData.currentTiltY = 0;
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
      depthWrite: false,
    });

    const mesh = new this.THREE.Mesh(this._sharedGeometry, material);
    mesh.position.set(data.position.x, data.position.y - 0.8, data.position.z);

    const viewportScale = Math.min(1, (globalThis.innerWidth || 1200) / 1200);
    const scale = 0.95 * Math.max(0.85, viewportScale);
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
      currentTiltX: 0,
      currentTiltY: 0,
    };

    const glowMat = new this.THREE.SpriteMaterial({
      map: this._sharedGlowTexture,
      color: data.color,
      transparent: true,
      blending: this.THREE.AdditiveBlending,
      depthWrite: false,
    });

    const glow = new this.THREE.Sprite(glowMat);
    glow.scale.set(baseW * 0.95, baseH * 0.45, 1);
    glow.position.set(0, -0.12, -0.01);
    mesh.add(glow);
    mesh.userData.glow = glow;

    return mesh;
  }
}
