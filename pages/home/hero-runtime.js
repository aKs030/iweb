// Hero Runtime: Visibility Observer + Overscroll Guard
// Export: initHeroRuntime(heroElement?)

export function initHeroRuntime(){
  const hero = document.getElementById('hero');
  if(!hero) return;
  attachVisibilityObserver(hero);
  forceHeroButtonsAnimation(hero);
}

function attachVisibilityObserver(hero){
  if(document.body.__heroObserverAttached) return;
  let cfg = { threshold:[0,0.25,0.5,0.75,1], minActiveRatio:0.5 };
  // hero-data kann optional Observer-Config liefern (dynamisch)
  import('./hero-data.js')
    .then(mod=>{
      if(mod?.heroObserverConfig){
        cfg = { ...cfg, ...mod.heroObserverConfig };
      }
      createObserver(hero, cfg);
    })
    .catch(()=> createObserver(hero, cfg));
  document.body.__heroObserverAttached = true;
}

function createObserver(hero, cfg){
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if(e.target!==hero) return;
      const active = e.intersectionRatio >= cfg.minActiveRatio;
      document.body.classList.toggle('hero-active', active);
      // hero-subtitle bleibt immer fixed; kein Toggle mehr
    });
  }, { threshold: cfg.threshold });
  obs.observe(hero);
}


function forceHeroButtonsAnimation(hero){
  try {
    if(!window.AnimationSystem) return;
    const rect = hero.getBoundingClientRect();
    if(rect.top < innerHeight && rect.bottom > 0){
      hero.querySelectorAll('.hero-buttons [data-animation].animate-element:not(.is-visible)')
        .forEach(el => {
          // Replay entfernt: direkte Sichtbarkeit setzen
          el.classList.add('is-visible');
        });
    }
  } catch {}
}

// UMD Fallback
if(typeof window !== 'undefined') window.__initHeroRuntime = initHeroRuntime;
