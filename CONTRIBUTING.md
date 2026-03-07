# Contributing to Portfolio Website

Vielen Dank für dein Interesse an diesem Projekt! 🎉

## 🚀 Quick Start

### Prerequisites

- Node.js `22+` (siehe `package.json` `engines.node`)
- npm >= 10.0.0
- Git

### Setup

```bash
# Repository klonen
git clone https://github.com/aKs030/iweb.git
cd iweb

# Dependencies installieren
npm ci

# Development Server starten
npm run dev
```

## 📝 Development Workflow

### 1. Branch erstellen

```bash
git checkout -b feature/dein-feature
# oder
git checkout -b fix/dein-bugfix
```

### 2. Änderungen machen

```bash
# Code schreiben
# Lokal testen
npm run dev
```

### 3. Code Quality prüfen

```bash
# Linting & Formatting
npm run qa

# Automatisch fixen
npm run qa:fix
```

`npm run qa` enthält: ESLint, Prettier, Stylelint, AI-Index-Check, Struktur-Gate und eine Suche nach `TODO`/`FIXME`-Hinweisen (siehe `check:todos`).

### 4. Commit erstellen

```bash
git add .
git commit -m "feat: Beschreibung deiner Änderung"
```

**Commit Message Format:**

- `feat:` - Neues Feature
- `fix:` - Bugfix
- `docs:` - Dokumentation
- `style:` - Code-Formatierung
- `refactor:` - Code-Refactoring
- `perf:` - Performance-Verbesserung
- `test:` - Tests
- `chore:` - Build/Tools

### 5. Push & Pull Request

```bash
git push origin feature/dein-feature
```

Dann öffne einen Pull Request auf GitHub.

## 🎨 CSS Guidelines

### CSS Nesting nutzen

```css
.component {
  /* Base styles */
  padding: 1rem;

  /* Hover state */
  &:hover {
    transform: translateY(-2px);
  }

  /* Child elements */
  .component-title {
    font-size: 1.5rem;
  }

  /* Responsive */
  @media (width <= 768px) {
    padding: 0.5rem;
  }
}
```

### Best Practices

- ✅ Maximale Nesting-Tiefe: 3-4 Ebenen
- ✅ Media Queries am Ende des Blocks
- ✅ CSS Variables verwenden
- ✅ Mobile-First Ansatz
- ✅ Semantic Class Names

### Neue Komponente erstellen

```bash
# 1. Datei erstellen
touch content/styles/components/deine-komponente.css

# 2. In main.css importieren
echo "@import './components/deine-komponente.css';" >> content/styles/main.css

# 3. Komponente mit Nesting schreiben
# Siehe: content/styles/NESTING_EXAMPLE.css
```

## 📦 JavaScript Guidelines

### Code Style

- ES6+ Features nutzen
- Async/Await statt Promises
- Destructuring verwenden
- Arrow Functions bevorzugen

### Beispiel

```javascript
// ✅ Gut
const fetchData = async () => {
  try {
    const response = await fetch('/api/data');
    const { data } = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

// ❌ Vermeiden
function fetchData() {
  return fetch('/api/data')
    .then(function (response) {
      return response.json();
    })
    .then(function (json) {
      return json.data;
    });
}
```

## 🧪 Testing

### Lokal testen

```bash
npm run dev
```

## 📚 Dokumentation

### Dokumentation aktualisieren

Wenn du Features hinzufügst oder änderst:

1. **README.md** aktualisieren
2. Relevante Docs in `docs/` aktualisieren
3. Beispiele hinzufügen (falls nötig)

### Dokumentation anzeigen

Siehe [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md) für vollständige Projekt-Dokumentation.

## 🔧 Nützliche Commands

> ⚠️ **Environment variables**
> Viele Entwickler‑Skripte (z. B. `cf:redirect:audit`) benötigen Cloudflare‑Zugangsdaten.
> Lege lokal eine `.env`-Datei an oder exportiere die folgenden Variablen:
>
> ```bash
> # Cloudflare (optional für redirect-audit etc.)
> CF_ACCOUNT_ID=your_account_id
> CF_API_TOKEN=your_api_token
>
> # CORS whitelist (kommasepariert)
> ALLOWED_ORIGINS=https://abdulkerimsesli.de,https://www.abdulkerimsesli.de
> ```
>
> Siehe auch `.env.example` für ein Template.

