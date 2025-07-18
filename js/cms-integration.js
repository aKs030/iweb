// cms-integration.js - Einfache CMS-ähnliche Funktionalität
class SimpleCMS {
  constructor() {
    this.content = {};
    this.contentFile = '/data/content.json';
    this.init();
  }

  async init() {
    try {
      await this.loadContent();
      this.bindEditEvents();
    } catch (error) {
      console.warn('CMS: Content loading failed, using defaults');
      this.useDefaults();
    }
  }

  async loadContent() {
    const response = await fetch(this.contentFile);
    if (response.ok) {
      this.content = await response.json();
      this.renderContent();
    }
  }

  useDefaults() {
    this.content = {
      site: {
        title: 'Abdulkerim ⭐️',
        description: 'Persönliche Website von Abdulkerim',
        author: 'Abdulkerim',
      },
      hero: {
        title: 'Willkommen',
        subtitle: 'Ich freue mich, dass du den Weg hierher gefunden hast.',
      },
      about: {
        name: 'Abdulkerim',
        age: 32,
        location: 'Berlin',
        bio: 'Entwickler mit Leidenschaft für moderne Web-Technologien.',
      },
      contact: {
        email: 'mail@abdulkerimsesli.com',
        linkedin: 'https://linkedin.com/in/abdulkerim-sesli',
        github: 'https://github.com/aKs030',
      },
    };
    this.renderContent();
  }

  renderContent() {
    // Site-wide content
    this.updateElement('[data-cms="site.title"]', this.content.site?.title);
    this.updateElement(
      '[data-cms="site.description"]',
      this.content.site?.description
    );

    // Hero section
    this.updateElement('[data-cms="hero.title"]', this.content.hero?.title);
    this.updateElement(
      '[data-cms="hero.subtitle"]',
      this.content.hero?.subtitle
    );

    // About section
    this.updateElement('[data-cms="about.name"]', this.content.about?.name);
    this.updateElement('[data-cms="about.bio"]', this.content.about?.bio);

    // Contact
    this.updateAttribute(
      '[data-cms="contact.email"]',
      'href',
      `mailto:${this.content.contact?.email}`
    );
    this.updateAttribute(
      '[data-cms="contact.linkedin"]',
      'href',
      this.content.contact?.linkedin
    );
    this.updateAttribute(
      '[data-cms="contact.github"]',
      'href',
      this.content.contact?.github
    );
  }

  updateElement(selector, content) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      if (content !== undefined && content !== null) {
        element.textContent = content;
      }
    });
  }

  updateAttribute(selector, attribute, value) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      if (value !== undefined && value !== null) {
        element.setAttribute(attribute, value);
      }
    });
  }

  bindEditEvents() {
    if (!this.isEditMode()) return;

    // Admin-Panel für Content-Editing (nur im Edit-Modus)
    this.createEditPanel();

    // Click-to-edit Funktionalität
    document.querySelectorAll('[data-cms]').forEach((element) => {
      element.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) {
          this.editElement(element);
        }
      });

      // Visual indicator für editierbare Elemente
      element.style.outline = '1px dashed rgba(58, 133, 255, 0.3)';
      element.style.cursor = 'pointer';
      element.title = 'Ctrl+Click zum Bearbeiten';
    });
  }

  isEditMode() {
    return (
      window.location.search.includes('edit=true') ||
      window.location.hash.includes('edit')
    );
  }

  createEditPanel() {
    const panel = document.createElement('div');
    panel.id = 'cms-panel';
    panel.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(58, 133, 255, 0.95);
                color: white;
                padding: 1rem;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-family: 'Poppins', sans-serif;
                font-size: 14px;
                max-width: 300px;
            ">
                <h4 style="margin: 0 0 10px 0;">📝 CMS Edit Mode</h4>
                <p style="margin: 0 0 10px 0; font-size: 12px;">
                    Ctrl+Click auf editierbare Elemente zum Bearbeiten
                </p>
                <button id="cms-save" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 5px;
                ">💾 Speichern</button>
                <button id="cms-exit" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                ">❌ Beenden</button>
            </div>
        `;

    document.body.appendChild(panel);

    // Event listeners für Panel-Buttons
    document.getElementById('cms-save').addEventListener('click', () => {
      this.saveContent();
    });

    document.getElementById('cms-exit').addEventListener('click', () => {
      window.location.search = window.location.search.replace(
        /[?&]edit=true/,
        ''
      );
    });
  }

  editElement(element) {
    const cmsPath = element.getAttribute('data-cms');
    const currentValue = element.textContent;

    const newValue = prompt(`Bearbeiten: ${cmsPath}`, currentValue);
    if (newValue !== null && newValue !== currentValue) {
      element.textContent = newValue;
      this.updateContentObject(cmsPath, newValue);
    }
  }

  updateContentObject(path, value) {
    const parts = path.split('.');
    let obj = this.content;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }

    obj[parts[parts.length - 1]] = value;
  }

  async saveContent() {
    try {
      // In einer echten Implementierung würde hier ein API-Call gemacht
      console.log('Content to save:', JSON.stringify(this.content, null, 2));
      alert(
        '💾 Content gespeichert! (Simulation - echte Implementierung benötigt Backend)'
      );
    } catch (error) {
      console.error('Save failed:', error);
      alert('❌ Speichern fehlgeschlagen');
    }
  }

  // Public API
  getContent() {
    return this.content;
  }

  setContent(newContent) {
    this.content = { ...this.content, ...newContent };
    this.renderContent();
  }
}

// Auto-initialize nur wenn CMS-Features erwünscht
if (
  window.location.search.includes('cms=true') ||
  window.location.search.includes('edit=true')
) {
  document.addEventListener('DOMContentLoaded', () => {
    window.simpleCMS = new SimpleCMS();

    // Global API
    window.CMS = {
      getContent: () => window.simpleCMS.getContent(),
      setContent: (content) => window.simpleCMS.setContent(content),
      save: () => window.simpleCMS.saveContent(),
    };
  });
}

export default SimpleCMS;
