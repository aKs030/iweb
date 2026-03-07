# Config-Dateien Migration

**Datum**: 2026-03-07
**Status**: Abgeschlossen ✅

## 🎯 Ziel

Root-Ordner aufräumen durch Verschieben von Konfigurationsdateien in `config/` Ordner.

## 📦 Verschobene Dateien

### Config-Dateien → config/

1. `eslint.config.mjs` → `config/eslint.config.mjs`
2. `.prettierrc.json` → `config/.prettierrc.json`
3. `.stylelintrc.cjs` → `config/.stylelintrc.cjs`
4. `.env.example` → `config/.env.example`

### Dokumentation → docs/

5. `CHANGELOG.md` → `docs/CHANGELOG.md`

## 🔗 Symlinks für Editor-Kompatibilität

~~Erstellt im Root (für VS Code, IntelliJ, etc.):~~

~~- `.prettierrc.json` → `config/.prettierrc.json`~~
~~- `.stylelintrc.cjs` → `config/.stylelintrc.cjs`~~
~~- `eslint.config.mjs` → `config/eslint.config.mjs`~~

**UPDATE**: Symlinks entfernt - nicht nötig!

**Grund**: Tools finden Configs via `--config` Flag in package.json Scripts.

## ⚙️ Anpassungen

### package.json Scripts

**Vorher**:

```json
"lint:es": "eslint . --cache"
```

**Nachher**:

```json
"lint:es": "eslint . --cache --config config/eslint.config.mjs"
```

Alle Scripts aktualisiert:

- `lint:es`, `lint:css`, `lint:format`
- `fix:es`, `fix:css`, `fix:format`
- `lint-staged` Konfiguration

### .gitignore

Symlinks hinzugefügt:

```
# Config symlinks (actual files in config/)
/.prettierrc.json
/.stylelintrc.cjs
/eslint.config.mjs
```

### Dokumentation

- `README.md` - Projektstruktur aktualisiert
- `docs/DOCUMENTATION.md` - Projektstruktur aktualisiert
- `docs/DOCUMENTATION.md` - CHANGELOG.md Pfad aktualisiert

## ✅ Validierung

```bash
npm run qa              # ✅ Passed
npm run lint            # ✅ Passed
npm run fix             # ✅ Passed
npm run check:docs      # ✅ OK (39 Markdown-Dateien)
```

## 📊 Ergebnis

**Root-Dateien**:

- Vorher: 38 Dateien
- Nachher: 33 Dateien (-5)
- Symlinks: +3 (für Editor-Kompatibilität)
- Netto: -2 sichtbare Dateien

**Neue Struktur**:

```
/
├── config/
│   ├── eslint.config.mjs
│   ├── .prettierrc.json
│   ├── .stylelintrc.cjs
│   └── .env.example
├── docs/
│   ├── DOCUMENTATION.md
│   └── CHANGELOG.md
├── .prettierrc.json → config/.prettierrc.json (symlink)
├── .stylelintrc.cjs → config/.stylelintrc.cjs (symlink)
└── eslint.config.mjs → config/eslint.config.mjs (symlink)
```

## 🎯 Vorteile

1. **Übersichtlicher Root** - 5 Dateien weniger
2. **Logische Gruppierung** - Alle Configs in einem Ordner
3. **Editor-Kompatibilität** - Symlinks für Tools
4. **CI/CD-sicher** - Alle Tests bestanden
5. **Git-History** - `git mv` erhält History

## 📝 Hinweise

### Für Entwickler

- Configs sind jetzt in `config/`
- Symlinks im Root für Editor-Integration
- Alle npm Scripts funktionieren wie vorher
- `.env.example` ist jetzt in `config/`

### Für CI/CD

- Keine Änderungen nötig
- Scripts verwenden `--config` Flag
- Symlinks werden automatisch aufgelöst

### Für neue Team-Mitglieder

- Configs in `config/` bearbeiten (nicht Symlinks)
- `.env.example` kopieren: `cp config/.env.example .dev.vars`

## 🔄 Rückgängig machen (falls nötig)

```bash
# Dateien zurück verschieben
git mv config/eslint.config.mjs eslint.config.mjs
git mv config/.prettierrc.json .prettierrc.json
git mv config/.stylelintrc.cjs .stylelintrc.cjs
git mv config/.env.example .env.example
git mv docs/CHANGELOG.md CHANGELOG.md

# Symlinks löschen
rm .prettierrc.json .stylelintrc.cjs eslint.config.mjs

# package.json Scripts zurücksetzen
# (--config Flags entfernen)
```

---

**Erstellt**: 2026-03-07
**Autor**: Kiro AI Assistant
**Status**: Abgeschlossen ✅
