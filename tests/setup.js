// MatchMedia Mock mit erweiterter Funktionalität
(() => {
  // Speichert aktuelle Queries und deren Zustände
  const mediaQueryList = new Map();

  // Standard-Breakpoints für gängige Bildschirmgrößen
  const defaultBreakpoints = {
    'xs': '(max-width: 575px)',
    'sm': '(min-width: 576px) and (max-width: 767px)',
    'md': '(min-width: 768px) and (max-width: 991px)',
    'lg': '(min-width: 992px) and (max-width: 1199px)',
    'xl': '(min-width: 1200px)'
  };

  // Hilfsfunktion zur Simulation der Match-Bedingung
  const evaluateMediaQuery = (query) => {
    // Hier könnte eine komplexere Logik implementiert werden
    // Aktuell simuliert es basierend auf der Fenstergröße
    const width = window.innerWidth;
    
    // Einfache Regex-basierte Auswertung für min/max-width
    const minWidthMatch = query.match(/\(min-width:\s*(\d+)px\)/);
    const maxWidthMatch = query.match(/\(max-width:\s*(\d+)px\)/);
    
    let matches = true;
    
    if (minWidthMatch && width < parseInt(minWidthMatch[1])) {
      matches = false;
    }
    if (maxWidthMatch && width > parseInt(maxWidthMatch[1])) {
      matches = false;
    }
    
    return matches;
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query) => {
      // Erstelle oder hole bestehendes MediaQueryList-Objekt
      if (!mediaQueryList.has(query)) {
        const mql = {
          matches: evaluateMediaQuery(query),
          media: query,
          onchange: null,
          listeners: new Set(),
          
          addListener: (callback) => {
            if (typeof callback === 'function') {
              mql.listeners.add(callback);
            }
          },
          
          removeListener: (callback) => {
            mql.listeners.delete(callback);
          },
          
          addEventListener: (type, callback) => {
            if (type === 'change' && typeof callback === 'function') {
              mql.listeners.add(callback);
            }
          },
          
          removeEventListener: (type, callback) => {
            if (type === 'change') {
              mql.listeners.delete(callback);
            }
          },
          
          dispatchEvent: (event) => {
            if (event.type === 'change') {
              mql.matches = evaluateMediaQuery(query);
              mql.listeners.forEach(callback => {
                try {
                  callback.call(mql, { ...event, matches: mql.matches });
                } catch (e) {
                  console.error('Error in media query listener:', e);
                }
              });
              if (typeof mql.onchange === 'function') {
                mql.onchange({ ...event, matches: mql.matches });
              }
              return true;
            }
            return false;
          }
        };
        
        mediaQueryList.set(query, mql);
      }
      
      return mediaQueryList.get(query);
    }
  });

  // Simuliere Media-Query-Änderungen bei Fenstergrößenänderung
  window.addEventListener('resize', () => {
    mediaQueryList.forEach((mql, query) => {
      const newMatches = evaluateMediaQuery(query);
      if (newMatches !== mql.matches) {
        mql.dispatchEvent(new Event('change'));
      }
    });
  });

  // Exponiere Utility-Methode für Breakpoint-Tests
  window.matchMedia.testBreakpoint = (breakpoint) => {
    const query = defaultBreakpoints[breakpoint] || breakpoint;
    return window.matchMedia(query).matches;
  };
})();

// RequestAnimationFrame Polyfill mit präziserer Zeitsteuerung
(() => {
  let lastTime = 0;
  const vendors = ['ms', 'moz', 'webkit', 'o'];
  
  // Suche nach nativer Implementierung
  for (let x = 0; x < vendors.length && !globalThis.requestAnimationFrame; ++x) {
    globalThis.requestAnimationFrame = globalThis[`${vendors[x]}RequestAnimationFrame`];
    globalThis.cancelAnimationFrame = globalThis[`${vendors[x]}CancelAnimationFrame`] || 
                                     globalThis[`${vendors[x]}CancelRequestAnimationFrame`];
  }

  // Fallback-Implementierung
  if (!globalThis.requestAnimationFrame) {
    globalThis.requestAnimationFrame = (callback) => {
      const currTime = performance.now();
      const timeToCall = Math.max(0, 16.67 - (currTime - lastTime)); // Ziel: 60fps (~16.67ms)
      const id = setTimeout(() => {
        callback(currTime + timeToCall);
      }, timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    };
  }

  if (!globalThis.cancelAnimationFrame) {
    globalThis.cancelAnimationFrame = (id) => {
      clearTimeout(id);
    };
  }
})();