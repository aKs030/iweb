"use strict";
// Lädt ausgelagerte Feature-Templates und feuert ein Event wenn fertig.
(function(){
  const URL = '/content/webentwicklung/features/features-templates.html';
  let loaded = false;

  async function loadAll(){
    if(loaded) return;
    try {
      const res = await fetch(URL, {credentials:'same-origin'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const html = await res.text();
      const container = document.createElement('div');
      container.style.display='none';
      container.innerHTML = html;
      document.body.appendChild(container);
      loaded = true;
      document.dispatchEvent(new CustomEvent('featuresTemplatesLoaded'));
    } catch(err){
      console.error('[FeaturesTemplatesLoader] Fehler beim Laden:', err);
      document.dispatchEvent(new CustomEvent('featuresTemplatesError',{detail:{error:err,url:URL}}));
    }
  }

  document.addEventListener('DOMContentLoaded', loadAll);
})();