```bash
# Development
npm run dev           # Einziger Dev-Workflow (preflight + token watch + app)

# Code Quality
npm run qa            # Empfohlen: kompletter Qualitäts-Run (alles prüfen)
npm run qa:fix        # Empfohlen: auto-fix für ESLint + Stylelint + Prettier
npm run qa:all        # Fix + kompletter Check in einem Lauf

# Maintenance
npm run clean         # lokale Cache/Artifacts löschen
npm run prepare       # Husky Hooks installieren/aktualisieren
npm run docs:check    # Markdown-Links + lokale absolute Pfade prüfen
npm run styles:generate # Tokens + Utilities in einem Run erzeugen
npm run ai-index:sync # AI-Index manuell synchronisieren
npm run cf:redirect:audit # Redirects analysieren
npm run cf:redirect:prune # Redirects bereinigen
```

Optionaler Port:

```bash
npm run dev -- --port 8787
```

## 🐛 Bug Reports

### Guten Bug Report erstellen

1. **Titel:** Kurze, präzise Beschreibung
2. **Beschreibung:** Was ist das Problem?
3. **Schritte:** Wie kann man es reproduzieren?
4. **Erwartetes Verhalten:** Was sollte passieren?
5. **Aktuelles Verhalten:** Was passiert stattdessen?
6. **Screenshots:** Falls relevant
7. **Environment:** Browser, OS, Node-Version

### Template

```markdown
**Beschreibung:**
[Kurze Beschreibung des Problems]

**Schritte zum Reproduzieren:**

1. Gehe zu '...'
2. Klicke auf '...'
3. Scrolle zu '...'
4. Siehe Fehler

**Erwartetes Verhalten:**
[Was sollte passieren]

**Aktuelles Verhalten:**
[Was passiert stattdessen]

**Screenshots:**
[Falls relevant]

**Environment:**

- Browser: Chrome 120
- OS: macOS 14
- Node: 22.22.0
```

## 💡 Feature Requests

### Guten Feature Request erstellen

1. **Problem:** Welches Problem löst das Feature?
2. **Lösung:** Wie sollte das Feature funktionieren?
3. **Alternativen:** Welche Alternativen gibt es?
4. **Zusätzlicher Kontext:** Screenshots, Mockups, etc.

## 📋 Pull Request Checklist

Bevor du einen PR öffnest:

- [ ] Code läuft lokal ohne Fehler
- [ ] `npm run qa` läuft durch
- [ ] `npm run dev` läuft lokal
- [ ] Dokumentation aktualisiert (falls nötig)
- [ ] Commit Messages folgen Convention
- [ ] Branch ist aktuell mit `main`
- [ ] PR-Beschreibung ist aussagekräftig

## 🎯 Code Review Process

1. **Automatische Checks:** ESLint, Prettier, Stylelint, Struktur-Gate
2. **Manual Review:** Code-Qualität, Best Practices
3. **Testing:** Funktionalität testen
4. **Merge:** Nach Approval

## 📖 Ressourcen

### Dokumentation

- [Projekt-Dokumentation](docs/DOCUMENTATION.md)
- [Styles Workflow](content/styles/README.md)

### Externe Ressourcen

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler Docs](https://developers.cloudflare.com/workers/wrangler/)
- [CSS Nesting Spec](https://www.w3.org/TR/css-nesting-1/)
- [Three.js Docs](https://threejs.org/docs/)

## 🤝 Community

### Fragen?

- GitHub Issues für Bugs & Features
- GitHub Discussions für Fragen

### Code of Conduct

- Sei respektvoll
- Sei konstruktiv
- Sei hilfsbereit
- Keine Diskriminierung

## 📄 Lizenz

Durch deine Beiträge stimmst du zu, dass deine Arbeit unter der gleichen Lizenz wie das Projekt lizenziert wird (MIT).

---

**Vielen Dank für deine Beiträge!** 🙏
