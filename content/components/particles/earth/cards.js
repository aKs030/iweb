
import { CONFIG } from './config.js';

export class CardManager {
    constructor(THREE, scene, camera, renderer) {
        this.THREE = THREE;
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.cards = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Configuration
        this.config = CONFIG.STARS.ANIMATION.CARDS;

        // Bind methods
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onClick = this.onClick.bind(this);

        // Listeners
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('click', this.onClick);

        // Initial state
        this.visible = false;
        this.opacity = 0;
    }

    init() {
        this.createCardsFromDOM();
    }

    createCardsFromDOM() {
        const cardElements = document.querySelectorAll('.card');

        if (cardElements.length === 0) return;

        cardElements.forEach((el, index) => {
            const card = this.createSingleCard(el, index);
            if (card) {
                this.cards.push(card);
                this.scene.add(card.mesh);
            }
        });

        // Initial positioning
        this.updatePositions();
    }

    createSingleCard(element, index) {
        // Extract content
        const title = element.querySelector('h3')?.innerText || 'Title';
        const description = element.querySelector('p')?.innerText || 'Description';

        // Icon
        const iconElement = element.querySelector('i');
        const iconChar = iconElement ? iconElement.innerText : '★';

        // Create texture
        const texture = this.createCardTexture(title, description, iconChar);

        // Create geometry
        const geometry = new this.THREE.PlaneGeometry(1, 1);

        // Create material
        const material = this.createCardMaterial(texture);

        // Create mesh
        const mesh = new this.THREE.Mesh(geometry, material);
        mesh.visible = false;

        // Store reference
        return {
            mesh,
            element,
            hover: 0,
            baseScale: new this.THREE.Vector3(1, 1, 1),
            basePosition: new this.THREE.Vector3()
        };
    }

