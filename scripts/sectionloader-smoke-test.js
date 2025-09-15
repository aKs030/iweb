/*
 * SectionLoader Smoke Test
 * Lauscht auf CustomEvents und loggt strukturierte Ausgaben.
 * Nutzung: In Test-HTML einbinden NACH main.js.
 */
(function(){
  const EVENTS = [
    'section:will-load',
    'section:prefetched',
    'section:loaded',
    'section:error'
  ];
  function ts(){ return new Date().toISOString(); }
  EVENTS.forEach(evt => {
    document.addEventListener(evt, e => {
      const { id, url, state } = e.detail || {};
      // Konsistentes Format für spätere Auswertung (grep / JSON Parse Light)
  console.warn(`[SectionLoader][${evt}]`, JSON.stringify({ t: ts(), id, url, state }));
    });
  });

  // Optional: Automatischer künstlicher Error-Test (auskommentiert lassen, nur bei Bedarf aktivieren)
  // setTimeout(() => {
  //   const fake = document.createElement('section');
  //   fake.id = 'fake-error';
  //   fake.setAttribute('data-section-src', '/__does_not_exist.html');
  //   document.body.append(fake);
  //   window.SectionLoader.loadInto(fake);
  // }, 3000);
})();
