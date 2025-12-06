/**
 * KI Roboter Begleiter
 * Eine leichte, interaktive Komponente für die Webseite.
 */

class RobotCompanion {
    constructor() {
        this.containerId = 'robot-companion-container';
        this.state = {
            isOpen: false,
            hasGreeted: false,
            messageDelay: 600 // ms
        };
        
        // Antworten-Datenbank
        this.knowledgeBase = {
            'start': {
                text: 'Hallo! Ich bin Cyber, dein virtueller Assistent. 🤖 Wie kann ich dir heute helfen?',
                options: [
                    { label: 'Über mich', action: 'about' },
                    { label: 'Projekte zeigen', action: 'projects' },
                    { label: 'Kontakt', action: 'contact' },
                    { label: 'Witz erzählen', action: 'joke' }
                ]
            },
            'about': {
                text: 'Das ist eine moderne Web-Portfolio-Seite. Hier findest du Informationen über Entwickler-Skills, kreative Projekte und mehr. Soll ich dich zur "Über mich" Seite bringen?',
                options: [
                    { label: 'Ja, bitte!', url: '/pages/about/about.html' },
                    { label: 'Zurück zum Menü', action: 'start' }
                ]
            },
            'projects': {
                text: 'Wir haben einige spannende Projekte hier! Von Web-Apps bis zu Design-Experimenten. Wirf einen Blick in die Galerie.',
                options: [
                    { label: 'Zur Galerie', url: '/pages/projekte/projekte.html' },
                    { label: 'Zurück', action: 'start' }
                ]
            },
            'contact': {
                text: 'Du findest Kontaktmöglichkeiten im Footer der Seite oder im Impressum. Ich kann dich dorthin scrollen!',
                options: [
                    { label: 'Zum Footer scrollen', action: 'scrollFooter' },
                    { label: 'Alles klar', action: 'start' }
                ]
            },
            'joke': {
                text: [
                    'Was macht ein Pirat am Computer? Er drückt die Enter-Taste! 🏴‍☠️',
                    'Warum gehen Geister nicht in den Regen? Damit sie nicht nass werden... nein, damit sie nicht "ge-löscht" werden!',
                    'Es gibt 10 Arten von Menschen: Die, die Binär verstehen, und die, die es nicht tun.'
                ],
                options: [
                    { label: 'Noch einer!', action: 'joke' },
                    { label: 'Genug gelacht', action: 'start' }
                ]
            }
        };

        this.init();
    }

    init() {
        // Sicherstellen, dass CSS geladen ist
        this.loadCSS();
        // HTML Struktur erstellen
        this.createDOM();
        // Event Listeners
        this.attachEvents();
        
        // Initiale Begrüßung nach Verzögerung
        setTimeout(() => {
            if (!this.state.isOpen) {
                this.showBubble("Psst! Brauchst du Hilfe? 👋");
            }
        }, 5000);
    }