    createCardTexture(title, description, iconChar) {
        const width = 512;
        const height = 700;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Clear
        ctx.clearRect(0, 0, width, height);

        // --- Glassmorphism Background ---
        const cornerRadius = 40;

        // Gradient fill
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');

        ctx.fillStyle = grad;
        this.roundRect(ctx, 5, 5, width - 10, height - 10, cornerRadius);
        ctx.fill();

        // Border Glow
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // --- Icon Wrapper ---
        const iconY = 150;
        const iconSize = 140;
        ctx.save();
        ctx.translate(width / 2, iconY);

        // Icon Background Gradient
        const iconGrad = ctx.createLinearGradient(-iconSize/2, -iconSize/2, iconSize/2, iconSize/2);
        iconGrad.addColorStop(0, 'rgba(7, 161, 255, 0.2)');
        iconGrad.addColorStop(1, 'rgba(7, 161, 255, 0.05)');

        ctx.fillStyle = iconGrad;
        this.roundRect(ctx, -iconSize/2, -iconSize/2, iconSize, iconSize, 30);
        ctx.fill();

        // Icon Border
        ctx.strokeStyle = 'rgba(7, 161, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Icon Text
        ctx.fillStyle = '#ffffff';
        ctx.font = '80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(iconChar, 0, 5);
        ctx.restore();

        // --- Title ---
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText(title, width / 2, 320);
        ctx.shadowBlur = 0;

        // --- Description ---
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        this.wrapText(ctx, description, width / 2, 420, 440, 44);

        const texture = new this.THREE.CanvasTexture(canvas);
        texture.colorSpace = this.THREE.SRGBColorSpace;
        texture.minFilter = this.THREE.LinearFilter;
        texture.magFilter = this.THREE.LinearFilter;
        return texture;
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

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let lines = [];

        for(let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            }
            else {
                line = testLine;
            }
        }
        lines.push(line);
        lines.forEach((l, i) => {
            ctx.fillText(l, x, y + (i * lineHeight));
        });
    }

    createCardMaterial(texture) {
        return new this.THREE.ShaderMaterial({
            uniforms: {
                uTexture: { value: texture },
                uOpacity: { value: 0.0 },
                uTime: { value: 0.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D uTexture;
                uniform float uOpacity;
                uniform float uTime;
                varying vec2 vUv;

                void main() {
                    vec4 texColor = texture2D(uTexture, vUv);

                    // Subtle shimmering scanline
                    float pos = mod(uTime * 0.3, 3.0) - 1.0;
                    float dist = abs((vUv.x + vUv.y) * 0.5 - pos);
                    float shimmer = 0.0;
                    if (dist < 0.2) {
                        shimmer = (0.2 - dist) * 0.3; // Soft glow
                    }

                    gl_FragColor = vec4(texColor.rgb + shimmer, texColor.a * uOpacity);
                }
            `,
            transparent: true,
            side: this.THREE.DoubleSide,
            depthTest: true,
            depthWrite: false
        });
    }

    onMouseMove(event) {
        if (!this.cards.length) return;
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    onClick(event) {
        if (!this.visible || !this.cards.length) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.cards.map(c => c.mesh));

        if (intersects.length > 0) {
            const card = this.cards.find(c => c.mesh === intersects[0].object);
            if (card) {
                const link = card.element.querySelector('a');
                if (link && link.href) {
                    // Navigate
                    window.location.href = link.href;
                }
            }
        }
    }

    updatePositions() {
        if (!this.cards.length) return;

        const width = this.renderer.domElement.clientWidth;
        const height = this.renderer.domElement.clientHeight;
        const targetZ = -2;

        this.cards.forEach(card => {
            const rect = card.element.getBoundingClientRect();

            if (rect.width === 0 || rect.height === 0) return;

            const bottomLeft = this.screenToWorld(rect.left, rect.bottom, width, height, targetZ);
            const topRight = this.screenToWorld(rect.right, rect.top, width, height, targetZ);

            const centerX = (bottomLeft.x + topRight.x) / 2;
            const centerY = (bottomLeft.y + topRight.y) / 2;
            const centerZ = targetZ;

            const worldWidth = Math.abs(topRight.x - bottomLeft.x);
            const worldHeight = Math.abs(topRight.y - bottomLeft.y);

            card.mesh.position.set(centerX, centerY, centerZ);
            card.mesh.scale.set(worldWidth, worldHeight, 1);

            card.basePosition.set(centerX, centerY, centerZ);
            card.baseScale.set(worldWidth, worldHeight, 1);
        });
    }

    screenToWorld(x, y, viewportWidth, viewportHeight, targetZ) {
        const ndcX = (x / viewportWidth) * 2 - 1;
        const ndcY = -((y / viewportHeight) * 2 - 1);

        const vector = new this.THREE.Vector3(ndcX, ndcY, 0.5);
        vector.unproject(this.camera);

        const dir = vector.sub(this.camera.position).normalize();
        const distance = (targetZ - this.camera.position.z) / dir.z;

        return this.camera.position.clone().add(dir.multiplyScalar(distance));
    }

    update(elapsedTime) {
        if (!this.visible || !this.cards.length) return;

        // Update Time for shader
        this.cards.forEach(card => {
             if (card.mesh.material.uniforms.uTime) {
                 card.mesh.material.uniforms.uTime.value = elapsedTime;
             }
        });

        // Hover Effect
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.cards.map(c => c.mesh));

        this.cards.forEach(card => {
            const hit = intersects.find(i => i.object === card.mesh);

            let targetScale = 1.0;
            let targetRotX = 0;
            let targetRotY = 0;

            if (hit) {
                targetScale = 1.05;
                const dx = hit.point.x - card.mesh.position.x;
                const dy = hit.point.y - card.mesh.position.y;
                targetRotY = dx * 0.5;
                targetRotX = -dy * 0.5;
            }

            card.mesh.scale.lerp(
                new this.THREE.Vector3(
                    card.baseScale.x * targetScale,
                    card.baseScale.y * targetScale,
                    1
                ),
                0.1
            );

            card.mesh.rotation.x += (targetRotX - card.mesh.rotation.x) * 0.1;
            card.mesh.rotation.y += (targetRotY - card.mesh.rotation.y) * 0.1;

            if (card.mesh.material.uniforms.uOpacity) {
                card.mesh.material.uniforms.uOpacity.value = this.opacity;
            }
        });
    }

    showCards() {
        this.visible = true;
        this.cards.forEach(c => c.mesh.visible = true);
        this.animateOpacity(1.0);
    }

    hideCards() {
        this.animateOpacity(0.0, () => {
            this.visible = false;
            this.cards.forEach(c => c.mesh.visible = false);
        });
    }

    animateOpacity(target, onComplete) {
        const start = this.opacity;
        const duration = 1000;
        const startTime = performance.now();

        const animate = () => {
            const now = performance.now();
            const progress = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);

            this.opacity = start + (target - start) * ease;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (onComplete) onComplete();
            }
        };
        requestAnimationFrame(animate);
    }

    cleanup() {
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('click', this.onClick);
        this.cards.forEach(card => {
            this.scene.remove(card.mesh);
            card.mesh.geometry.dispose();
            card.mesh.material.dispose();
            if (card.mesh.material.uniforms.uTexture.value) {
                card.mesh.material.uniforms.uTexture.value.dispose();
            }
        });
        this.cards = [];
    }
}
