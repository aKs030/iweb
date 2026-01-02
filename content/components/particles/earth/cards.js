import { createLogger } from "../../../utils/shared-utilities.js";

const log = createLogger("CardManager");

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
    // Map<key, {texture: CanvasTexture, count: number}>
    this._textureCache = new Map();

    // Profiling counters (useful for optional profiling/debugging)
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
    const canvasRect = this.renderer.domElement.getBoundingClientRect();
    const height = canvasRect.height || (globalThis.window?.innerHeight ?? 800);
    if (!height) return 0;
    // NDC delta (top/bottom range is -1..1 => total 2 units)
    const ndcDelta = (pixels / height) * 2;
    const v1 = new this.THREE.Vector3(0, 0, 0.5);
    const v2 = new this.THREE.Vector3(0, -ndcDelta, 0.5);
    v1.unproject(this.camera);
    v2.unproject(this.camera);
    return v2.y - v1.y;
  }

  initFromData(dataArray) {
    if (this.cards.length > 0) return;
    if (!Array.isArray(dataArray) || dataArray.length === 0) return;

    log.debug(`Initializing ${dataArray.length} cards from data`);

    // Compute layout as before
    const cardCount = dataArray.length;
    const baseW = 2.2;
    const baseH = 2.8;
    const spacing = baseW * (cardCount > 2 ? 1.4 : 1.25);
    const centerOffset = (cardCount - 1) / 2;

    this._baseW = baseW;
    this._baseH = baseH;

    const positions = dataArray.map((d, i) => ({
      x: (i - centerOffset) * spacing,
      y: 0,
      z: 0,
      color: d.color || ["#07a1ff", "#a107ff", "#ff07a1"][i] || "#ffffff",
    }));

    // Shared geometry reused across cards to reduce memory / GC churn
    this._sharedGeometry = new this.THREE.PlaneGeometry(baseW, baseH);

    // Prepare shared glow texture (small radial gradient) once
    if (!this._sharedGlowTexture)
      this._sharedGlowTexture = this.createGlowTexture();

    dataArray.forEach((d, index) => {
      const data = {
        id: index,
        title: d.title || "",
        subtitle: d.subtitle || "",
        text: d.text || "",
        link: d.link || "#",
        iconChar: d.iconChar || "",
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

    // Recompute positions on resize to maintain spacing and fit (throttled via rAF)
    this._onResize = () => {
      if (this._resizeRAF) cancelAnimationFrame(this._resizeRAF);
      this._resizeRAF = requestAnimationFrame(() => {
        const vw = window.innerWidth;
        const isMobile = vw < 768;

        this.cards.forEach((card, idx) => {
          if (isMobile) {
            // Mobile: Vertical Stack — push cards down to avoid overlapping the fixed header/menu
            const scale = 0.82;
            const spacingY = 2.9;
            const y = (centerOffset - idx) * spacingY;

            // Compute an approximate world-space offset that corresponds to the header height in pixels
            const headerPixels = 76; // approx header height + spacing used in CSS
            const headerWorldOffset = this._pixelsToWorldY(headerPixels);

            card.scale.setScalar(scale);
            card.position.x = 0;
            // Move cards down by subtracting the world offset (positive headerWorldOffset moves cards down)
            const finalY = y - headerWorldOffset;
            card.position.y = finalY;

            // Update metadata for animation loop
            card.userData.originalY = finalY;
            card.userData.hoverY = finalY + 0.2; // Reduced hover lift on mobile
          } else {
            // Desktop: Horizontal Row
            const adaptiveScale = Math.min(1, vw / 1200);
            const newSpacing =
              baseW *
              (cardCount > 2 ? 1.4 : 1.25) *
              Math.max(0.85, adaptiveScale);
            const x = (idx - centerOffset) * newSpacing;

            card.scale.setScalar(0.95 * Math.max(0.65, adaptiveScale));
            card.position.x = x;
            card.position.y = 0;

            // Reset metadata
            card.userData.originalY = 0;
            card.userData.hoverY = 0.5;
          }
        });
        this._resizeRAF = null;
      });
    };

    if (globalThis.window !== undefined) {
      window.addEventListener("resize", this._onResize);
      // Force initial layout
      this._onResize();
    }
  }

  // Return bounding rects in page coordinates for each card mesh so DOM-based
  // systems can align effects (e.g., star transitions) without requiring HTML cards.
  getCardScreenRects() {
    if (!this.renderer || !this.camera || this.cards.length === 0) return [];

    const canvasRect = this.renderer.domElement.getBoundingClientRect();
    const width = canvasRect.width;
    const height = canvasRect.height;

    const tmpVec = new this.THREE.Vector3();
    const tmpVec2 = new this.THREE.Vector3();

    return this.cards.map((card) => {
      // Center
      card.updateMatrixWorld();
      card.getWorldPosition(tmpVec);
      tmpVec.project(this.camera);
      const cx = (tmpVec.x * 0.5 + 0.5) * width + canvasRect.left;
      const cy = (-tmpVec.y * 0.5 + 0.5) * height + canvasRect.top;

      // Approximate half-width/height in pixels by projecting edge offsets
      const halfWWorld = (this._baseW || 2.2) * 0.5 * card.scale.x;
      const halfHWorld = (this._baseH || 2.8) * 0.5 * card.scale.y;

      // Right edge
      tmpVec2.set(halfWWorld, 0, 0).applyMatrix4(card.matrixWorld);
      tmpVec2.project(this.camera);
      const rx = (tmpVec2.x * 0.5 + 0.5) * width + canvasRect.left;

      // Top edge
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
    // Determine a scaling factor based on device pixel ratio to keep text crisp
    const DPR = globalThis.window?.devicePixelRatio
      ? globalThis.window.devicePixelRatio
      : 1;
    // Scale aggressively on high-DPI displays for crisper text, clamped for performance
    const S = Math.min(Math.max(Math.ceil(DPR * 2), 2), 4);
    const W = 512 * S;
    const H = 700 * S;

    // Create a stable cache key from relevant content (limit text length to avoid huge keys)
    const keyObj = {
      title: (data.title || "").slice(0, 256),
      subtitle: (data.subtitle || "").slice(0, 128),
      text: (data.text || "").slice(0, 512),
      iconChar: data.iconChar || "",
      color: data.color || "#ffffff",
      DPR: Math.round(DPR * 100), // quantize a bit
    };
    const key = JSON.stringify(keyObj);

    // Use cache if available
    const cached = this._textureCache.get(key);
    if (cached?.texture) {
      cached.count++;
      this._profile.cacheHits++;
      return cached.texture;
    }

    // Miss - create a new canvas texture
    this._profile.cacheMisses++;

    const canvas =
      typeof OffscreenCanvas === "undefined"
        ? document.createElement("canvas")
        : new OffscreenCanvas(W, H);
    if (typeof OffscreenCanvas === "undefined") {
      canvas.width = W;
      canvas.height = H;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // Defensive: Some environments may not provide a 2D context; return a minimal texture
      log.warn(
        "CardManager: 2D canvas context unavailable; returning empty texture"
      );
      const texture = new this.THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      // don't add to cache (no meaningful content)
      return texture;
    }

    // 1. Background (Glass effect simulation)
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, "rgba(20, 30, 60, 0.9)");
    gradient.addColorStop(1, "rgba(10, 15, 30, 0.95)");
    ctx.fillStyle = gradient;

    const R = 40 * S;
    this.roundRect(ctx, 0, 0, W, H, R);
    ctx.fill();

    // 2. Star Border (Fine line + Dots)
    this.drawStarBorder(ctx, 0, 0, W, H, R, S);

    // 3. Icon Circle
    const iconY = 150 * S;
    const iconCenterX = 256 * S;
    const iconRadius = 60 * S;

    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.arc(iconCenterX, iconY, iconRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = data.color;
    ctx.lineWidth = 2 * S;
    ctx.stroke();

    // 4. Icon Text (Emoji/Char) - use emoji-capable font stack as fallback
    ctx.fillStyle = "#ffffff";
    ctx.font = `${
      60 * S
    }px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(data.iconChar, iconCenterX, iconY + 5 * S);

    // 5. Subtitle (fit to width)
    ctx.fillStyle = data.color;
    const subtitleText = (data.subtitle || "").trim();
    const subtitleSize = this.fitTextToWidth(
      ctx,
      subtitleText,
      420 * S,
      "bold",
      24 * S,
      12 * S,
      'Arial, "Helvetica Neue", sans-serif'
    );
    ctx.font = `bold ${subtitleSize}px Arial, "Helvetica Neue", sans-serif`;
    ctx.fillText(subtitleText, iconCenterX, 280 * S);

    // 6. Title (fit to width, prefer single line)
    ctx.fillStyle = "#ffffff";
    const titleText = (data.title || "").trim();
    const titleSize = this.fitTextToWidth(
      ctx,
      titleText,
      420 * S,
      "bold",
      48 * S,
      20 * S,
      'Arial, "Helvetica Neue", sans-serif'
    );
    ctx.font = `bold ${titleSize}px Arial, "Helvetica Neue", sans-serif`;
    ctx.fillText(titleText, iconCenterX, 350 * S);

    // 7. Text (Wrapped) - reduce size slightly for long text
    ctx.fillStyle = "#cccccc";
    const baseTextSize =
      data.text && data.text.length > 160 ? Math.max(18 * S, 22 * S) : 30 * S;
    ctx.font = `${baseTextSize}px Arial, "Helvetica Neue", sans-serif`;
    this.wrapText(
      ctx,
      data.text,
      iconCenterX,
      450 * S,
      400 * S,
      Math.round(40 * S)
    );

    const texture = new this.THREE.CanvasTexture(canvas);
    // Use mipmaps + linear mipmap filtering for crisper downscaled rendering
    texture.generateMipmaps = true;
    texture.minFilter = this.THREE.LinearMipmapLinearFilter;
    texture.magFilter = this.THREE.LinearFilter;
    texture.anisotropy = this.renderer?.capabilities?.getMaxAnisotropy?.() ?? 0;
    texture.needsUpdate = true;

    // Store in cache with reference count
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
      typeof OffscreenCanvas === "undefined"
        ? document.createElement("canvas")
        : new OffscreenCanvas(size, size);
    if (typeof OffscreenCanvas === "undefined") {
      canvas.width = size;
      canvas.height = size;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      log.warn(
        "CardManager: 2D canvas context unavailable for glow; returning empty texture"
      );
      const tex = new this.THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    }

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.45;
    const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.3, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");

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
    // Fine line - keeping it thin relative to the scaled size to appear "finer"
    // Using 1.5 * scale would be proportional. Using just 1.5 or 2 makes it very thin on high res.
    // Let's go with 1.5 pixels absolute thickness on the scaled canvas.
    // Since we scale by 2, a 1.5px line is effectively 0.75px on the original geometry.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, x, y, w, h, r);
    ctx.stroke();

    // Dots
    const numStars = Math.min(200, Math.max(20, Math.floor(60 * scale))); // scale-dependent density
    ctx.save();
    for (let i = 0; i < numStars; i++) {
      // Random position along perimeter approximation
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

      // Smaller size for "finer" look.
      // Original was: Math.random() * 2 + 0.5 (relative to 1x scale)
      // We want it smaller.
      // Let's try 0.5 to 2.0 pixels on the 2x canvas (0.25 to 1.0 effective).
      const size = Math.random() * 1.5 + 0.5;

      ctx.fillStyle = Math.random() > 0.7 ? ctx.strokeStyle : "#ffffff";
      ctx.globalAlpha = Math.random() * 0.8 + 0.2;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = (text || "").split(" ");
    let line = "";
    let lineCount = 0;
    const maxLines = 4;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + " ";
        y += lineHeight;
        lineCount++;
        if (lineCount >= maxLines) {
          line += "...";
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
    fontWeight = "normal",
    initialSize = 24,
    minSize = 12,
    fontFamily = "Arial, sans-serif"
  ) {
    if (!text) return initialSize;
    let size = initialSize;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    while (size >= minSize) {
      ctx.font = `${fontWeight} ${Math.round(size)}px ${fontFamily}`;
      const w = ctx.measureText(text).width;
      if (w <= maxWidth) break;
      size -= 1;
    }
    return Math.max(minSize, Math.round(size));
  }

  setVisible(visible) {
    // Backwards-compatible: map visible boolean to progress target
    this.isVisible = visible;
    this.setProgress(visible ? 1 : 0);
  }

  setProgress(progress) {
    const p = Math.max(
      0,
      Math.min(
        1,
        typeof progress === "number" && !Number.isNaN(progress) ? progress : 0
      )
    );
    const wasVisible = this.cardGroup.visible;
    this.cardGroup.visible = p > 0.01;

    // If becoming visible right now, snap cards to face the camera to avoid
    // a brief incorrect orientation during the entrance animation.
    if (this.cardGroup.visible && !wasVisible) {
      this.alignCardsToCameraImmediate();
    }

    this.cards.forEach((card) => {
      // account for per-card stagger using entranceDelay
      const stagger = (card.userData.entranceDelay || 0) / 800;
      const local = Math.max(
        0,
        Math.min(1, (p - stagger) / Math.max(0.0001, 1 - stagger))
      );
      card.userData.entranceTarget = local;
      // Also map opacity target so the material fades out gracefully
      card.userData.targetOpacity = local > 0 ? 1 : 0;
    });
  }

  // Robust hover detection using Raycaster (replacing custom projection math)
  getHoveredCardFromScreen(mousePos) {
    if (!this.raycaster || !this.camera) return null;

    this.raycaster.setFromCamera(mousePos, this.camera);
    const intersects = this.raycaster.intersectObjects(this.cards, false);

    if (intersects.length > 0) {
      // Raycaster automatically sorts by distance, so the first hit is the closest
      return intersects[0].object;
    }

    return null;
  }

  update(time, mousePos) {
    if (!this.cardGroup.visible) return;

    // Use new screen-based hover detection instead of raycaster
    const pos = mousePos || this._lastPointerPos || { x: 0, y: 0 };
    const candidate = this.getHoveredCardFromScreen(pos);

    // Debounce hover to prevent flickering from rapid mouse movements
    if (candidate === this._hoverCandidate) {
      this._hoverFrames++;
      if (this._hoverFrames >= 3) {
        // Stable for 3 frames
        if (candidate !== this._hovered) {
          this._hovered = candidate;
          document.body.style.cursor = candidate ? "pointer" : "";
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
    let targetEntrance;
    if (typeof card.userData.entranceTarget === "number") {
      targetEntrance = card.userData.entranceTarget;
    } else {
      targetEntrance = this.isVisible ? 1 : 0;
    }
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
      (hoverTarget - card.userData.hoverProgress) * 0.04;

    const parallax = card.userData.parallaxStrength || 0.12;
    const targetTiltX = -pos.y * parallax * card.userData.hoverProgress;
    const targetTiltY = pos.x * parallax * card.userData.hoverProgress * 0.8;

    card.userData.currentTiltX +=
      (targetTiltX - card.userData.currentTiltX) * 0.04;
    card.userData.currentTiltY +=
      (targetTiltY - card.userData.currentTiltY) * 0.04;

    let targetY = card.userData.originalY;
    let targetScale = 1;
    if (card === hoveredCard) {
      targetY = card.userData.hoverY;
      targetScale = 1.05;
    }

    card.position.y += (targetY + floatY - card.position.y) * 0.04;
    card.scale.setScalar(card.scale.x + (targetScale - card.scale.x) * 0.04);
  }

  _applyOrientation(card) {
    this._orientDummy.position.copy(card.position);
    this._orientDummy.lookAt(this._tmpVec.x, card.position.y, this._tmpVec.z);
    this._tmpQuat.copy(this._orientDummy.quaternion);

    this._tmpEuler.set(
      card.userData.currentTiltX,
      card.userData.currentTiltY,
      0,
      "XYZ"
    );
    this._tmpQuat2.setFromEuler(this._tmpEuler);

    this._tmpQuat.multiply(this._tmpQuat2);
    card.quaternion.slerp(this._tmpQuat, 0.04);
  }

  _updateCardGlow(card, time) {
    if (card.userData?.glow?.material) {
      const glow = card.userData.glow;
      glow.material.opacity =
        Math.max(
          0.06,
          0.6 * (0.5 + 0.5 * Math.sin(time * 0.002 + card.userData.id))
        ) * card.userData.entranceProgress;
    }
  }

  handleClick(mousePos) {
    const pos = mousePos || this._lastPointerPos || { x: 0, y: 0 };
    // Only respond when cards are actually visible in the scene
    if (!this.cardGroup.visible) return;

    // Use the same screen-based detection as hover
    const clickedCard = this.getHoveredCardFromScreen(pos);

    if (clickedCard) {
      const link = clickedCard.userData.link;
      // Ignore placeholder or empty links
      if (!link || link === "#") return;
      globalThis.location.href = link;
    }
  }

  // Pointer handling helpers: attach/detach pointer handlers to a DOM element
  attachPointerHandlers(domElement) {
    const el = domElement || this.renderer?.domElement || globalThis;

    // Remove existing handlers if present
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

    this._boundPointerDown = (_e) => {
      this._pointerDown = true;
      this._pointerDownPos = { ...this._lastPointerPos };
    };

    this._boundPointerUp = (_e) => {
      if (!this._pointerDown) return;
      this._pointerDown = false;
      if (!this._pointerDownPos) return;
      const dx = this._lastPointerPos.x - this._pointerDownPos.x;
      const dy = this._lastPointerPos.y - this._pointerDownPos.y;
      const dist = Math.hypot(dx, dy);
      // Consider it a click/tap if finger didn't move much
      if (dist < 0.04) {
        this.handleClick(this._lastPointerPos);
      }
      this._pointerDownPos = null;
    };

    el.addEventListener("pointermove", this._boundPointerMove);
    el.addEventListener("pointerdown", this._boundPointerDown);
    el.addEventListener("pointerup", this._boundPointerUp);

    this._pointerElement = el;
  }

  detachPointerHandlers() {
    const el = this._pointerElement || this.renderer?.domElement || globalThis;
    if (!el) return;
    if (this._boundPointerMove)
      el.removeEventListener("pointermove", this._boundPointerMove);
    if (this._boundPointerDown)
      el.removeEventListener("pointerdown", this._boundPointerDown);
    if (this._boundPointerUp)
      el.removeEventListener("pointerup", this._boundPointerUp);

    this._pointerElement = null;
    this._boundPointerMove = null;
    this._boundPointerDown = null;
    this._boundPointerUp = null;
  }

  // Return simple profiling data for debugging or reporting
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
    // Immediately orient all cards to face the current camera position (projected upright).
    if (!this.camera) return;
    this.camera.getWorldPosition(this._tmpVec);
    this.cards.forEach((card) => {
      this._orientDummy.position.copy(card.position);
      this._orientDummy.lookAt(this._tmpVec.x, card.position.y, this._tmpVec.z);
      card.quaternion.copy(this._orientDummy.quaternion);
      // Reset tilt state
      card.userData.currentTiltX = 0;
      card.userData.currentTiltY = 0;
    });
  }

  cleanup() {
    this.scene.remove(this.cardGroup);

    // Dispose each card's resources (geometry, textures, materials, glow)
    // NOTE: some resources are shared across cards (geometry, glow texture). Avoid
    // disposing those per-card to prevent double-disposal and use-after-dispose errors.
    this.cards.forEach((card) => this._disposeCardResources(card));

    // Dispose shared geometry and textures
    if (this._sharedGeometry) {
      this._sharedGeometry.dispose();
      this._sharedGeometry = null;
    }

    if (this._sharedGlowTexture?.dispose) {
      this._sharedGlowTexture.dispose();
      this._sharedGlowTexture = null;
    }

    // Clear card references
    this.cards = [];

    // Dispose any remaining cached textures
    this._disposeCachedTextures();

    // Remove pointer handlers if attached
    try {
      this.detachPointerHandlers();
    } catch {
      // ignore
    }

    // Remove resize handler / cancel RAF
    this._removeResizeHandler();
  }

  // Helper: dispose resources for a single card
  _disposeCardResources(card) {
    try {
      // Only dispose geometry if it's not the shared geometry
      if (card.geometry?.dispose && card.geometry !== this._sharedGeometry) {
        card.geometry.dispose();
      }

      if (card.material) {
        this._releaseTextureFromCache(card.material.map);
        card.material.map = null;
        card.material.dispose?.();
      }

      const glow = card.userData?.glow;
      if (glow?.material) {
        this._disposeGlowMaterial(glow);
      }
    } catch (err) {
      log.warn("EarthCards: disposal error", err);
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
        log.warn("EarthCards: error disposing cached texture", err);
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

      if (!foundKey && map?.dispose) {
        map.dispose();
      }
    } catch (err) {
      log.warn("EarthCards: releaseTextureFromCache failed", err);
    }
  }

  _disposeGlowMaterial(glow) {
    try {
      if (
        glow.material.map?.dispose &&
        glow.material.map !== this._sharedGlowTexture
      ) {
        glow.material.map.dispose();
      }
      glow.material.dispose?.();
    } catch (err) {
      log.warn("EarthCards: glow dispose failed", err);
    }
  }

  _removeResizeHandler() {
    try {
      globalThis.removeEventListener("resize", this._onResize);
    } catch {}
    this._onResize = null;
    if (this._resizeRAF) {
      cancelAnimationFrame(this._resizeRAF);
      this._resizeRAF = null;
    }
  }

  // Create mesh and related resources for a card from its data payload
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
    mesh.scale.setScalar(0.95 * Math.max(0.85, viewportScale));

    mesh.userData = {
      isCard: true,
      link: data.link,
      originalY: data.position.y,
      hoverY: data.position.y + 0.5,
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
