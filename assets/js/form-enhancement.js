class FormEnhancer {
  constructor(form) {
    this.form = form;
    this.init();
  }

  init() {
    // Auto-save
    this.setupAutoSave();
    
    // Inline Validation
    this.setupValidation();
    
    // Progress Indicator
    this.setupProgress();
  }

  setupAutoSave() {
    let saveTimeout;
    this.form.addEventListener('input', (e) => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.saveToLocalStorage();
        this.showSaveIndicator();
      }, 1000);
    });
  }

  saveToLocalStorage() {
    const formData = new FormData(this.form);
    const data = Object.fromEntries(formData);
    localStorage.setItem(`form-${this.form.id}`, JSON.stringify(data));
  }

  showSaveIndicator() {
    let indicator = this.form.querySelector('.form-save-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'form-save-indicator';
      indicator.style.cssText = 'color: green; font-size: 0.9em; margin-top: 5px;';
      this.form.appendChild(indicator);
    }
    indicator.textContent = 'Gespeichert!';
    setTimeout(() => {
      indicator.textContent = '';
    }, 1500);
  }

  setupValidation() {
    this.form.addEventListener('input', (e) => {
      if (e.target.matches('[required]')) {
        this.validateField(e.target);
      }
    });
  }

  validateField(field) {
    let error = '';
    if (field.required && !field.value.trim()) {
      error = 'Dieses Feld ist erforderlich.';
    } else if (field.type === 'email' && field.value) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(field.value)) {
        error = 'Bitte eine gültige E-Mail-Adresse eingeben.';
      }
    }
    this.showFieldError(field, error);
  }

  showFieldError(field, message) {
    let errorElem = field.nextElementSibling;
    if (!errorElem || !errorElem.classList.contains('form-error')) {
      errorElem = document.createElement('div');
      errorElem.className = 'form-error';
      errorElem.style.cssText = 'color: red; font-size: 0.85em;';
      field.parentNode.insertBefore(errorElem, field.nextSibling);
    }
    errorElem.textContent = message;
  }

  setupProgress() {
    this.progressBar = document.createElement('progress');
    this.progressBar.max = this.form.querySelectorAll('input, textarea, select').length;
    this.progressBar.value = 0;
    this.progressBar.style.width = '100%';
    this.progressBar.style.marginBottom = '10px';
    this.form.insertBefore(this.progressBar, this.form.firstChild);
    this.form.addEventListener('input', () => this.updateProgress());
    this.updateProgress();
  }

  updateProgress() {
    const fields = this.form.querySelectorAll('input, textarea, select');
    let filled = 0;
    fields.forEach(f => {
      if ((f.type !== 'checkbox' && f.type !== 'radio' && f.value) ||
          ((f.type === 'checkbox' || f.type === 'radio') && f.checked)) {
        filled++;
      }
    });
    this.progressBar.value = filled;
  }
}

// Beispiel für die Initialisierung:
// const form = document.querySelector('form');
// new FormEnhancer(form);
