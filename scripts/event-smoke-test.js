// Kleiner manueller Smoke Test für Custom Events
// Nutzung: <script type="module" src="/scripts/event-smoke-test.js"></script> temporär in index.html einfügen
import { EVENTS, fire, on } from '../content/webentwicklung/utils/events.js';

const logWarn = (...a) => console.warn('[events-smoke]', ...a);

const unsub = [];
function listen(e){
  unsub.push(on(e, evt => logWarn('empfangen', e, evt.detail)));
}

[EVENTS.HERO_LOADED,
  EVENTS.HERO_TYPING_END,
  EVENTS.FEATURES_TEMPLATES_LOADED,
  EVENTS.FEATURES_TEMPLATES_ERROR,
  EVENTS.TEMPLATE_MOUNTED,
  EVENTS.FEATURES_CHANGE,
  EVENTS.SNAP_SECTION_CHANGE].forEach(listen);

// künstliche Dispatches
setTimeout(() => {
  fire(EVENTS.HERO_LOADED, { test: true });
  fire(EVENTS.FEATURES_CHANGE, { index: 1, total: 5 });
  fire(EVENTS.FEATURES_TEMPLATES_ERROR, { error: 'Demo' });
}, 1500);

// Cleanup nach 15s
setTimeout(() => { unsub.forEach(fn => fn()); logWarn('Listeners entfernt'); }, 15000);
