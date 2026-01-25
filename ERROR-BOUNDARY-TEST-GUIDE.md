# 🧪 Error Boundary Test Guide

## 🚀 Quick Start

Der Development-Server läuft bereits! Öffne im Browser:

```
http://localhost:8080/test-error-boundary.html
```

---

## 📋 Test-Szenarien

### Test 1: ✅ Normaler Betrieb

- **Was:** Komponente ohne Fehler
- **Erwartet:** Normale Anzeige
- **Zweck:** Baseline-Test

### Test 2: ❌ Render-Fehler

- **Was:** Fehler beim Rendern der Komponente
- **Erwartet:** Error Boundary fängt Fehler ab und zeigt Fallback-UI
- **Aktion:** Klicke "Fehler auslösen"
- **Features:**
  - Retry-Button (lädt Komponente neu)
  - Reload-Button (lädt Seite neu)
  - Error-Details (in Development)

### Test 3: ⚠️ Event-Handler-Fehler

- **Was:** Fehler in Event-Handler
- **Erwartet:** Error Boundary fängt NICHT ab (by design)
- **Warum:** React Error Boundaries fangen nur Rendering-Fehler
- **Lösung:** Verwende try-catch in Event-Handlern

### Test 4: 🎨 Custom Fallback UI

- **Was:** Benutzerdefiniertes Fallback-UI
- **Erwartet:** Custom Error-Anzeige statt Standard-UI
- **Aktion:** Klicke "Fehler auslösen"

### Test 5: 🔀 Verschachtelte Error Boundaries

- **Was:** Mehrere Error Boundaries isolieren Fehler
- **Erwartet:**
  - Child A: Funktioniert normal
  - Child B: Zeigt Fehler (isoliert)
  - Child C: Funktioniert normal
- **Zweck:** Zeigt, dass Fehler isoliert werden

---

## 🔍 Was zu beachten ist

### Browser-Konsole öffnen

```
Chrome/Edge: F12 oder Cmd+Option+I (Mac)
Firefox: F12 oder Cmd+Option+K (Mac)
Safari: Cmd+Option+C (Mac)
```

### Erwartete Logs

```javascript
✅ Error Boundary Tests geladen
Öffne die Browser-Konsole für detaillierte Logs

// Bei Fehler:
[ErrorHandler] [Component] Component Render: Absichtlicher Render-Fehler
[ErrorBoundary] Error caught in Test2
```

---

## 📊 Error Boundary Features

### Standard-Features

- ✅ Fängt Rendering-Fehler ab
- ✅ Zeigt Fallback-UI
- ✅ Retry-Funktionalität
- ✅ Reload-Funktionalität
- ✅ Error-Details (Development)
- ✅ Error-Count (bei wiederholten Fehlern)

### Nicht gefangen

- ❌ Event-Handler-Fehler
- ❌ Async-Code (setTimeout, Promises)
- ❌ Server-Side Rendering
- ❌ Fehler in Error Boundary selbst

---

## 💡 Code-Beispiele

### Einfache Verwendung

```javascript
import ErrorBoundary from '/content/components/ErrorBoundary.js';

<ErrorBoundary component="MyApp">
  <MyComponent />
</ErrorBoundary>;
```

### Mit Custom Fallback

```javascript
<ErrorBoundary component="MyApp" fallback={<div>Custom Error UI</div>}>
  <MyComponent />
</ErrorBoundary>
```

### Mit Error-Handler

```javascript
<ErrorBoundary
  component="MyApp"
  onError={(error, errorInfo) => {
    console.log('Error caught:', error);
    // Send to analytics
  }}
  onReset={() => {
    console.log('Error boundary reset');
  }}
>
  <MyComponent />
</ErrorBoundary>
```

### Mit Custom Fallback Component

