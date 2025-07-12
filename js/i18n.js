// i18n.js - Internationalization Support
class I18nManager {
    constructor() {
        this.currentLanguage = 'de';
        this.fallbackLanguage = 'de';
        this.translations = {};
        this.loadedLanguages = new Set();
        this.init();
    }

    async init() {
        // Detect browser language
        const browserLang = navigator.language?.split('-')[0] || 'de';
        const savedLang = localStorage.getItem('preferred-language');
        const urlLang = new URLSearchParams(window.location.search).get('lang');
        
        // Priority: URL > Saved > Browser > Default
        this.currentLanguage = urlLang || savedLang || browserLang || 'de';
        
        await this.loadLanguage(this.currentLanguage);
        this.applyTranslations();
        this.setupLanguageSwitcher();
    }

    async loadLanguage(language) {
        if (this.loadedLanguages.has(language)) return;

        try {
            // In production würden diese aus separaten JSON-Dateien geladen
            const translations = await this.getTranslations(language);
            this.translations[language] = translations;
            this.loadedLanguages.add(language);
        } catch (error) {
            console.warn(`Failed to load language: ${language}`, error);
            if (language !== this.fallbackLanguage) {
                await this.loadLanguage(this.fallbackLanguage);
            }
        }
    }

    async getTranslations(language) {
        // Embedded translations - in production aus JSON-Dateien
        const translations = {
            de: {
                // Navigation
                'nav.home': 'Startseite',
                'nav.about': 'Über mich',
                'nav.portfolio': 'Portfolio',
                'nav.contact': 'Kontakt',
                'nav.games': 'Spiele',
                
                // Hero Section
                'hero.welcome': 'Willkommen',
                'hero.subtitle': 'Ich freue mich, dass du den Weg hierher gefunden hast.',
                'hero.cta': 'Mehr erfahren',
                
                // About
                'about.title': 'Über mich',
                'about.description': 'Leidenschaftlicher Entwickler mit Fokus auf moderne Web-Technologien.',
                'about.skills': 'Fähigkeiten',
                'about.experience': 'Erfahrung',
                
                // Contact
                'contact.title': 'Kontakt',
                'contact.email': 'E-Mail',
                'contact.phone': 'Telefon',
                'contact.linkedin': 'LinkedIn',
                'contact.github': 'GitHub',
                'contact.send': 'Nachricht senden',
                
                // Footer
                'footer.copyright': '© 2025 Abdulkerim. Alle Rechte vorbehalten.',
                'footer.privacy': 'Datenschutz',
                'footer.imprint': 'Impressum',
                
                // Cookie Banner
                'cookies.title': 'Cookie-Einstellungen',
                'cookies.description': 'Wir verwenden Cookies zur Verbesserung Ihrer Erfahrung.',
                'cookies.accept': 'Alle akzeptieren',
                'cookies.reject': 'Alle ablehnen',
                'cookies.settings': 'Einstellungen',
                
                // PWA
                'pwa.install': 'App installieren',
                'pwa.offline': 'Offline-Modus',
                'pwa.update': 'Update verfügbar',
                
                // Games
                'games.title': 'Mini-Spiele',
                'games.snake': 'Snake',
                'games.tetris': 'Tetris',
                'games.score': 'Punkte',
                'games.highscore': 'Highscore',
                
                // Meta
                'meta.title': 'Abdulkerim - Persönliche Website',
                'meta.description': 'Persönliche Website von Abdulkerim mit Portfolio, Projekten und Kontaktinformationen.'
            },
            
            en: {
                // Navigation
                'nav.home': 'Home',
                'nav.about': 'About',
                'nav.portfolio': 'Portfolio',
                'nav.contact': 'Contact',
                'nav.games': 'Games',
                
                // Hero Section
                'hero.welcome': 'Welcome',
                'hero.subtitle': 'I\'m glad you found your way here.',
                'hero.cta': 'Learn more',
                
                // About
                'about.title': 'About me',
                'about.description': 'Passionate developer focused on modern web technologies.',
                'about.skills': 'Skills',
                'about.experience': 'Experience',
                
                // Contact
                'contact.title': 'Contact',
                'contact.email': 'Email',
                'contact.phone': 'Phone',
                'contact.linkedin': 'LinkedIn',
                'contact.github': 'GitHub',
                'contact.send': 'Send message',
                
                // Footer
                'footer.copyright': '© 2025 Abdulkerim. All rights reserved.',
                'footer.privacy': 'Privacy',
                'footer.imprint': 'Imprint',
                
                // Cookie Banner
                'cookies.title': 'Cookie Settings',
                'cookies.description': 'We use cookies to improve your experience.',
                'cookies.accept': 'Accept all',
                'cookies.reject': 'Reject all',
                'cookies.settings': 'Settings',
                
                // PWA
                'pwa.install': 'Install App',
                'pwa.offline': 'Offline Mode',
                'pwa.update': 'Update available',
                
                // Games
                'games.title': 'Mini Games',
                'games.snake': 'Snake',
                'games.tetris': 'Tetris',
                'games.score': 'Score',
                'games.highscore': 'Highscore',
                
                // Meta
                'meta.title': 'Abdulkerim - Personal Website',
                'meta.description': 'Personal website of Abdulkerim with portfolio, projects and contact information.'
            },
            
            tr: {
                // Navigation
                'nav.home': 'Ana Sayfa',
                'nav.about': 'Hakkımda',
                'nav.portfolio': 'Portföy',
                'nav.contact': 'İletişim',
                'nav.games': 'Oyunlar',
                
                // Hero Section
                'hero.welcome': 'Hoş Geldiniz',
                'hero.subtitle': 'Buraya kadar geldiğiniz için memnunum.',
                'hero.cta': 'Daha fazla bilgi',
                
                // About
                'about.title': 'Hakkımda',
                'about.description': 'Modern web teknolojilerine odaklanan tutkulu geliştirici.',
                'about.skills': 'Yetenekler',
                'about.experience': 'Deneyim',
                
                // Contact
                'contact.title': 'İletişim',
                'contact.email': 'E-posta',
                'contact.phone': 'Telefon',
                'contact.linkedin': 'LinkedIn',
                'contact.github': 'GitHub',
                'contact.send': 'Mesaj gönder',
                
                // Footer
                'footer.copyright': '© 2025 Abdulkerim. Tüm hakları saklıdır.',
                'footer.privacy': 'Gizlilik',
                'footer.imprint': 'Künye',
                
                // Cookie Banner
                'cookies.title': 'Çerez Ayarları',
                'cookies.description': 'Deneyiminizi iyileştirmek için çerezler kullanıyoruz.',
                'cookies.accept': 'Tümünü kabul et',
                'cookies.reject': 'Tümünü reddet',
                'cookies.settings': 'Ayarlar',
                
                // PWA
                'pwa.install': 'Uygulamayı Yükle',
                'pwa.offline': 'Çevrimdışı Mod',
                'pwa.update': 'Güncelleme mevcut',
                
                // Games
                'games.title': 'Mini Oyunlar',
                'games.snake': 'Yılan',
                'games.tetris': 'Tetris',
                'games.score': 'Puan',
                'games.highscore': 'En Yüksek Puan',
                
                // Meta
                'meta.title': 'Abdulkerim - Kişisel Website',
                'meta.description': 'Portföy, projeler ve iletişim bilgileri ile Abdulkerim\'in kişisel websitesi.'
            }
        };

        return translations[language] || translations[this.fallbackLanguage];
    }

