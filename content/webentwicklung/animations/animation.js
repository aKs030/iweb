/* Animation System (renamed from lite dev)
 * Simple viewport reveal animations.
 * Attributes: data-animation, data-delay, data-duration, data-easing, data-distance
 */
(function(){
  'use strict';
  if(window.AnimationSystem && window.AnimationSystem.__active){ return; }
  const ATTR_ANIM='data-animation';
  const ATTR_DELAY='data-delay';
  const ATTR_DUR='data-duration';
  const ATTR_EASE='data-easing';
  const ATTR_DIST='data-distance';
  const CLASS_ACTIVE='is-animating';
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ensureCSS(){
    if(document.getElementById('anim-css')) return;
    const css=`.animate-element{opacity:0;transform:translateY(30px);transition:all .6s ease}.animate-element.is-visible{opacity:1;transform:translateY(0)}.animate-fadeInUp{transform:translateY(50px)}.animate-fadeInDown{transform:translateY(-50px)}.animate-fadeInLeft{transform:translateX(-50px)}.animate-fadeInRight{transform:translateX(50px)}.animate-zoomIn{transform:scale(.85)}.animate-fadeIn{transform:translateY(0)}`;
    const style=document.createElement('style'); style.id='anim-css'; style.textContent=css; document.head.appendChild(style);
  }
  function init(el){
    const type=el.getAttribute(ATTR_ANIM); if(!type) return;
    el.classList.add('animate-element'); if(type!=='fadeIn') el.classList.add('animate-'+type);
    const dur=parseInt(el.getAttribute(ATTR_DUR)||'600',10); el.style.transitionDuration=dur+'ms';
    const ease=el.getAttribute(ATTR_EASE); if(ease) el.style.transitionTimingFunction=ease;
    if(!el.classList.contains('is-visible')){ const distRaw=el.getAttribute(ATTR_DIST); const dist=parseInt(distRaw||'',10); if(distRaw && !isNaN(dist) && !(el.style.transform && /translate[XY]\(/.test(el.style.transform))){ el.style.transform=`translateY(${dist}px)`; } }
    if(prefersReduced) el.classList.add('is-visible');
  }
  function animate(el){ if(!el || el.classList.contains(CLASS_ACTIVE) || prefersReduced) return; const delay=parseInt(el.getAttribute(ATTR_DELAY)||'0',10); el.classList.add(CLASS_ACTIVE); setTimeout(()=>{ el.classList.add('is-visible'); },delay); setTimeout(()=>{ el.classList.remove(CLASS_ACTIVE); }, delay + parseInt(el.getAttribute(ATTR_DUR)||'600',10)); }
  function reset(el){ if(!el) return; el.classList.remove('is-visible', CLASS_ACTIVE); }
  function replay(el){ if(!el) return; reset(el); el.offsetWidth; animate(el); }
  const observer=new IntersectionObserver(entries=>{ entries.forEach(entry=>{ if(entry.isIntersecting){ animate(entry.target); } else { setTimeout(()=>{ if(!entry.isIntersecting) reset(entry.target); },100); } }); }, { threshold:0.1 });
  function scan(){ ensureCSS(); document.querySelectorAll('['+ATTR_ANIM+']').forEach(el=>{ init(el); observer.observe(el); }); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', scan);} else { scan(); }
  window.AnimationSystem = { __active:true, scan, animate, reset, replay };
})();
