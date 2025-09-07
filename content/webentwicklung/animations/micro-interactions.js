/**
 * Micro-Interaktionen für verbesserte UX
 * Subtile Animationen und Feedback-Systeme
 * @author Abdulkerim Sesli
 */

class MicroInteractions {
    constructor() {
        this.activeInteractions = new Map();
        this.init();
    }
    
    init() {
        this.setupRippleEffects();
        this.setupHoverEffects();
        this.setupFocusEffects();
        this.setupLoadingStates();
        this.setupTooltips();
        this.setupMagneticEffects();
        this.setupTiltEffects();
        this.setupButtonFeedback();
        this.setupFormValidation();
        this.setupScrollEffects();
    }
    
    /**
     * Ripple Effekte für Buttons und interaktive Elemente
     */
    setupRippleEffects() {
        const rippleElements = document.querySelectorAll('.ripple-effect, [data-ripple]');
        
        rippleElements.forEach(element => {
            element.addEventListener('click', (e) => {
                this.createRipple(e, element);
            });
        });
    }
    
    createRipple(event, element) {
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transform: scale(0);
            animation: rippleEffect 0.6s linear;
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
            pointer-events: none;
        `;
        
        // Relative positioning für Element sicherstellen
        if (getComputedStyle(element).position === 'static') {
            element.style.position = 'relative';
        }
        element.style.overflow = 'hidden';
        
        element.appendChild(ripple);
        
        // Ripple nach Animation entfernen
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }
    
    /**
     * Erweiterte Hover-Effekte
     */
    setupHoverEffects() {
        const hoverElements = document.querySelectorAll('.hover-lift, [data-hover="lift"]');
        
        hoverElements.forEach(element => {
            element.addEventListener('mouseenter', () => {
                element.style.transform = 'translateY(-4px)';
                element.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
                element.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.transform = 'translateY(0)';
                element.style.boxShadow = '';
            });
        });
        
        // Glow Effekte
        const glowElements = document.querySelectorAll('.hover-glow, [data-hover="glow"]');
        
        glowElements.forEach(element => {
            element.addEventListener('mouseenter', () => {
                element.style.boxShadow = '0 0 20px rgba(7, 161, 255, 0.4)';
                element.style.transition = 'box-shadow 0.3s ease';
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.boxShadow = '';
            });
        });
    }
    
    /**
     * Focus-Effekte für Accessibility
     */
    setupFocusEffects() {
        const focusElements = document.querySelectorAll('button, input, textarea, select, a, [tabindex]');
        
        focusElements.forEach(element => {
            element.addEventListener('focus', () => {
                element.classList.add('focused');
                this.createFocusRing(element);
            });
            
            element.addEventListener('blur', () => {
                element.classList.remove('focused');
                this.removeFocusRing(element);
            });
        });
    }
    
    createFocusRing(element) {
        const ring = document.createElement('div');
        ring.className = 'focus-ring';
        ring.style.cssText = `
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            border: 2px solid var(--primary-color, #07a1ff);
            border-radius: inherit;
            pointer-events: none;
            animation: focusRingAppear 0.2s ease-out;
        `;
        
        if (getComputedStyle(element).position === 'static') {
            element.style.position = 'relative';
        }
        
        element.appendChild(ring);
    }
    
    removeFocusRing(element) {
        const ring = element.querySelector('.focus-ring');
        if (ring) {
            ring.style.animation = 'focusRingDisappear 0.2s ease-out';
            setTimeout(() => {
                if (ring.parentNode) {
                    ring.parentNode.removeChild(ring);
                }
            }, 200);
        }
    }
    
    /**
     * Loading States
     */
    setupLoadingStates() {
        const loadingButtons = document.querySelectorAll('[data-loading]');
        
        loadingButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.showLoading(button);
            });
        });
    }
    
    showLoading(element, duration = 2000) {
        const originalContent = element.innerHTML;
        const originalWidth = element.offsetWidth;
        
        element.style.width = originalWidth + 'px';
        element.innerHTML = `
            <span class="loading-spinner"></span>
            <span style="margin-left: 8px;">Loading...</span>
        `;
        element.disabled = true;
        element.classList.add('loading');
        
        setTimeout(() => {
            this.hideLoading(element, originalContent);
        }, duration);
    }
    
    hideLoading(element, originalContent) {
        element.innerHTML = originalContent;
        element.disabled = false;
        element.classList.remove('loading');
        element.style.width = '';
    }
    
    /**
     * Tooltips
     */
    setupTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                this.showTooltip(e.target);
            });
            
            element.addEventListener('mouseleave', (e) => {
                this.hideTooltip(e.target);
            });
        });
    }
    
    showTooltip(element) {
        const text = element.dataset.tooltip;
        const position = element.dataset.tooltipPosition || 'top';
        
        const tooltip = document.createElement('div');
        tooltip.className = `tooltip tooltip-${position}`;
        tooltip.textContent = text;
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 0.875rem;
            white-space: nowrap;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transform: translateY(5px);
            transition: all 0.2s ease;
        `;
        
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let left, top;
        
        switch (position) {
            case 'top':
                left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                top = rect.top - tooltipRect.height - 8;
                break;
            case 'bottom':
                left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                top = rect.bottom + 8;
                break;
            case 'left':
                left = rect.left - tooltipRect.width - 8;
                top = rect.top + rect.height / 2 - tooltipRect.height / 2;
                break;
            case 'right':
                left = rect.right + 8;
                top = rect.top + rect.height / 2 - tooltipRect.height / 2;
                break;
        }
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        
        // Animation
        requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0)';
        });
        
        element._tooltip = tooltip;
    }
    
    hideTooltip(element) {
        if (element._tooltip) {
            element._tooltip.style.opacity = '0';
            element._tooltip.style.transform = 'translateY(5px)';
            
            setTimeout(() => {
                if (element._tooltip && element._tooltip.parentNode) {
                    element._tooltip.parentNode.removeChild(element._tooltip);
                }
                element._tooltip = null;
            }, 200);
        }
    }
    
    /**
     * Magnetische Effekte
     */
    setupMagneticEffects() {
        const magneticElements = document.querySelectorAll('.magnetic, [data-magnetic]');
        
        magneticElements.forEach(element => {
            element.addEventListener('mousemove', (e) => {
                this.magneticEffect(e, element);
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.transform = '';
                element.style.transition = 'transform 0.3s ease';
            });
        });
    }
    
    magneticEffect(event, element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const deltaX = (event.clientX - centerX) * 0.2;
        const deltaY = (event.clientY - centerY) * 0.2;
        
        element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        element.style.transition = 'none';
    }
    
    /**
     * Tilt-Effekte
     */
    setupTiltEffects() {
        const tiltElements = document.querySelectorAll('.tilt-interaction, [data-tilt]');
        
        tiltElements.forEach(element => {
            element.addEventListener('mousemove', (e) => {
                this.tiltEffect(e, element);
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
                element.style.transition = 'transform 0.5s ease';
            });
        });
    }
    
    tiltEffect(event, element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const rotateX = (event.clientY - centerY) / 10;
        const rotateY = (centerX - event.clientX) / 10;
        
        element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        element.style.transition = 'none';
    }
    
    /**
     * Button Feedback
     */
    setupButtonFeedback() {
        const buttons = document.querySelectorAll('button, .btn, [role="button"]');
        
        buttons.forEach(button => {
            button.addEventListener('mousedown', () => {
                button.style.transform = 'scale(0.98)';
                button.style.transition = 'transform 0.1s ease';
            });
            
            button.addEventListener('mouseup', () => {
                button.style.transform = '';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.transform = '';
            });
        });
    }
    
    /**
     * Form Validation Feedback
     */
    setupFormValidation() {
        const inputs = document.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateInput(input);
            });
            
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    this.validateInput(input);
                }
            });
        });
    }
    
    validateInput(input) {
        const isValid = input.validity.valid;
        
        input.classList.remove('error', 'success');
        
        if (input.value.length > 0) {
            if (isValid) {
                input.classList.add('success');
                this.showValidationFeedback(input, 'success');
            } else {
                input.classList.add('error');
                this.showValidationFeedback(input, 'error');
            }
        }
    }
    
    showValidationFeedback(input, type) {
        // Entferne altes Feedback
        const oldFeedback = input.parentNode.querySelector('.validation-feedback');
        if (oldFeedback) {
            oldFeedback.remove();
        }
        
        const feedback = document.createElement('div');
        feedback.className = `validation-feedback ${type}`;
        feedback.style.cssText = `
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            opacity: 0;
            animation: feedbackAppear 0.3s ease forwards;
        `;
        
        if (type === 'success') {
            feedback.style.background = '#10b981';
            feedback.style.color = 'white';
            feedback.textContent = '✓';
        } else {
            feedback.style.background = '#ef4444';
            feedback.style.color = 'white';
            feedback.textContent = '!';
        }
        
        if (getComputedStyle(input.parentNode).position === 'static') {
            input.parentNode.style.position = 'relative';
        }
        
        input.parentNode.appendChild(feedback);
    }
    
    /**
     * Scroll-basierte Micro-Interaktionen
     */
    setupScrollEffects() {
        let ticking = false;
        
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    this.updateScrollEffects();
                    ticking = false;
                });
                ticking = true;
            }
        });
    }
    
    updateScrollEffects() {
        const scrollPercent = (window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        
        // Progress Bar aktualisieren
        const progressBar = document.querySelector('.scroll-progress');
        if (progressBar) {
            progressBar.style.width = scrollPercent + '%';
        }
        
        // Floating Action Button
        const fab = document.querySelector('.floating-action-button');
        if (fab) {
            if (scrollPercent > 20) {
                fab.classList.add('visible');
            } else {
                fab.classList.remove('visible');
            }
        }
    }
    
    /**
     * Öffentliche API
     */
    
    // Toast Notifications
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--bg-card, #1a1a1a);
            color: var(--text-primary, white);
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1001;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
        `;
        
        document.body.appendChild(toast);
        
        // Animation
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
        });
        
        // Auto-remove
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }
    
    // Shake Animation
    shake(element) {
        element.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }
    
    // Pulse Animation
    pulse(element, duration = 1000) {
        element.style.animation = `pulse ${duration}ms ease-in-out`;
        setTimeout(() => {
            element.style.animation = '';
        }, duration);
    }
}

// CSS für Micro-Interaktionen
const microInteractionStyles = `
    @keyframes rippleEffect {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    @keyframes focusRingAppear {
        from {
            opacity: 0;
            transform: scale(0.8);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
    
    @keyframes focusRingDisappear {
        from {
            opacity: 1;
            transform: scale(1);
        }
        to {
            opacity: 0;
            transform: scale(1.2);
        }
    }
    
    @keyframes feedbackAppear {
        from {
            opacity: 0;
            transform: translateY(-50%) scale(0.5);
        }
        to {
            opacity: 1;
            transform: translateY(-50%) scale(1);
        }
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
    
    .loading-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 1s ease-in-out infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .input.error {
        border-color: #ef4444;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }
    
    .input.success {
        border-color: #10b981;
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }
    
    .scroll-progress {
        position: fixed;
        top: 0;
        left: 0;
        height: 3px;
        background: var(--primary-color, #07a1ff);
        z-index: 1000;
        transition: width 0.1s ease;
    }
    
    .floating-action-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--primary-color, #07a1ff);
        border: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        opacity: 0;
        transform: scale(0);
        transition: all 0.3s ease;
        z-index: 1000;
    }
    
    .floating-action-button.visible {
        opacity: 1;
        transform: scale(1);
    }
    
    /* Accessibility */
    @media (prefers-reduced-motion: reduce) {
        .ripple-effect,
        .hover-lift,
        .tilt-interaction,
        .magnetic {
            transition: none !important;
            animation: none !important;
        }
    }
`;

// Styles injizieren
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = microInteractionStyles;
    document.head.appendChild(styleSheet);
}

// Auto-Initialisierung
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.microInteractions = new MicroInteractions();
    });
}

// ES6 Module Export
export { MicroInteractions };
export default MicroInteractions;