    t(key, params = {}) {
        const translation = this.translations[this.currentLanguage]?.[key] || 
                          this.translations[this.fallbackLanguage]?.[key] || 
                          key;

        // Simple parameter replacement
        return Object.keys(params).reduce((str, param) => {
            return str.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
        }, translation);
    }

    applyTranslations() {
        // Translate elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            if (element.hasAttribute('data-i18n-placeholder')) {
                element.placeholder = translation;
            } else if (element.hasAttribute('data-i18n-title')) {
                element.title = translation;
            } else if (element.hasAttribute('data-i18n-alt')) {
                element.alt = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Update document title and meta description
        document.title = this.t('meta.title');
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.content = this.t('meta.description');
        }

        // Update language attribute
        document.documentElement.lang = this.currentLanguage;
        
        // Save preference
        localStorage.setItem('preferred-language', this.currentLanguage);
        
        // Update URL if needed
        if (new URLSearchParams(window.location.search).get('lang') !== this.currentLanguage) {
            const url = new URL(window.location);
            url.searchParams.set('lang', this.currentLanguage);
            window.history.replaceState({}, '', url);
        }
    }

    setupLanguageSwitcher() {
        // Create language switcher if not exists
        let switcher = document.getElementById('language-switcher');
        if (!switcher) {
            switcher = document.createElement('div');
            switcher.id = 'language-switcher';
            switcher.innerHTML = `
                <div class="language-switcher">
                    <button class="language-btn" data-lang="de" title="Deutsch">🇩🇪</button>
                    <button class="language-btn" data-lang="en" title="English">🇺🇸</button>
                    <button class="language-btn" data-lang="tr" title="Türkçe">🇹🇷</button>
                </div>
            `;
            
            // Add to header or create floating switcher
            const header = document.querySelector('header nav') || document.querySelector('nav');
            if (header) {
                header.appendChild(switcher);
            } else {
                // Floating switcher
                switcher.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1000;
                    background: rgba(255, 255, 255, 0.9);
                    border-radius: 8px;
                    padding: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                `;
                document.body.appendChild(switcher);
            }
        }

        // Style language switcher
        if (!document.getElementById('i18n-styles')) {
            const styles = document.createElement('style');
            styles.id = 'i18n-styles';
            styles.textContent = `
                .language-switcher {
                    display: flex;
                    gap: 4px;
                }
                .language-btn {
                    background: none;
                    border: 2px solid transparent;
                    border-radius: 4px;
                    padding: 4px 8px;
                    cursor: pointer;
                    font-size: 16px;
                    transition: all 0.2s ease;
                }
                .language-btn:hover {
                    background: rgba(58, 133, 255, 0.1);
                    border-color: rgba(58, 133, 255, 0.3);
                }
                .language-btn.active {
                    background: var(--primary-color, #3a85ff);
                    color: white;
                    border-color: var(--primary-color, #3a85ff);
                }
            `;
            document.head.appendChild(styles);
        }

        // Add event listeners
        switcher.querySelectorAll('[data-lang]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const newLang = e.target.getAttribute('data-lang');
                if (newLang !== this.currentLanguage) {
                    await this.switchLanguage(newLang);
                }
            });
            
            // Mark current language as active
            if (btn.getAttribute('data-lang') === this.currentLanguage) {
                btn.classList.add('active');
            }
        });
    }

    async switchLanguage(language) {
        const oldLang = this.currentLanguage;
        this.currentLanguage = language;
        
        try {
            await this.loadLanguage(language);
            this.applyTranslations();
            
            // Update active state
            document.querySelectorAll('.language-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-lang') === language);
            });
            
            // Trigger custom event
            window.dispatchEvent(new CustomEvent('languageChanged', {
                detail: { oldLanguage: oldLang, newLanguage: language }
            }));
            
        } catch (error) {
            console.error('Language switch failed:', error);
            this.currentLanguage = oldLang;
        }
    }

    // Public API
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    getSupportedLanguages() {
        return ['de', 'en', 'tr'];
    }

    addTranslations(language, translations) {
        if (!this.translations[language]) {
            this.translations[language] = {};
        }
        Object.assign(this.translations[language], translations);
    }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    window.i18n = new I18nManager();
    
    // Global helper function
    window.t = (key, params) => window.i18n.t(key, params);
});

export default I18nManager;
