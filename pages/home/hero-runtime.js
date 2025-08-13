// Hero Runtime: Visibility Observer + Overscroll Guard
// Export: initHeroRuntime(heroElement?)

export function initHeroRuntime(){
  const hero = document.getElementById('hero');
  if(!hero) return;
  attachVisibilityObserver(hero);
  attachOverscrollGuard();
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
  const subtitle = () => document.querySelector('.hero-subtitle');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if(e.target!==hero) return;
      const active = e.intersectionRatio >= cfg.minActiveRatio;
      document.body.classList.toggle('hero-active', active);
      const st = subtitle();
      if(st) st.classList.toggle('hero-subtitle--fixed', active);
    });
  }, { threshold: cfg.threshold });
  obs.observe(hero);
}

function attachOverscrollGuard(){
  if(window.__overscrollGuardAttached) return;
  window.__overscrollGuardAttached = true;
  const getY = () => scrollY || document.documentElement.scrollTop || 0;
  const bounds = () => {
    const s=[...document.querySelectorAll('.section')];
    let f=s[0]||document.querySelector('#hero')||document.body;
    let l=s[s.length-1]||document.querySelector('footer')||document.body;
  const rf=document.querySelector('footer');
  if(rf) l=rf;
  return { f,l };
  };
  const atTop = () => getY() <= Math.max(0,(bounds().f?.offsetTop||0))+1;
  const atBottom = () => { const { l }=bounds(); const top=l?.offsetTop||0; const bottom=top+(l?.offsetHeight||0); return getY()+innerHeight >= bottom-1; };
  addEventListener('wheel', e=>{ const dy=e.deltaY; if((dy<0 && atTop())||(dy>0 && atBottom())) e.preventDefault(); }, { passive:false });
  let startY=0;
  addEventListener('touchstart', e=>{ startY=e.touches[0].clientY; }, { passive:true });
  addEventListener('touchmove', e=>{ const y=e.touches[0].clientY; if(((y>startY)&&atTop())||((y<startY)&&atBottom())) e.preventDefault(); }, { passive:false });
}

function forceHeroButtonsAnimation(hero){
  try {
    if(!window.AnimationSystem) return;
    const rect = hero.getBoundingClientRect();
    if(rect.top < innerHeight && rect.bottom > 0){
      hero.querySelectorAll('.hero-buttons [data-animation].animate-element:not(.is-visible)')
        .forEach(el => {
          if(typeof window.AnimationSystem.replay === 'function') window.AnimationSystem.replay(el);
          else el.classList.add('is-visible');
        });
    }
  } catch {}
}

// UMD Fallback
if(typeof window !== 'undefined') window.__initHeroRuntime = initHeroRuntime;
