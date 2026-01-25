# 🛡️ Error Handling & Production Logging Guide

**Erstellt:** 25. Januar 2026  
**Version:** 1.0.0

---

## 📋 Übersicht

Dieses Projekt verwendet jetzt ein professionelles Error-Handling-System mit:

1. ✅ **Zentralisiertes Error-Handling** - Konsistente Fehlerbehandlung
2. ✅ **React Error Boundaries** - Fehler in React-Komponenten abfangen
3. ✅ **Production-Safe Logging** - Keine console-Statements in Production
4. ✅ **Error Reporting** - Automatisches Reporting zu Analytics

---

## 🎯 Neue Utilities

### 1. Error Handler (`content/utils/error-handler.js`)

Zentralisiertes Error-Handling mit Kategorisierung und Reporting.

#### Features

- ✅ Error-Kategorisierung (Network, Render, Storage, etc.)
- ✅ Severity-Levels (Low, Medium, High, Critical)
- ✅ Automatisches Logging
- ✅ Analytics-Integration
- ✅ Error-Statistiken

#### Verwendung

```javascript
import {
  handleError,
  handleNetworkError,
  handleStorageError,
  handleRenderError,
  ErrorSeverity,
  ErrorCategory,
  safeAsync,
  safeSync,
} from '/content/utils/error-handler.js';

// Einfaches Error-Handling
try {
  riskyOperation();
} catch (error) {
  handleError(error, {
    component: 'MyComponent',
    action: 'riskyOperation',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.UNKNOWN,
  });
}

// Network-Fehler
try {
  const response = await fetch('/api/data');
} catch (error) {
  handleNetworkError(error, {
    component: 'DataFetcher',
    action: 'fetchData',
  });
}

// Storage-Fehler
try {
  localStorage.setItem('key', 'value');
} catch (error) {
  handleStorageError(error, {
    component: 'StorageManager',
    action: 'saveData',
  });
}

// Safe Wrapper für async Funktionen
const safeFetch = safeAsync(
  async (url) => {
    const response = await fetch(url);
    return response.json();
  },
  {
    component: 'API',
    action: 'fetchData',
    fallback: null, // Rückgabewert bei Fehler
  },
);

// Safe Wrapper für sync Funktionen
const safeParseJSON = safeSync((str) => JSON.parse(str), {
  component: 'Parser',
  action: 'parseJSON',
  fallback: {},
});
```

---

### 2. React Error Boundary (`content/components/ErrorBoundary.js`)

React-Komponente zum Abfangen von Rendering-Fehlern.

#### Features

- ✅ Fängt Fehler in Child-Komponenten ab
- ✅ Zeigt Fallback-UI
- ✅ Retry-Funktionalität
- ✅ Error-Reporting
- ✅ Anpassbare Fallbacks

#### Verwendung

```javascript
import ErrorBoundary, {
  withErrorBoundary,
} from '/content/components/ErrorBoundary.js';

// Als Wrapper-Komponente
function App() {
  return (
    <ErrorBoundary
      component="App"
      onError={(error, errorInfo) => {
        console.log('Error caught:', error);
      }}
      onReset={() => {
        console.log('Error boundary reset');
      }}
    >
      <MyComponent />
    </ErrorBoundary>
  );
}

// Mit Custom Fallback
function App() {
  return (
    <ErrorBoundary component="App" fallback={<div>Custom Error UI</div>}>
      <MyComponent />
    </ErrorBoundary>
  );
}

// Mit Custom Fallback Component
function CustomFallback({ error, onReset, onReload }) {
  return (
    <div>
      <h1>Fehler: {error.message}</h1>
      <button onClick={onReset}>Retry</button>
      <button onClick={onReload}>Reload</button>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary component="App" fallbackComponent={CustomFallback}>
      <MyComponent />
    </ErrorBoundary>
  );
}

// Als Higher-Order Component
const SafeComponent = withErrorBoundary(MyComponent, {
  component: 'MyComponent',
  showDetails: true, // Zeige Error-Details in Development
});

// Mehrere Error Boundaries
function App() {
  return (
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
  );
}
```

---

### 3. Production Logger (`content/utils/production-logger.js`)

Sicheres Logging, das Production-Umgebung respektiert.

#### Features

- ✅ Automatische Environment-Erkennung
- ✅ Nur Errors in Production
- ✅ Alle Logs in Development
- ✅ Debug-Mode für Production
- ✅ Timestamp-Präfix

#### Verwendung

