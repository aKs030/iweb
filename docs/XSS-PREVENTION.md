# 🛡️ XSS Prevention Guide

## Übersicht

Dieses Projekt verwendet **DOMPurify** zur Verhinderung von Cross-Site Scripting (XSS) Angriffen.

---

## ✅ Sichere Praktiken

### 1. Verwende `textContent` für reinen Text

```javascript
// ✅ SICHER
element.textContent = userInput;

// ❌ UNSICHER
element.innerHTML = userInput;
```

### 2. Verwende den HTML-Sanitizer für HTML-Inhalte

```javascript
import { sanitizeHTML, sanitizeHTMLStrict } from '/content/utils/html-sanitizer.js';

// ✅ SICHER - Für vertrauenswürdige Inhalte (z.B. CMS)
element.innerHTML = sanitizeHTML(htmlContent);

// ✅ SICHER - Für Benutzer-generierte Inhalte
element.innerHTML = sanitizeHTMLStrict(userGeneratedHTML);
```

### 3. Escape HTML für Anzeige als Text

```javascript
import { escapeHTML } from '/content/utils/html-sanitizer.js';

// ✅ SICHER - Zeigt HTML als Text an
element.innerHTML = `<p>User said: ${escapeHTML(userInput)}</p>`;
```

---

## 📚 Verfügbare Funktionen

### `sanitizeHTML(html, config?)`

Sanitisiert HTML mit Standard-Konfiguration (erlaubt gängige Tags).

```javascript
const safe = sanitizeHTML('<p>Hello <script>alert()</script></p>');
// Ergebnis: '<p>Hello </p>'
```

**Erlaubte Tags:** p, div, span, b, i, em, strong, a, h1-h6, ul, ol, li, code, pre, blockquote, br

---

### `sanitizeHTMLStrict(html)`

Sanitisiert HTML mit strikten Regeln (nur minimale Formatierung).

```javascript
const safe = sanitizeHTMLStrict('<div><p>Hello <b>World</b></p></div>');
// Ergebnis: '<p>Hello <b>World</b></p>'
```

**Erlaubte Tags:** b, i, em, strong, a, p, br

---

### `sanitizeHTMLMinimal(html)`

Sanitisiert HTML mit minimalen Regeln (nur Text-Formatierung).

```javascript
const safe = sanitizeHTMLMinimal('<p>Hello <b>World</b></p>');
// Ergebnis: 'Hello <b>World</b>'
```

**Erlaubte Tags:** b, i, em, strong, br

---

### `escapeHTML(text)`

Escaped HTML-Sonderzeichen für Anzeige als Text.

```javascript
const escaped = escapeHTML('<script>alert("xss")</script>');
// Ergebnis: '&lt;script&gt;alert("xss")&lt;/script&gt;'
```

---

### `stripHTML(html)`

Entfernt alle HTML-Tags.

```javascript
const text = stripHTML('<p>Hello <b>World</b></p>');
// Ergebnis: 'Hello World'
```

---

### `isSafeURL(url)`

Prüft, ob eine URL sicher ist (keine javascript:, data:, etc.).

```javascript
isSafeURL('https://example.com'); // true
isSafeURL('javascript:alert()'); // false
```

---

## 🚨 Häufige Fehler

### ❌ Fehler 1: Direktes innerHTML ohne Sanitization

```javascript
// ❌ UNSICHER
element.innerHTML = userInput;

// ✅ SICHER
import { sanitizeHTMLStrict } from '/content/utils/html-sanitizer.js';
element.innerHTML = sanitizeHTMLStrict(userInput);
```

---

### ❌ Fehler 2: Template Literals ohne Escaping

```javascript
// ❌ UNSICHER
element.innerHTML = `<p>${userInput}</p>`;

// ✅ SICHER
import { escapeHTML } from '/content/utils/html-sanitizer.js';
element.innerHTML = `<p>${escapeHTML(userInput)}</p>`;
```

---

### ❌ Fehler 3: Event Handler in HTML-Strings

```javascript
// ❌ UNSICHER
element.innerHTML = `<button onclick="${userInput}">Click</button>`;

// ✅ SICHER
const button = document.createElement('button');
button.textContent = 'Click';
button.addEventListener('click', () => {
  // Handler-Code hier
});
element.appendChild(button);
```

---

## 🔍 Code Review Checklist

Beim Code Review auf folgende Muster achten:

- [ ] Alle `innerHTML` Zuweisungen verwenden Sanitization
- [ ] Benutzereingaben werden escaped oder sanitized
- [ ] Keine `eval()` oder `Function()` Konstruktoren
- [ ] Keine `javascript:` URLs in Links
- [ ] Event Handler werden per `addEventListener` gesetzt, nicht inline
- [ ] URLs werden mit `isSafeURL()` validiert

---

## 📝 Beispiele aus dem Projekt

### Robot Chat (Benutzer-Nachrichten)

```javascript
// content/components/robot-companion/modules/robot-chat.js
addMessage(text, type = 'bot') {
  const msg = document.createElement('div');
  msg.className = `message ${type}`;
  
  if (type === 'user') {
    // Benutzernachrichten: nur Text
    msg.textContent = String(text || '');
  } else {
    // Bot-Nachrichten: sanitized HTML
    import('/content/utils/html-sanitizer.js').then(({ sanitizeHTMLMinimal }) => {
      msg.innerHTML = sanitizeHTMLMinimal(String(text || ''));
    });
  }
  
  this.robot.dom.messages.appendChild(msg);
}
```

### Search Results

```javascript
// content/components/search/search.js
createResultHTML(result, query) {
  const safeTitle = this.escapeHTML(result.title || '');
  const safeDesc = this.escapeHTML(result.description || '');
  const safeUrl = this.escapeHTML(result.url || '#');
  
  return `
    <a href="${safeUrl}" class="search-result-item">
      <div class="search-result-title">${safeTitle}</div>
      <div class="search-result-description">${safeDesc}</div>
    </a>
  `;
}
```

---

## 🧪 Testing

Tests befinden sich in `content/utils/html-sanitizer.test.js`.

```bash
# Tests ausführen (sobald Vitest konfiguriert ist)
npm test

# Nur Sanitizer-Tests
npm test html-sanitizer
```

---

## 📖 Weitere Ressourcen

- [DOMPurify Dokumentation](https://github.com/cure53/DOMPurify)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [MDN: textContent vs innerHTML](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent)

---

**Status:** ✅ XSS-Schutz implementiert, Tests vorhanden
