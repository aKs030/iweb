# Hero/Home Funktionen Migration

## Überblick

Die Hero- und Home-spezifischen Funktionen wurden erfolgreich aus der `enhanced-animation-engine.js` in das `/pages/home/` Verzeichnis verschoben, um eine bessere Modularität und Trennung der Verantwortlichkeiten zu erreichen.

## Durchgeführte Änderungen

### 1. Neue Datei: `/pages/home/hero-animations.js`

Eine neue Datei wurde erstellt, die alle Hero-spezifischen Animation-Funktionen enthält:

- **Hero-spezifische Aliases**: Der `'greeting'` -> `'fadeInUp'` Alias wurde aus der Enhanced Animation Engine hierher verschoben
- **Animation Engine Erweiterung**: Funktion zum Erweitern der globalen Animation Engine mit Hero-spezifischen Aliases
- **Hero-Animation-Konfiguration**: Spezielle Konfigurationen für Hero-Animationen (Threshold, Durationen, etc.)
- **Helper-Funktionen**: 
  - `animateGreeting()` - Animiert Grußtext mit spezifischen Einstellungen
  - `animateHeroButtons()` - Animiert Hero-Buttons mit gestaffelten Delays
  - `initHeroAnimations()` - Initialisiert die Hero-spezifischen Animationen

### 2. Geänderte Datei: `/content/webentwicklung/animations/enhanced-animation-engine.js`

- **Entfernt**: Der Hero-spezifische `'greeting'` Alias wurde aus der allgemeinen aliasMap entfernt
- **Bereinigt**: Die Animation Engine ist jetzt allgemeiner und nicht mehr Hero-spezifisch

### 3. Geänderte Datei: `/pages/home/hero-manager.js`

- **Import hinzugefügt**: `import { initHeroAnimations } from './hero-animations.js'`
- **Funktion umbenannt**: `initHeroAnimations()` -> `initHeroAnimationBootstrap()` um Namenskonflikte zu vermeiden
- **Erweiterung**: Aufruf der neuen `initHeroAnimations()` Funktion aus der hero-animations.js

## Architektur-Vorteile

1. **Bessere Modularität**: Hero-spezifische Animation-Logik ist jetzt in einem eigenen Modul gekapselt
2. **Klarere Trennung**: Die Enhanced Animation Engine bleibt allgemein und wiederverwendbar
3. **Einfachere Wartung**: Hero-spezifische Änderungen können isoliert vorgenommen werden
4. **Erweiterbarkeit**: Neue Hero-Animationen können einfach zur hero-animations.js hinzugefügt werden

## Verwendung

Die Hero-Animationen werden automatisch über den Hero-Manager initialisiert. Entwickler können:

```javascript
// Hero-spezifische Animation direkt triggern
import { animateGreeting, animateHeroButtons } from './pages/home/hero-animations.js';

// Grußtext animieren
const greetingEl = document.getElementById('greetingText');
animateGreeting(greetingEl);

// Hero-Buttons animieren
const heroContainer = document.getElementById('hero');
animateHeroButtons(heroContainer);
```

## Rückwärtskompatibilität

Alle bestehenden Hero-Animationen funktionieren weiterhin ohne Änderungen, da die neue hero-animations.js die Enhanced Animation Engine transparent erweitert.