    loadCSS() {
        if (!document.querySelector('link[href*="robot-companion.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/content/components/robot-companion/robot-companion.css';
            document.head.appendChild(link);
        }
    }

    createDOM() {
        const container = document.createElement('div');
        container.id = this.containerId;

        // Roboter SVG (Vollständig inline, keine externen Requests)
        const robotSVG = `
        <svg viewBox="0 0 100 100" class="robot-svg">
            <!-- Glow Effect -->
            <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur"/>
                    <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                </filter>
            </defs>
            
            <!-- Antenne -->
            <line x1="50" y1="15" x2="50" y2="25" stroke="#40e0d0" stroke-width="2" />
            <circle cx="50" cy="15" r="3" class="robot-antenna-light" fill="#ff4444" />
            
            <!-- Kopf -->
            <path d="M30,40 a20,20 0 0,1 40,0" fill="#1e293b" stroke="#40e0d0" stroke-width="2" />
            <rect x="30" y="40" width="40" height="15" fill="#1e293b" stroke="#40e0d0" stroke-width="2" />
            
            <!-- Augen -->
            <g class="robot-eye">
                <circle cx="40" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" />
                <circle cx="60" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" />
            </g>
            
            <!-- Körper -->
            <path d="M30,60 L70,60 L65,90 L35,90 Z" fill="#0f172a" stroke="#40e0d0" stroke-width="2" />
            
            <!-- Details -->
            <circle cx="50" cy="70" r="5" fill="#2563eb" opacity="0.8">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
            
            <!-- Arme -->
            <path d="M28,65 Q20,75 28,85" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round" />
            <path d="M72,65 Q80,75 72,85" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round" />
        </svg>
        `;

        container.innerHTML = `
            <div class="robot-chat-window" id="robot-chat-window">
                <div class="chat-header">
                    <div class="chat-title">
                        <span class="chat-status-dot"></span>
                        Cyber Assistant
                    </div>
                    <button class="chat-close-btn">&times;</button>
                </div>
                <div class="chat-messages" id="robot-messages"></div>
                <div class="chat-controls" id="robot-controls"></div>
            </div>
            
            <div class="robot-bubble" id="robot-bubble">
                <span id="robot-bubble-text">Hallo!</span>
                <div class="robot-bubble-close">&times;</div>
            </div>
            
            <div class="robot-avatar">
                ${robotSVG}
            </div>
        `;

        document.body.appendChild(container);

        // Referenzen speichern
        this.dom = {
            window: document.getElementById('robot-chat-window'),
            bubble: document.getElementById('robot-bubble'),
            bubbleText: document.getElementById('robot-bubble-text'),
            bubbleClose: container.querySelector('.robot-bubble-close'),
            messages: document.getElementById('robot-messages'),
            controls: document.getElementById('robot-controls'),
            avatar: container.querySelector('.robot-avatar'),
            closeBtn: container.querySelector('.chat-close-btn')
        };
    }

    attachEvents() {
        // Avatar Klick -> Chat öffnen/schließen
        this.dom.avatar.addEventListener('click', () => this.toggleChat());

        // Schließen Button im Chat
        this.dom.closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleChat(false);
        });

        // Bubble Schließen
        this.dom.bubbleClose.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideBubble();
        });
    }

    toggleChat(forceState) {
        const newState = forceState !== undefined ? forceState : !this.state.isOpen;
        
        if (newState) {
            this.dom.window.classList.add('open');
            this.state.isOpen = true;
            this.hideBubble();
            
            // Wenn keine Nachrichten da sind, Startsequenz
            if (this.dom.messages.children.length === 0) {
                this.handleAction('start');
            }
        } else {
            this.dom.window.classList.remove('open');
            this.state.isOpen = false;
        }
    }

    showBubble(text) {
        if (this.state.isOpen) return;
        this.dom.bubbleText.textContent = text;
        this.dom.bubble.classList.add('visible');
    }

    hideBubble() {
        this.dom.bubble.classList.remove('visible');
    }

    // Chat Logik
    async addMessage(text, type = 'bot') {
        const msg = document.createElement('div');
        msg.className = `message ${type}`;
        msg.textContent = text;
        this.dom.messages.appendChild(msg);
        this.scrollToBottom();
    }

    clearControls() {
        this.dom.controls.innerHTML = '';
    }

    addOptions(options) {
        this.clearControls();
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'chat-option-btn';
            btn.textContent = opt.label;
            
            btn.onclick = () => {
                // User Auswahl anzeigen
                this.addMessage(opt.label, 'user');
                this.clearControls(); // Buttons entfernen
                
                // Bot reagieren lassen
                setTimeout(() => {
                    if (opt.url) {
                        window.location.href = opt.url;
                    } else if (opt.action) {
                        this.handleAction(opt.action);
                    }
                }, 500);
            };
            
            this.dom.controls.appendChild(btn);
        });
    }

    handleAction(actionKey) {
        if (actionKey === 'scrollFooter') {
            document.querySelector('footer')?.scrollIntoView({ behavior: 'smooth' });
            this.addMessage("Ich habe dich nach unten gebracht! 👇", 'bot');
            // Zurück zum Startmenü nach kurzer Zeit
            setTimeout(() => this.handleAction('start'), 2000);
            return;
        }

        const data = this.knowledgeBase[actionKey];
        if (!data) return;

        // Wenn Text ein Array ist (z.B. Witze), wähle zufällig
        let textToShow = Array.isArray(data.text) 
            ? data.text[Math.floor(Math.random() * data.text.length)] 
            : data.text;

        this.addMessage(textToShow, 'bot');
        
        if (data.options) {
            this.addOptions(data.options);
        }
    }

    scrollToBottom() {
        this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
    }
}

// Initialisieren, sobald DOM bereit ist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new RobotCompanion());
} else {
    new RobotCompanion();
}