```javascript
function CustomFallback({ error, onReset, onReload }) {
  return (
    <div>
      <h1>Fehler: {error.message}</h1>
      <button onClick={onReset}>Retry</button>
      <button onClick={onReload}>Reload</button>
    </div>
  );
}

<ErrorBoundary component="MyApp" fallbackComponent={CustomFallback}>
  <MyComponent />
</ErrorBoundary>;
```

### Verschachtelte Error Boundaries

```javascript
<ErrorBoundary component="App">
  <Header />
  <ErrorBoundary component="MainContent">
    <MainContent />
  </ErrorBoundary>
  <ErrorBoundary component="Sidebar">
    <Sidebar />
  </ErrorBoundary>
  <Footer />
</ErrorBoundary>
```

---

## 🎯 Best Practices

### 1. Strategische Platzierung

```javascript
// ✅ Gut: Mehrere Error Boundaries
<ErrorBoundary component="App">
  <Header />
  <ErrorBoundary component="Content">
    <Content />
  </ErrorBoundary>
  <Footer />
</ErrorBoundary>

// ❌ Schlecht: Nur eine Error Boundary
<ErrorBoundary component="App">
  <Header />
  <Content />
  <Footer />
</ErrorBoundary>
```

### 2. Error-Handling in Event-Handlern

```javascript
// Event-Handler-Fehler werden NICHT gefangen
function MyComponent() {
  const handleClick = () => {
    try {
      riskyOperation();
    } catch (error) {
      handleError(error, {
        component: 'MyComponent',
        action: 'handleClick',
      });
    }
  };

  return <button onClick={handleClick}>Click</button>;
}
```

### 3. Async-Fehler

```javascript
// Async-Fehler werden NICHT gefangen
function MyComponent() {
  React.useEffect(() => {
    fetchData().catch((error) => {
      handleError(error, {
        component: 'MyComponent',
        action: 'fetchData',
      });
    });
  }, []);
}
```

---

## 🐛 Troubleshooting

### Fehler wird nicht gefangen

**Problem:** Error Boundary fängt Fehler nicht ab

**Mögliche Ursachen:**

1. Fehler in Event-Handler → Verwende try-catch
2. Fehler in async Code → Verwende .catch()
3. Fehler in Error Boundary selbst → Prüfe Error Boundary Code

### Fallback-UI wird nicht angezeigt

**Problem:** Standard-UI statt Fallback

**Lösung:**

```javascript
// Prüfe, ob Error Boundary korrekt importiert ist
import ErrorBoundary from '/content/components/ErrorBoundary.js';

// Prüfe, ob CSS geladen ist
<link rel="stylesheet" href="/content/components/ErrorBoundary.css">
```

### Retry funktioniert nicht

**Problem:** Retry-Button lädt Komponente nicht neu

**Lösung:**

```javascript
// Verwende onReset Callback
<ErrorBoundary
  component="MyApp"
  onReset={() => {
    // Reset state
    setState(initialState);
  }}
>
  <MyComponent />
</ErrorBoundary>
```

---

## 📚 Weitere Ressourcen

- **Vollständige Dokumentation:** `ERROR-HANDLING-GUIDE.md`
- **Quick Reference:** `ERROR-HANDLING-SUMMARY.md`
- **React Docs:** [Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)

---

## ✅ Checkliste

### Vor dem Test

- [ ] Dev-Server läuft (`npm run dev`)
- [ ] Browser-Konsole geöffnet
- [ ] Test-Seite geladen (`/test-error-boundary.html`)

### Während des Tests

- [ ] Test 1: Normale Anzeige funktioniert
- [ ] Test 2: Fehler wird gefangen und Fallback angezeigt
- [ ] Test 2: Retry-Button funktioniert
- [ ] Test 3: Event-Handler-Fehler wird NICHT gefangen
- [ ] Test 4: Custom Fallback wird angezeigt
- [ ] Test 5: Fehler sind isoliert

### Nach dem Test

- [ ] Alle Tests bestanden
- [ ] Logs in Konsole geprüft
- [ ] Error-Handling verstanden

---

**Viel Erfolg beim Testen! 🚀**