```javascript
import {
  createProductionLogger,
  logger,
  safeConsole,
  env,
} from '/content/utils/production-logger.js';

// Default Logger
logger.log('This only logs in development');
logger.warn('This only logs in development');
logger.error('This ALWAYS logs'); // Errors immer loggen

// Custom Logger mit Prefix
const log = createProductionLogger('MyComponent');
log.log('Component initialized');
log.error('Component failed');

// Safe Console (Drop-in Replacement)
safeConsole.log('Safe logging');
safeConsole.warn('Safe warning');
safeConsole.error('Safe error');

// Environment Checks
if (env.isDevelopment) {
  console.log('Development mode');
}

if (env.isProduction) {
  console.log('Production mode');
}

if (env.isDebug()) {
  console.log('Debug mode enabled');
}

// Debug Mode aktivieren (in Production)
// URL: ?debug=true
// oder localStorage.setItem('debug', 'true')
```

---

## 🔄 Migration Guide

### Schritt 1: Console-Statements ersetzen

**Vorher:**

```javascript
console.log('User logged in');
console.warn('API slow');
console.error('API failed');
```

**Nachher:**

```javascript
import { createProductionLogger } from '/content/utils/production-logger.js';

const log = createProductionLogger('Auth');

log.log('User logged in');
log.warn('API slow');
log.error('API failed');
```

---

### Schritt 2: Leere catch-Blöcke ersetzen

**Vorher:**

```javascript
try {
  riskyOperation();
} catch (error) {
  // Ignore
}
```

**Nachher:**

```javascript
import { handleError, ErrorSeverity } from '/content/utils/error-handler.js';

try {
  riskyOperation();
} catch (error) {
  handleError(error, {
    component: 'MyComponent',
    action: 'riskyOperation',
    severity: ErrorSeverity.LOW,
    recoverable: true,
  });
}
```

---

### Schritt 3: React-Komponenten mit Error Boundary wrappen

**Vorher:**

```javascript
function App() {
  return (
    <div>
      <MyComponent />
    </div>
  );
}
```

**Nachher:**

```javascript
import ErrorBoundary from '/content/components/ErrorBoundary.js';

function App() {
  return (
    <ErrorBoundary component="App">
      <div>
        <MyComponent />
      </div>
    </ErrorBoundary>
  );
}
```

---

## 📊 Error-Kategorien

### ErrorCategory

| Kategorie    | Beschreibung                | Beispiel              |
| ------------ | --------------------------- | --------------------- |
| `NETWORK`    | Netzwerk-Fehler             | fetch failed, timeout |
| `RENDER`     | React Rendering-Fehler      | Component crash       |
| `STORAGE`    | LocalStorage/SessionStorage | QuotaExceeded         |
| `VALIDATION` | Validierungs-Fehler         | Invalid input         |
| `PERMISSION` | Permissions-Fehler          | Geolocation denied    |
| `UNKNOWN`    | Unbekannte Fehler           | Unexpected error      |

### ErrorSeverity

| Severity   | Beschreibung   | Logging          | Reporting |
| ---------- | -------------- | ---------------- | --------- |
| `LOW`      | Nicht-kritisch | Development only | Nein      |
| `MEDIUM`   | Wichtig        | Development only | Nein      |
| `HIGH`     | Kritisch       | Immer            | Ja        |
| `CRITICAL` | Sehr kritisch  | Immer            | Ja        |

---

## 🎯 Best Practices

### 1. Immer Error-Context angeben

```javascript
// ❌ Schlecht
handleError(error);

// ✅ Gut
handleError(error, {
  component: 'UserProfile',
  action: 'loadUserData',
  severity: ErrorSeverity.HIGH,
  category: ErrorCategory.NETWORK,
  metadata: {
    userId: user.id,
    endpoint: '/api/user',
  },
});
```

### 2. Passende Severity wählen

```javascript
// LOW: Nicht-kritische Fehler
handleStorageError(error, {
  severity: ErrorSeverity.LOW,
  component: 'Cache',
  action: 'saveCache',
});

// MEDIUM: Wichtige Fehler
handleNetworkError(error, {
  severity: ErrorSeverity.MEDIUM,
  component: 'API',
  action: 'fetchData',
});

// HIGH: Kritische Fehler
handleRenderError(error, {
  severity: ErrorSeverity.HIGH,
  component: 'App',
  action: 'render',
});

// CRITICAL: App-breaking Fehler
handleError(error, {
  severity: ErrorSeverity.CRITICAL,
  component: 'Core',
  action: 'initialize',
});
```

### 3. Safe Wrappers verwenden

```javascript
// Async Funktionen
const safeFetchUser = safeAsync(
  async (userId) => {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  },
  {
    component: 'UserService',
    action: 'fetchUser',
    fallback: null,
  },
);

// Sync Funktionen
const safeParseJSON = safeSync((str) => JSON.parse(str), {
  component: 'Parser',
  action: 'parseJSON',
  fallback: {},
});
```

### 4. Error Boundaries strategisch platzieren

```javascript
// ✅ Gut: Mehrere Error Boundaries
function App() {
  return (
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
  );
}

// ❌ Schlecht: Nur eine Error Boundary
function App() {
  return (
    <ErrorBoundary component="App">
      <Header />
      <MainContent />
      <Sidebar />
      <Footer />
    </ErrorBoundary>
  );
}
```

