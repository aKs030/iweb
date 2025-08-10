"use strict";
// Dynamische Features Sektion Rotation & Steuerung
(function(){
  const SECTION_ID = 'section-features';
  const ALL_TEMPLATE_IDS = [
    'template-features-1',
    'template-features-2',
    'template-features-3',
    'template-features-4',
    'template-features-5'
  ];
  const ROTATION_INTERVAL_MS = 14000;
  let currentIndex = 0;
  let intervalHandle = null;
  let isVisible = false;
  let isAnimating = false;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  let shuffledTemplates = shuffle([...ALL_TEMPLATE_IDS]);

  function applyTemplate(id){
    console.log('FeatureRotation: applyTemplate called with:', id);
    const sectionEl = document.getElementById(SECTION_ID);
    const tpl = document.getElementById(id);
    if(!sectionEl || !tpl || isAnimating) {
      console.error('FeatureRotation: Failed preconditions:', {sectionEl, tpl, isAnimating});
      return;
    }
    isAnimating = true;
    console.log('FeatureRotation: Starting template swap to:', id);

    const previousId = sectionEl.dataset.currentTemplate || null;
    console.log('FeatureRotation: Previous template:', previousId);
    document.dispatchEvent(new CustomEvent('featureTemplateWillChange',{detail:{from:previousId,to:id}}));

    function finalizeEnter(){
      isAnimating = false;
      console.log('FeatureRotation: Template change completed');
      document.dispatchEvent(new CustomEvent('featureTemplateChanged',{detail:{templateId:id,index:currentIndex,from:previousId}}));
      // Sofortiges Event ohne Verzögerung
      document.dispatchEvent(new CustomEvent('sectionContentChanged',{detail:{section:SECTION_ID, template:id}}));
    }

    function doSwap(){
      console.log('FeatureRotation: doSwap - applying template content');
      const frag = document.importNode(tpl.content, true);
      sectionEl.innerHTML = '';
      sectionEl.appendChild(frag);
      sectionEl.dataset.currentTemplate = id;
      
      // Sofortige CSS Transition ohne Verzögerung
      sectionEl.style.opacity = '0';
      sectionEl.style.transform = 'translateY(10px)';
      sectionEl.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      
      // Minimal delay für DOM-Update, dann sofort animieren
      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          sectionEl.style.opacity = '1';
          sectionEl.style.transform = 'translateY(0)';
        });
        
        // Animation beenden nach 400ms (reduziert von 600ms)
        setTimeout(() => {
          finalizeEnter();
        }, 400);
      });
    }

    // Falls noch kein Inhalt -> direkt
    if(!previousId){
      console.log('FeatureRotation: No previous template, applying directly');
      doSwap();
      return;
    }

    // Schnellerer FadeOut der alten Variante
    console.log('FeatureRotation: Fading out old template');
    sectionEl.style.transition = 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    sectionEl.style.opacity = '0';
    sectionEl.style.transform = 'translateY(-5px)';
    
    // Reduzierte Verzögerung von 300ms auf 200ms
    setTimeout(() => {
      doSwap();
    }, 200);
  }

  function nextTemplate(){
    if(isAnimating) return;
    currentIndex = (currentIndex + 1) % shuffledTemplates.length;
    applyTemplate(shuffledTemplates[currentIndex]);
  }

  function randomTemplate(){
    if(isAnimating) return;
    console.log('randomTemplate() called - current index:', currentIndex);
    // Zufälligen Index wählen (aber nicht den aktuellen)
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * shuffledTemplates.length);
    } while (newIndex === currentIndex && shuffledTemplates.length > 1);
    
    console.log('Switching to template index:', newIndex, 'template ID:', shuffledTemplates[newIndex]);
    currentIndex = newIndex;
    applyTemplate(shuffledTemplates[currentIndex]);
  }

  function startInterval(){
    if(prefersReduced) return; // Kein Auto-Rotate bei reduced motion
    if(intervalHandle) return;
    intervalHandle = setInterval(()=>{
      if(isVisible) nextTemplate();
    }, ROTATION_INTERVAL_MS);
  }
  function stopInterval(){
    if(intervalHandle){
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  // Öffentliche API
  window.FeatureRotation = {
    next: ()=>{ nextTemplate(); },
    prev: ()=>{ 
      if(isAnimating) return; 
      currentIndex = (currentIndex - 1 + shuffledTemplates.length) % shuffledTemplates.length; 
      applyTemplate(shuffledTemplates[currentIndex]); 
    },
    goto: (i)=>{ 
      if(isAnimating) return; 
      if(!(i>=0 && i<shuffledTemplates.length)) return; 
      currentIndex=i; 
      applyTemplate(shuffledTemplates[currentIndex]); 
    },
    random: ()=>{ randomTemplate(); },
    current: ()=>({index:currentIndex, id: shuffledTemplates[currentIndex]}),
    pause: ()=> stopInterval(),
    resume: ()=> startInterval(),
  };

  // sectionUpdate Event-Unterstützung (externe Systeme können Rotationen triggern)
  document.addEventListener('sectionUpdate',(e)=>{
    if(e.detail && e.detail.sectionId === SECTION_ID){
      // Einfach auf nächstes Template springen
      nextTemplate();
    }
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){ stopInterval(); }
    else if(isVisible){ startInterval(); }
  });

  function bootstrap(){
    console.log('FeatureRotation: Bootstrap starting');
    // Initialisierung und Setup eines eigenen Scroll-Observers
    setupScrollObserver();
    
    // Initial template immer laden wenn Section leer ist
    const sectionEl = document.getElementById(SECTION_ID);
    if(sectionEl && !sectionEl.firstElementChild){
      console.log('FeatureRotation: Section is empty, loading initial template');
      applyTemplate(shuffledTemplates[currentIndex]);
    }
    
    if(prefersReduced){
      console.log('FeatureRotation: Reduced motion preferred');
    }
  }

  // Eigener Observer nur für Features-Section
  function setupScrollObserver() {
    const sectionEl = document.getElementById(SECTION_ID);
    if(!sectionEl) return;
    
    console.log('FeatureRotation: Setting up scroll observer for section:', SECTION_ID);
    
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.target.id === SECTION_ID && entry.isIntersecting){
          console.log('FeatureRotation: Section entered viewport, triggering random template');
          // Sofortiger Template-Wechsel ohne Verzögerung
          randomTemplate();
        }
      });
    }, {
      threshold: 0.3,  // Etwas höher als das Animationssystem
      rootMargin: '0px 0px -100px 0px'
    });
    
    observer.observe(sectionEl);
  }

  // Warten auf ausgelagerte Templates
  document.addEventListener('featuresTemplatesLoaded', () => {
    console.log('FeatureRotation: Templates loaded, bootstrapping');
    bootstrap();
  });

  // (Ehemalige Logik für nachträgliches Hinzufügen entfernt – alle Templates sind jetzt sofort verfügbar)

  document.addEventListener('DOMContentLoaded', () => {
    console.log('FeatureRotation: DOMContentLoaded');
    // Falls Templates inline oder bereits geladen
  if(document.getElementById('template-features-1')){
      console.log('FeatureRotation: Templates found, bootstrapping');
      bootstrap();
    } else {
      console.log('FeatureRotation: Templates not found yet');
    }
  });
})();
