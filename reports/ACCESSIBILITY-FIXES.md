# Accessibility Audit - Lighthouse Issues

## Aktueller Status: 89/100 (Gesunken von 94/100)

### Identifizierte Probleme

#### 1. ❌ ARIA Prohibited Attribute (SERIOUS)
**Element**: `<section id="about">` 
**Fehler**: `aria-labelledby` ohne `role` Attribut
**Fix**: `role="region"` hinzugefügt ✅

```html
<!-- VORHER (Fehler) -->
<section id="about" aria-labelledby="about-heading">

<!-- NACHHER (Korrigiert) -->
<section id="about" role="region" aria-labelledby="about-heading">
```

**Impact**: WCAG 2.1 Level A Verstoß (4.1.2 Name, Role, Value)

---

#### 2. ⚠️ Heading Order Invalid (MODERATE)
**Element**: `<h3 class="card-title">` in Feature-Karten
**Fehler**: H3 ohne vorheriges H2 im DOM
**Root Cause**: Lazy-loaded Templates - H2 existiert in `/pages/card/karten.html` aber nicht im initialen HTML

**Lighthouse scannt statisches HTML**:
```html
<!-- Initial DOM (was Lighthouse sieht) -->
<h1>Hero Heading</h1>
<h3>Card Title</h3> ❌ Skipped H2
```

**Nach Template-Load (was User sieht)**:
```html
<h1>Hero Heading</h1>
<h2>Section Title</h2> ✅ Correct hierarchy
<h3>Card Title</h3>
```

**Mögliche Lösungen**:
1. **H2 im Hero-Bereich hinzufügen** (Empfohlen - SEO Boost)
2. **Templates eager laden** (Kontra - Performance)
3. **H3 → H2 ändern** (Kontra - Semantik falsch)

---

#### 3. ⚠️ Touch Targets Size/Spacing (MODERATE)
**Fehler**: Touch-Elemente <48x48px oder <8px Abstand
**Betroffene Elemente**: Zu prüfen

```bash
# Details abrufen:
node -e "const d=require('./reports/lighthouse/lighthouse-mobile-2025-10-04.json'); console.log(JSON.stringify(d.audits['tap-targets'].details,null,2));"
```

---

#### 4. ⚠️ Mismatched Accessible Names (MODERATE)
**Fehler**: Visueller Text ≠ Accessible Name
**Details**: TBD

---

### Empfohlene Fixes (Priorisiert)

#### HIGH Priority - Sofort
1. ✅ **ARIA Role für About Section** - DONE
2. 🔄 **H2 im Hero-Bereich hinzufügen**
   ```html
   <section class="hero">
     <h1>Haupttitel</h1>
     <h2>Untertitel / Tagline</h2> <!-- NEU -->
   </section>
   ```

#### MEDIUM Priority - Nächste Session
3. **Touch Target Größen anpassen**
   - Minimum: 48x48px (WCAG 2.1 Level AAA)
   - Empfohlen: 56x56px (Material Design)
   - Spacing: 8px minimum

4. **Accessible Name Mismatch beheben**
   - Labels konsistent zu visuellen Texten

---

### Testing-Workflow

#### Vorher (Baseline)
```bash
npm run lighthouse:mobile
# Accessibility: 89/100
```

#### Nach Fix
```bash
npm run lighthouse:mobile
# Erwartet: 95-100/100
```

#### Manual Testing
```bash
# 1. Keyboard Navigation
Tab durch alle interaktiven Elemente

# 2. Screen Reader (VoiceOver macOS)
Cmd+F5 → Navigate with VO+Arrow Keys

# 3. Axe DevTools
npm install -g axe-core
```

---

### Performance vs Accessibility Trade-offs

#### Lazy Loading vs SEO/A11y
**Problem**: Lighthouse scannt initial DOM ohne lazy content
**Current Strategy**: Performance First (IntersectionObserver)
**Impact**: Heading hierarchy warning

**Options**:
1. **Eager Load First H2** (0.1s FCP impact, +SEO)
2. **SSR für kritische Headings** (komplexer Build)
3. **Accept Warning** (nur Lighthouse, real users OK)

**Empfehlung**: Option 1 - H2 im Hero statisch, Rest lazy

---

### WCAG 2.1 Konformität

#### Level A (Minimum)
- ✅ 1.3.1 Info and Relationships (nach ARIA Role Fix)
- ✅ 2.1.1 Keyboard Access (Skip-Links)
- ⚠️ 4.1.2 Name, Role, Value (1 Fehler behoben, Rest OK)

#### Level AA (Target)
- ✅ 1.4.3 Contrast Minimum (alle Texte)
- ⚠️ 2.5.5 Target Size (Touch targets zu klein)
- ✅ 4.1.3 Status Messages (Console messages OK)

#### Level AAA (Optional)
- ⚠️ 2.5.5 Target Size Enhanced (48x48px minimum)

---

### Next Steps

1. **Sofort** (5 min):
   - H2 in Hero-Section einfügen
   - Re-run Lighthouse

2. **Kurzfristig** (30 min):
   - Touch Target Sizes audit
   - Button/Link Spacing anpassen

3. **Testing** (15 min):
   - Manual keyboard navigation
   - VoiceOver test
   - Axe DevTools scan

**Erwartete Score-Verbesserung**: 89 → 98-100/100