---

## 🔍 Debugging

### Development Mode

```javascript
// Alle Logs werden angezeigt
logger.log('Debug info');
logger.warn('Warning');
logger.error('Error');
```

### Production Mode

```javascript
// Nur Errors werden angezeigt
logger.log('Not shown');
logger.warn('Not shown');
logger.error('Shown!');
```

### Debug Mode in Production

```javascript
// URL: https://example.com?debug=true
// oder
localStorage.setItem('debug', 'true');

// Jetzt werden alle Logs angezeigt
logger.log('Now shown in production!');
```

### Error-Statistiken abrufen

```javascript
import errorHandler from '/content/utils/error-handler.js';

// Alle Fehler
const errors = errorHandler.getErrors();

// Gefilterte Fehler
const criticalErrors = errorHandler.getErrors({
  severity: ErrorSeverity.CRITICAL,
});

const networkErrors = errorHandler.getErrors({
  category: ErrorCategory.NETWORK,
});

// Statistiken
const stats = errorHandler.getStats();
console.log(stats);
// {
//   total: 10,
//   bySeverity: { low: 2, medium: 5, high: 2, critical: 1 },
//   byCategory: { network: 4, render: 3, storage: 3 },
//   byComponent: { App: 5, API: 3, Storage: 2 }
// }
```

---

## 📚 Beispiele

### Beispiel 1: API-Call mit Error-Handling

```javascript
import {
  handleNetworkError,
  ErrorSeverity,
} from '/content/utils/error-handler.js';
import { createProductionLogger } from '/content/utils/production-logger.js';

const log = createProductionLogger('API');

async function fetchUserData(userId) {
  try {
    log.log(`Fetching user ${userId}`);

    const response = await fetch(`/api/users/${userId}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    log.log('User data fetched successfully');

    return data;
  } catch (error) {
    handleNetworkError(error, {
      component: 'UserService',
      action: 'fetchUserData',
      severity: ErrorSeverity.HIGH,
      metadata: { userId },
    });

    return null;
  }
}
```

### Beispiel 2: React-Komponente mit Error Boundary

```javascript
import React from 'https://esm.sh/react@19.2.3';
import ErrorBoundary from '/content/components/ErrorBoundary.js';
import { createProductionLogger } from '/content/utils/production-logger.js';

const log = createProductionLogger('UserProfile');

function UserProfile({ userId }) {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    fetchUserData(userId)
      .then(setUser)
      .catch((error) => {
        log.error('Failed to load user', error);
      });
  }, [userId]);

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

// Mit Error Boundary wrappen
export default function SafeUserProfile(props) {
  return (
    <ErrorBoundary
      component="UserProfile"
      fallback={<div>Fehler beim Laden des Profils</div>}
    >
      <UserProfile {...props} />
    </ErrorBoundary>
  );
}
```

### Beispiel 3: Storage mit Error-Handling

```javascript
import {
  handleStorageError,
  ErrorSeverity,
} from '/content/utils/error-handler.js';
import { createProductionLogger } from '/content/utils/production-logger.js';

const log = createProductionLogger('Storage');

class SafeStorage {
  static set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      log.log(`Saved ${key} to storage`);
      return true;
    } catch (error) {
      handleStorageError(error, {
        component: 'SafeStorage',
        action: 'set',
        severity: ErrorSeverity.LOW,
        metadata: { key },
      });
      return false;
    }
  }

  static get(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return fallback;

      const parsed = JSON.parse(item);
      log.log(`Retrieved ${key} from storage`);
      return parsed;
    } catch (error) {
      handleStorageError(error, {
        component: 'SafeStorage',
        action: 'get',
        severity: ErrorSeverity.LOW,
        metadata: { key },
      });
      return fallback;
    }
  }

  static remove(key) {
    try {
      localStorage.removeItem(key);
      log.log(`Removed ${key} from storage`);
      return true;
    } catch (error) {
      handleStorageError(error, {
        component: 'SafeStorage',
        action: 'remove',
        severity: ErrorSeverity.LOW,
        metadata: { key },
      });
      return false;
    }
  }
}

export default SafeStorage;
```

---

## ✅ Checkliste

### Setup

- ✅ `error-handler.js` erstellt
- ✅ `ErrorBoundary.js` erstellt
- ✅ `ErrorBoundary.css` erstellt
- ✅ `production-logger.js` erstellt

### Migration

- [ ] Console-Statements ersetzen
- [ ] Leere catch-Blöcke ersetzen
- [ ] React-Komponenten mit Error Boundaries wrappen
- [ ] Error-Handling testen

### Testing

- [ ] Error-Handling in Development testen
- [ ] Error-Handling in Production testen
- [ ] Error Boundaries testen
- [ ] Analytics-Integration testen

---

**Erstellt mit:** Kiro AI  
**Letzte Aktualisierung:** 25. Januar 2026
