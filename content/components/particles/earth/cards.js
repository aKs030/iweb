import { createLogger } from "#core/logger.js";

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
		this._lastCameraLayoutAt = 0;
		this._sharedGeometry = null;
		this._sharedGlowTexture = null;
		this._tmpVec = new THREE.Vector3();
		this._orientDummy = new THREE.Object3D();

		// Group to hold all cards
		this.cardGroup = new THREE.Group();
		this.scene.add(this.cardGroup);
		this.cardGroup.visible = false;
		this.orbitGuide = null;

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

		moveAxis("x", deltaXPx, this._pixelsToWorldX, "x");
		moveAxis("y", deltaYPx, this._pixelsToWorldY, "y");
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
		return layoutMode === "phone" || layoutMode.startsWith("tablet");
	}

	_getLayoutMode(vw, vh) {
		const isShortViewport = vh < 720;

		if (vw <= 560 || (vw <= 720 && isShortViewport)) return "phone";

		if (vw <= 960) {
			return vh > vw * 1.02 ? "tablet-portrait" : "tablet-landscape";
		}

		if (vw <= 1360 || vh < 820) return "desktop-compact";

		return "desktop-wide";
	}

	_getUiSafeZones({ layoutMode }) {
		if (typeof document === "undefined") return [];

		const stackedLayout = this._isStackedLayout(layoutMode);
		const phoneLayout = layoutMode === "phone";
		const zones = [];

		zones.push({
			kind: "top-band",
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

		const copy = document.querySelector(".features-copy");

		if (copy) {
			const rect = copy.getBoundingClientRect();

			if (rect.width > 0 && rect.height > 0) {
				zones.push({
					kind: "copy",
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

		const note = document.querySelector(".features-note");

		if (note) {
			const rect = note.getBoundingClientRect();

			if (rect.width > 0 && rect.height > 0) {
				zones.push({
					kind: "note",
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
					if (zone.kind === "top-band") {
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
		const phoneLayout = layoutMode === "phone";
		const copy = !stackedLayout
			? document.querySelector(".features-copy")
			: null;
		const copyRect = copy?.getBoundingClientRect?.();
		const note = !stackedLayout
			? document.querySelector(".features-note")
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
		const viewportTopBound = phoneLayout ? 104 : stackedLayout ? 96 : 92;
		const viewportBottomBound =
			window.innerHeight - (phoneLayout ? 82 : stackedLayout ? 88 : 118);
		const featureRect = document
			.querySelector("#features")
			?.getBoundingClientRect?.();
		const featureVisible =
			featureRect?.bottom > 0 && featureRect?.top < window.innerHeight;
		const sectionPadding = phoneLayout ? 22 : stackedLayout ? 28 : 36;
		const topBound =
			featureVisible && featureRect.top > viewportTopBound
				? Math.max(viewportTopBound, featureRect.top + sectionPadding)
				: viewportTopBound;
		const sectionBottomBound = featureVisible
			? featureRect.bottom - sectionPadding
			: viewportBottomBound;
		const minimumLayoutHeight = phoneLayout ? 360 : stackedLayout ? 420 : 460;
		const bottomBound = Math.max(
			topBound + minimumLayoutHeight,
			Math.min(viewportBottomBound, sectionBottomBound),
		);

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
		if (typeof document === "undefined") return 0;

		const viewportWidth = globalThis.window?.innerWidth || 0;
		if (!viewportWidth) return 0;

		const copyRect = document
			.querySelector(".features-copy")
			?.getBoundingClientRect?.();
		const noteRect = document
			.querySelector(".features-note")
			?.getBoundingClientRect?.();

		if (!copyRect?.width && !noteRect?.width) return 0;

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

	_clamp(value, min, max) {
		return Math.min(max, Math.max(min, value));
	}

	_createCirclePositions(radiusX, radiusY, nodeScale = 1, angles = null) {
		const waypointAngles = angles || [132, 42, -22, -98, -166];

		return waypointAngles.map((degrees) => {
			const angle = (degrees * Math.PI) / 180;

			return {
				x: Math.cos(angle) * radiusX,
				y: Math.sin(angle) * radiusY,
				z: 0.14,
				scale: nodeScale,
			};
		});
	}

	_getCircleLayoutSpec(vw, vh, layoutMode, safeAreaTop) {
		const fit = (refW, refH) => Math.min(vw / refW, vh / refH);
		const topOffset = (px) => -this._pixelsToWorldY(px + safeAreaTop);

		if (layoutMode === "phone") {
			const resolutionFit = this._clamp(fit(560, 1010) + 0.06, 0.64, 0.88);

			return {
				scale: resolutionFit,
				radiusX: 1.12 + resolutionFit * 0.24,
				radiusY: 1.02 + resolutionFit * 0.18,
				nodeScale: 1,
				spreadX: Math.min(1.16, Math.max(1, vw / 410)),
				spreadY: Math.min(1.18, Math.max(1, vh / 790)),
				offsetY: topOffset(56),
				hoverLift: 0.16,
			};
		}

		if (layoutMode === "tablet-portrait") {
			const resolutionFit = this._clamp(fit(760, 940) + 0.04, 0.82, 1.08);
			const roomFit = this._clamp(fit(760, 940), 0.88, 1.14);

			return {
				scale: resolutionFit,
				radiusX: 1.8 + roomFit * 0.42,
				radiusY: 1.46 + roomFit * 0.3,
				nodeScale: 1,
				spreadX: Math.min(1.2, Math.max(1.04, vw / 740)),
				spreadY: Math.min(1.16, Math.max(1, vh / 920)),
				offsetY: topOffset(70),
				hoverLift: 0.18,
			};
		}

		if (layoutMode === "tablet-landscape") {
			const resolutionFit = this._clamp(fit(940, 700) + 0.04, 0.9, 1.14);
			const roomFit = this._clamp(fit(940, 700), 0.92, 1.22);

			return {
				scale: resolutionFit,
				radiusX: 2.52 + roomFit * 0.62,
				radiusY: 1.76 + roomFit * 0.38,
				nodeScale: 1,
				spreadX: Math.min(1.18, Math.max(1.04, vw / 980)),
				spreadY: Math.min(1.16, Math.max(1, vh / 740)),
				offsetY: topOffset(66),
				hoverLift: 0.18,
			};
		}

		if (layoutMode === "desktop-compact") {
			const resolutionFit = this._clamp(fit(1120, 680) + 0.03, 0.98, 1.2);
			const roomFit = this._clamp(fit(1120, 680), 0.96, 1.28);

			return {
				scale: resolutionFit,
				radiusX: 3.18 + roomFit * 0.64,
				radiusY: 2.02 + roomFit * 0.42,
				nodeScale: 1,
				angles: [132, 42, -22, -98, -166],
				spreadX: 1,
				spreadY: 1,
				offsetY: 0,
				hoverLift: 0.2,
			};
		}

		const rawFit = fit(1320, 760);

		if (vw >= 1680) {
			const resolutionFit = this._clamp(rawFit, 1.04, 1.14);
			const roomFit = this._clamp(rawFit, 1.08, 1.36);

			return {
				scale: resolutionFit,
				radiusX: 3.32 + roomFit * 0.58,
				radiusY: 2.1 + roomFit * 0.38,
				nodeScale: 1,
				angles: [130, 46, -18, -96, -164],
				spreadX: 1,
				spreadY: 1,
				offsetY: 0,
				hoverLift: 0.22,
			};
		}

		const resolutionFit = this._clamp(rawFit + 0.02, 1.02, 1.22);
		const roomFit = this._clamp(rawFit, 1.02, 1.32);

		return {
			scale: resolutionFit,
			radiusX: 3.42 + roomFit * 0.88,
			radiusY: 2.12 + roomFit * 0.56,
			nodeScale: 1,
			angles: [132, 42, -22, -98, -166],
			spreadX: 1,
			spreadY: 1,
			offsetY: 0,
			hoverLift: 0.22,
		};
	}

	_applyResponsiveLayout(vw, vh, layoutMode) {
		const safeAreaTop =
			parseFloat(
				getComputedStyle(document.documentElement).getPropertyValue(
					"--safe-top",
				),
			) || 0;

		const circle = this._getCircleLayoutSpec(vw, vh, layoutMode, safeAreaTop);
		const offsetX = this._isStackedLayout(layoutMode)
			? 0
			: this._getDesktopStageOffsetX();

		this._applyLayoutPositions({
			scale: circle.scale,
			spreadX: circle.spreadX,
			spreadY: circle.spreadY,
			offsetX,
			offsetY: circle.offsetY,
			hoverLift: circle.hoverLift,
			positions: this._createCirclePositions(
				circle.radiusX,
				circle.radiusY,
				circle.nodeScale,
				circle.angles,
			),
		});
	}

	_runResponsiveLayout(vw, vh, layoutMode) {
		this._applyResponsiveLayout(vw, vh, layoutMode);

		this.alignCardsToCameraImmediate();
		this._resolveUiSafeZones({ layoutMode });
		this._resolveCardOverlaps({ layoutMode });
		this._resolveViewportBounds({ layoutMode });
		this._compactCardCluster({ layoutMode });
		this._resolveCardOverlaps({ layoutMode });
		this._resolveUiSafeZones({ layoutMode });
		this._resolveViewportBounds({ layoutMode });
		this._syncPortalAnchors(layoutMode);
		this._updateOrbitGuide();
	}

	refreshLayoutForCamera(force = false) {
		if (
			typeof window === "undefined" ||
			!this.renderer ||
			!this.camera ||
			this.cards.length === 0
		) {
			return;
		}

		this.alignCardsToCameraImmediate();

		const now = performance.now?.() ?? Date.now();

		if (!force && now - this._lastCameraLayoutAt < 120) return;

		this._lastCameraLayoutAt = now;

		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const layoutMode = this._getLayoutMode(vw, vh);

		this._runResponsiveLayout(vw, vh, layoutMode);
	}

	_ensureOrbitGuide() {
		return;
	}

	_updateOrbitGuide() {
		if (!this.orbitGuide) return;

		this.cardGroup?.remove?.(this.orbitGuide);
		this.orbitGuide.geometry?.dispose?.();
		this.orbitGuide.material?.dispose?.();
		this.orbitGuide = null;
	}

	_setOrbitGuideOpacity(_opacity) {
		const material = this.orbitGuide?.material;

		if (!material) return;

		material.opacity = 0;
	}

	_easeOutCubic(value) {
		const p = this._clamp(value, 0, 1);

		return 1 - Math.pow(1 - p, 3);
	}

	_syncPortalAnchors(layoutMode) {
		if (!this.cards.length) return;

		const stackedLayout = this._isStackedLayout(layoutMode);
		const phoneLayout = layoutMode === "phone";
		const outwardPull = phoneLayout ? 0.72 : stackedLayout ? 0.95 : 1.55;
		const verticalPull = phoneLayout ? 0.5 : stackedLayout ? 0.62 : 0.88;
		const depthPull = phoneLayout ? 0.42 : stackedLayout ? 0.64 : 1.08;
		const tangentPull = phoneLayout ? 0.08 : stackedLayout ? 0.12 : 0.2;

		this.cards.forEach((card, index) => {
			const hoverLift = card.userData.layoutAnchor?.hoverLift ?? 0.2;
			const anchor = {
				x: card.position.x,
				y: card.position.y,
				z: card.position.z,
				scale: card.scale.x,
				hoverLift,
			};
			const length = Math.hypot(anchor.x, anchor.y) || 1;
			const dirX = anchor.x / length;
			const dirY = anchor.y / length;
			const tangentX = -dirY;
			const tangentY = dirX;
			const tangentSign = index % 2 === 0 ? -1 : 1;

			card.userData.layoutAnchor = anchor;
			card.userData.entranceOrigin = {
				x: anchor.x + dirX * outwardPull + tangentX * tangentPull * tangentSign,
				y:
					anchor.y + dirY * verticalPull + tangentY * tangentPull * tangentSign,
				z: anchor.z - depthPull,
				scale:
					anchor.scale * (phoneLayout ? 0.78 : stackedLayout ? 0.74 : 0.68),
			};
			this._setCardHoverMeta(card, hoverLift);
			this._applyPortalEntranceTransform(
				card,
				card.userData.entranceProgress ?? (this.isVisible ? 1 : 0),
			);
		});
	}

	_applyPortalEntranceTransform(card, progress) {
		const anchor = card.userData.layoutAnchor;

		if (!anchor) return;

		const origin = card.userData.entranceOrigin || anchor;
		const eased = this._easeOutCubic(progress);
		const settleLift =
			Math.sin(Math.PI * eased) * (anchor.hoverLift ?? 0.2) * 0.2;
		const lerp = (a, b) => a + (b - a) * eased;

		card.position.set(
			lerp(origin.x, anchor.x),
			lerp(origin.y, anchor.y) + settleLift,
			lerp(origin.z, anchor.z),
		);
		card.scale.setScalar(lerp(origin.scale ?? anchor.scale, anchor.scale));
	}

	_compactCardCluster({ layoutMode }) {
		if (!this.renderer || !this.camera || this.cards.length === 0) return;

		const stackedLayout = this._isStackedLayout(layoutMode);
		const phoneLayout = layoutMode === "phone";
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
		const phoneLayout = layoutMode === "phone";
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
		const baseW = 2.48;
		const baseH = 2.84;

		this._baseW = baseW;
		this._baseH = baseH;
		const centerOffset = (cardCount - 1) / 2;

		// Default Layout - positions will be refined in _onResize
		const positions = dataArray.map((d, i) => ({
			x: (i - centerOffset) * (baseW * 1.2),
			y: 0,
			z: 0,
			color: d.color || ["#07a1ff", "#a107ff", "#ff07a1"][i] || "#ffffff",
		}));

		// Shared geometry reused across cards
		this._sharedGeometry = new this.THREE.PlaneGeometry(baseW, baseH);

		// Prepare shared glow texture once
		if (!this._sharedGlowTexture)
			this._sharedGlowTexture = this.createGlowTexture();

		dataArray.forEach((d, index) => {
			const data = {
				id: index,
				title: d.title || "",
				subtitle: d.subtitle || "",
				text: d.text || "",
				link: d.link || "#",
				cta: d.cta || "",
				meta: d.meta || "",
				routeLabel: d.routeLabel || "",
				iconChar: d.iconChar || "",
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
				this.refreshLayoutForCamera(true);

				this._resizeRAF = null;
			});
		};

		if (globalThis.window !== undefined) {
			window.addEventListener("resize", this._onResize, { passive: true });
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
		const halfW = (this._baseW || 2.2) * 0.5;
		const halfH = (this._baseH || 2.8) * 0.5;
		const corners = [
			[-halfW, -halfH],
			[halfW, -halfH],
			[halfW, halfH],
			[-halfW, halfH],
		];

		return this.cards.map((card) => {
			card.updateMatrixWorld();

			const rect = {
				left: Infinity,
				top: Infinity,
				right: -Infinity,
				bottom: -Infinity,
			};

			corners.forEach(([x, y]) => {
				tmpVec.set(x, y, 0).applyMatrix4(card.matrixWorld);
				tmpVec.project(this.camera);

				const screenX = (tmpVec.x * 0.5 + 0.5) * width + canvasRect.left;
				const screenY = (-tmpVec.y * 0.5 + 0.5) * height + canvasRect.top;

				rect.left = Math.min(rect.left, screenX);
				rect.top = Math.min(rect.top, screenY);
				rect.right = Math.max(rect.right, screenX);
				rect.bottom = Math.max(rect.bottom, screenY);
			});

			return rect;
		});
	}

	createCardTexture(data) {
		const S = this._getCardTextureScale();

		const W = 760 * S;
		const H = 870 * S;

		const keyObj = {
			title: (data.title || "").slice(0, 256),
			subtitle: (data.subtitle || "").slice(0, 128),
			text: (data.text || "").slice(0, 512),
			cta: (data.cta || "").slice(0, 128),
			meta: (data.meta || "").slice(0, 128),
			routeLabel: (data.routeLabel || "").slice(0, 64),
			iconChar: data.iconChar || "",
			link: (data.link || "").slice(0, 128),
			color: data.color || "#ffffff",
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
			if (typeof OffscreenCanvas !== "undefined") {
				canvas = new OffscreenCanvas(W, H);
			} else {
				canvas = document.createElement("canvas");
				canvas.width = W;
				canvas.height = H;
			}
			// Transparency required for rounded corners
			ctx =
				/** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} */ (
					canvas.getContext("2d")
				);
		} catch (e) {
			log.warn("CardManager: canvas creation failed", e);
		}

		if (!ctx) {
			log.warn("CardManager: 2D canvas context unavailable");
			if (!canvas) {
				canvas =
					typeof OffscreenCanvas !== "undefined"
						? new OffscreenCanvas(1, 1)
						: document.createElement("canvas");
				if (typeof OffscreenCanvas === "undefined") {
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
		const accent = this.hexToRgb(data.color);
		const accentStrong = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.98)`;
		const accentMedium = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.55)`;
		const accentSoft = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.22)`;
		const accentGlow = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.46)`;
		const textStrong = "rgba(248, 250, 255, 0.98)";
		const routeText = (data.routeLabel || "").trim();
		const titleText = (data.title || "").trim();
		const routeDisplay = routeText || titleText || "Bereich";
		const centerX = W * 0.5;
		const centerY = H * 0.42;
		const coreR = 214 * S;
		const titleY = centerY + coreR + 88 * S;

		ctx.clearRect(0, 0, W, H);

		const outerGlow = ctx.createRadialGradient(
			centerX,
			centerY,
			coreR * 0.12,
			centerX,
			centerY,
			coreR * 2.18,
		);
		outerGlow.addColorStop(0, accentMedium);
		outerGlow.addColorStop(0.4, accentSoft);
		outerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
		ctx.fillStyle = outerGlow;
		ctx.fillRect(0, 0, W, H);

		ctx.save();
		ctx.translate(centerX, centerY);
		ctx.rotate(-0.18);
		ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
		ctx.lineWidth = 2.4 * S;
		ctx.beginPath();
		ctx.ellipse(0, 0, coreR * 1.34, coreR * 0.48, 0, 0, Math.PI * 2);
		ctx.stroke();

		ctx.strokeStyle = accentMedium;
		ctx.lineWidth = 4.5 * S;
		ctx.beginPath();
		ctx.ellipse(0, 0, coreR * 1.48, coreR * 0.55, 0, -0.24, Math.PI * 1.22);
		ctx.stroke();
		ctx.restore();

		ctx.save();
		ctx.translate(centerX, centerY);
		ctx.rotate(0.76);
		ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
		ctx.lineWidth = 2 * S;
		ctx.beginPath();
		ctx.ellipse(0, 0, coreR * 0.72, coreR * 1.32, 0, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();

		ctx.save();
		ctx.translate(centerX, centerY);
		ctx.rotate(0.18);
		ctx.strokeStyle = accentSoft;
		ctx.lineWidth = 2.8 * S;
		ctx.beginPath();
		ctx.ellipse(
			0,
			0,
			coreR * 1.06,
			coreR * 1.06,
			0,
			Math.PI * 0.08,
			Math.PI * 1.36,
		);
		ctx.stroke();
		ctx.restore();

		const satelliteAngles = [-0.74, 0.52, 2.28];
		satelliteAngles.forEach((angle, index) => {
			const sx = centerX + Math.cos(angle) * coreR * 1.4;
			const sy = centerY + Math.sin(angle) * coreR * 0.66;
			ctx.beginPath();
			ctx.arc(sx, sy, (index === 1 ? 12 : 7) * S, 0, Math.PI * 2);
			ctx.fillStyle = index === 1 ? accentStrong : "rgba(255, 255, 255, 0.7)";
			ctx.fill();
			ctx.strokeStyle = "rgba(3, 8, 18, 0.86)";
			ctx.lineWidth = 3 * S;
			ctx.stroke();
		});

		ctx.save();
		ctx.shadowColor = accentGlow;
		ctx.shadowBlur = 46 * S;
		ctx.beginPath();
		ctx.arc(centerX, centerY, coreR, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(1, 4, 12, 0.9)";
		ctx.fill();
		ctx.restore();

		ctx.save();
		ctx.beginPath();
		ctx.arc(centerX, centerY, coreR, 0, Math.PI * 2);
		ctx.clip();

		const coreGradient = ctx.createRadialGradient(
			centerX - coreR * 0.34,
			centerY - coreR * 0.38,
			0,
			centerX,
			centerY,
			coreR,
		);
		coreGradient.addColorStop(0, "rgba(255, 255, 255, 0.36)");
		coreGradient.addColorStop(0.2, accentMedium);
		coreGradient.addColorStop(0.58, "rgba(8, 14, 30, 0.96)");
		coreGradient.addColorStop(1, "rgba(1, 3, 9, 0.99)");
		ctx.fillStyle = coreGradient;
		ctx.fillRect(centerX - coreR, centerY - coreR, coreR * 2, coreR * 2);

		ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
		ctx.lineWidth = 2 * S;
		for (let i = 0; i < 7; i++) {
			const offset = (i - 3) * 52 * S;
			ctx.beginPath();
			ctx.moveTo(centerX - coreR + offset, centerY - coreR);
			ctx.lineTo(centerX + offset + 108 * S, centerY + coreR);
			ctx.stroke();
		}

		this.drawPortalGlyph(ctx, routeDisplay, centerX, centerY, coreR, S, accent);
		ctx.restore();

		ctx.strokeStyle = accentStrong;
		ctx.lineWidth = 6 * S;
		ctx.beginPath();
		ctx.arc(centerX, centerY, coreR + 10 * S, -0.18, Math.PI * 1.46);
		ctx.stroke();

		ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
		ctx.lineWidth = 2.2 * S;
		ctx.beginPath();
		ctx.arc(centerX, centerY, coreR + 32 * S, Math.PI * 0.1, Math.PI * 1.72);
		ctx.stroke();

		ctx.textAlign = "center";
		ctx.textBaseline = "alphabetic";

		const titleSize = this.fitTextToWidth(
			ctx,
			titleText,
			560 * S,
			"800",
			70 * S,
			44 * S,
			titleFontFamily,
		);
		ctx.font = `800 ${titleSize}px ${titleFontFamily}`;
		ctx.fillStyle = textStrong;
		ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
		ctx.shadowBlur = 18 * S;
		ctx.fillText(titleText, centerX, titleY);
		ctx.shadowBlur = 0;

		const arrowCenterX =
			centerX +
			Math.min(260 * S, ctx.measureText(titleText).width * 0.5 + 46 * S);
		const arrowCenterY = titleY - 22 * S;
		ctx.beginPath();
		ctx.arc(arrowCenterX, arrowCenterY, 18 * S, 0, Math.PI * 2);
		ctx.fillStyle = accentStrong;
		ctx.fill();
		ctx.strokeStyle = "rgba(3, 8, 18, 0.94)";
		ctx.lineWidth = 3.4 * S;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.beginPath();
		ctx.moveTo(arrowCenterX - 6 * S, arrowCenterY + 6 * S);
		ctx.lineTo(arrowCenterX + 6 * S, arrowCenterY - 6 * S);
		ctx.moveTo(arrowCenterX - 1 * S, arrowCenterY - 7 * S);
		ctx.lineTo(arrowCenterX + 7 * S, arrowCenterY - 7 * S);
		ctx.lineTo(arrowCenterX + 7 * S, arrowCenterY + 1 * S);
		ctx.stroke();
		ctx.lineCap = "butt";
		ctx.lineJoin = "miter";

		const texture = new this.THREE.CanvasTexture(canvas);
		texture.generateMipmaps = true;
		texture.minFilter = this.THREE.LinearMipmapLinearFilter;
		texture.magFilter = this.THREE.LinearFilter;
		texture.anisotropy = this._getCardTextureAnisotropy();
		if ("colorSpace" in texture && this.THREE.SRGBColorSpace) {
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
			typeof OffscreenCanvas === "undefined"
				? document.createElement("canvas")
				: new OffscreenCanvas(size, size);
		if (typeof OffscreenCanvas === "undefined") {
			canvas.width = size;
			canvas.height = size;
		}
		const ctx =
			/** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} */ (
				canvas.getContext("2d")
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
		ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
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
		ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
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

		ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
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

	drawPortalGlyph(ctx, label, cx, cy, radius, scale, accent) {
		const S = scale;
		const key = String(label || "").toLowerCase();
		const accentStrong = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.92)`;
		const accentMedium = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.5)`;
		const accentSoft = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.2)`;
		const whiteSoft = "rgba(255, 255, 255, 0.74)";
		const whiteFaint = "rgba(255, 255, 255, 0.22)";
		const r = radius;

		ctx.save();
		ctx.translate(cx, cy);
		ctx.shadowColor = accentMedium;
		ctx.shadowBlur = 16 * S;

		ctx.beginPath();
		ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
		ctx.fillStyle = accentSoft;
		ctx.fill();
		ctx.strokeStyle = whiteFaint;
		ctx.lineWidth = 2 * S;
		ctx.stroke();

		ctx.strokeStyle = accentStrong;
		ctx.lineWidth = 8 * S;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		if (key.includes("profil")) {
			ctx.beginPath();
			ctx.arc(0, -r * 0.16, r * 0.13, 0, Math.PI * 2);
			ctx.stroke();

			ctx.beginPath();
			ctx.moveTo(-r * 0.32, r * 0.28);
			ctx.quadraticCurveTo(0, r * 0.03, r * 0.32, r * 0.28);
			ctx.stroke();

			ctx.strokeStyle = whiteSoft;
			ctx.lineWidth = 6 * S;
			ctx.beginPath();
			ctx.moveTo(-r * 0.5, -r * 0.1);
			ctx.lineTo(-r * 0.66, 0);
			ctx.lineTo(-r * 0.5, r * 0.1);
			ctx.moveTo(r * 0.5, -r * 0.1);
			ctx.lineTo(r * 0.66, 0);
			ctx.lineTo(r * 0.5, r * 0.1);
			ctx.stroke();
		} else if (key.includes("projekt")) {
			const cards = [
				[-r * 0.36, -r * 0.22, r * 0.34, r * 0.24],
				[-r * 0.06, -r * 0.02, r * 0.34, r * 0.24],
				[-r * 0.28, r * 0.2, r * 0.34, r * 0.24],
			];

			cards.forEach(([x, y, w, h], index) => {
				this.roundRect(ctx, x, y, w, h, 10 * S);
				ctx.fillStyle = index === 1 ? accentStrong : accentSoft;
				ctx.fill();
				ctx.strokeStyle = index === 1 ? "rgba(3, 8, 18, 0.82)" : accentMedium;
				ctx.lineWidth = 3 * S;
				ctx.stroke();
			});

			ctx.strokeStyle = whiteSoft;
			ctx.lineWidth = 5 * S;
			ctx.beginPath();
			ctx.moveTo(-r * 0.18, -r * 0.02);
			ctx.lineTo(r * 0.16, r * 0.18);
			ctx.moveTo(r * 0.08, r * 0.12);
			ctx.lineTo(-r * 0.1, r * 0.3);
			ctx.stroke();
		} else if (key.includes("foto")) {
			for (let i = 0; i < 6; i++) {
				ctx.save();
				ctx.rotate((Math.PI / 3) * i);
				ctx.beginPath();
				ctx.moveTo(0, -r * 0.11);
				ctx.lineTo(r * 0.38, -r * 0.42);
				ctx.lineTo(r * 0.48, -r * 0.08);
				ctx.lineTo(r * 0.12, r * 0.08);
				ctx.closePath();
				ctx.fillStyle =
					i % 2 === 0 ? accentMedium : "rgba(255, 255, 255, 0.16)";
				ctx.fill();
				ctx.restore();
			}

			ctx.beginPath();
			ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
			ctx.strokeStyle = whiteSoft;
			ctx.lineWidth = 7 * S;
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(0, 0, r * 0.09, 0, Math.PI * 2);
			ctx.fillStyle = accentStrong;
			ctx.fill();
		} else if (key.includes("video")) {
			ctx.beginPath();
			ctx.moveTo(-r * 0.16, -r * 0.28);
			ctx.lineTo(r * 0.34, 0);
			ctx.lineTo(-r * 0.16, r * 0.28);
			ctx.closePath();
			ctx.fillStyle = accentStrong;
			ctx.fill();

			ctx.strokeStyle = whiteSoft;
			ctx.lineWidth = 5 * S;
			[-0.42, -0.24, 0.42].forEach((x) => {
				ctx.beginPath();
				ctx.moveTo(r * x, r * 0.46);
				ctx.lineTo(r * (x + 0.1), r * 0.46);
				ctx.stroke();
			});
			ctx.beginPath();
			ctx.moveTo(-r * 0.46, r * 0.46);
			ctx.lineTo(r * 0.5, r * 0.46);
			ctx.strokeStyle = whiteFaint;
			ctx.stroke();
		} else if (key.includes("journal")) {
			this.roundRect(ctx, -r * 0.36, -r * 0.42, r * 0.6, r * 0.72, 14 * S);
			ctx.fillStyle = "rgba(255, 255, 255, 0.09)";
			ctx.fill();
			ctx.strokeStyle = accentStrong;
			ctx.lineWidth = 5 * S;
			ctx.stroke();

			ctx.strokeStyle = whiteSoft;
			ctx.lineWidth = 4 * S;
			for (let i = 0; i < 4; i++) {
				const y = -r * 0.25 + i * r * 0.15;
				ctx.beginPath();
				ctx.moveTo(-r * 0.23, y);
				ctx.lineTo(r * 0.1, y);
				ctx.stroke();
			}

			ctx.strokeStyle = accentStrong;
			ctx.lineWidth = 8 * S;
			ctx.beginPath();
			ctx.moveTo(r * 0.12, r * 0.34);
			ctx.lineTo(r * 0.46, -r * 0.02);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(r * 0.41, -r * 0.08);
			ctx.lineTo(r * 0.5, -r * 0.16);
			ctx.stroke();
		} else {
			ctx.beginPath();
			for (let i = 0; i < 5; i++) {
				const angle = -Math.PI / 2 + i * ((Math.PI * 2) / 5);
				const x = Math.cos(angle) * r * 0.42;
				const y = Math.sin(angle) * r * 0.42;
				if (i === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.closePath();
			ctx.stroke();
		}

		ctx.restore();
	}

	hexToRgb(hex) {
		const raw = String(hex || "")
			.trim()
			.replace("#", "");
		const normalized =
			raw.length === 3
				? raw
						.split("")
						.map((chunk) => chunk + chunk)
						.join("")
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
		const words = (text || "").split(" ");
		let line = "";
		let lineCount = 0;

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
				log.warn("measureText failed, returning minSize", e);
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
				typeof progress === "number" && !Number.isNaN(progress) ? progress : 0,
			),
		);
		const wasVisible = this.cardGroup.visible;
		const hasActiveEntrance = this.cards.some(
			(card) => (card.userData.entranceProgress || 0) > 0.01,
		);

		this.isVisible = p > 0.01;
		this.cardGroup.visible = p > 0.01 || wasVisible || hasActiveEntrance;

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
			card.userData.targetOpacity = 1;
		});

		this._setOrbitGuideOpacity(p * 0.12);
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

		const averageEntrance =
			this.cards.reduce(
				(sum, card) => sum + (card.userData.entranceProgress || 0),
				0,
			) / Math.max(1, this.cards.length);
		this._setOrbitGuideOpacity(averageEntrance * 0.14);

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
			typeof card.userData.entranceTarget === "number"
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
			this._applyPortalEntranceTransform(card, 0);
			card.material.opacity = 0;
			return;
		}

		const easedOpacity =
			card.userData.entranceProgress *
			card.userData.entranceProgress *
			(3 - 2 * card.userData.entranceProgress);

		this._applyPortalEntranceTransform(card, card.userData.entranceProgress);
		card.material.opacity = easedOpacity;
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
			if (!link || link === "#") return;
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

		el.addEventListener("pointermove", this._boundPointerMove, {
			passive: true,
		});
		el.addEventListener("pointerdown", this._boundPointerDown, {
			passive: true,
		});
		el.addEventListener("pointerup", this._boundPointerUp, {
			passive: true,
		});
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
		this._disposeOrbitGuide();
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

	_disposeOrbitGuide() {
		if (!this.orbitGuide) return;

		try {
			this.cardGroup?.remove?.(this.orbitGuide);
			this.orbitGuide.geometry?.dispose?.();
			this.orbitGuide.material?.dispose?.();
		} catch (err) {
			log.warn("EarthCards: orbit guide dispose failed", err);
		}

		this.orbitGuide = null;
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
			if (!foundKey && map?.dispose) map.dispose();
		} catch (err) {
			log.warn("EarthCards: releaseTextureFromCache failed", err);
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
			log.warn("EarthCards: glow dispose failed", err);
		}
	}

	_removeResizeHandler() {
		try {
			globalThis.removeEventListener("resize", this._onResize);
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
		glow.scale.set(baseW * 1.44, baseH * 1.08, 1);
		glow.position.set(0, 0.02, -0.01);
		glow.renderOrder = 11;
		mesh.add(glow);
		mesh.userData.glow = glow;

		return mesh;
	}
}
