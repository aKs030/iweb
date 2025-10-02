/**
 * Quick Debug Script für Earth-Grafik
 * 
 * Füge dieses Script in die Browser-Console ein, um die Earth-Grafik zu debuggen.
 * 
 * Usage:
 * 1. Öffne http://localhost:8000
 * 2. Öffne Browser DevTools (F12)
 * 3. Kopiere und füge dieses komplette Script in die Console ein
 * 4. Drücke Enter
 */

(function() {
  console.log('🌍 Earth-Grafik Debug-Script gestartet...\n');
  
  // Warte auf Three.js Initialisierung
  const checkInterval = setInterval(() => {
    const debug = window.threeEarthDebug;
    
    if (debug && debug.scene) {
      clearInterval(checkInterval);
      runDiagnostics(debug);
    }
  }, 500);
  
  // Timeout nach 10 Sekunden
  setTimeout(() => {
    clearInterval(checkInterval);
    if (!window.threeEarthDebug) {
      console.error('❌ FEHLER: Three.js Earth System nicht initialisiert nach 10s');
      console.log('💡 Mögliche Ursachen:');
      console.log('   1. Three.js konnte nicht geladen werden');
      console.log('   2. WebGL nicht verfügbar');
      console.log('   3. Initialisierungs-Fehler im Code');
      console.log('\n📝 Prüfe die Console auf Three.js Fehler');
    }
  }, 10000);
  
  function runDiagnostics(debug) {
    console.log('✅ window.threeEarthDebug gefunden!\n');
    
    const { scene, camera, renderer, earthMesh, animationFrameId } = debug;
    
    // === SYSTEM STATUS ===
    console.log('📊 SYSTEM STATUS');
    console.log('================');
    console.table({
      'Scene': scene ? '✅ OK' : '❌ FEHLT',
      'Camera': camera ? '✅ OK' : '❌ FEHLT',
      'Renderer': renderer ? '✅ OK' : '❌ FEHLT',
      'Earth Mesh': earthMesh ? '✅ OK' : '❌ FEHLT',
      'Animation läuft': animationFrameId ? '✅ OK' : '❌ FEHLT',
    });
    
    if (!earthMesh) {
      console.error('❌ earthMesh nicht gefunden - Earth-System nicht erstellt');
      return;
    }
    
    // === WOLKEN CHECK ===
    console.log('\n☁️  WOLKEN-LAYER');
    console.log('===============');
    const clouds = earthMesh.getObjectByName('earthClouds');
    
    if (clouds) {
      console.log('✅ Wolken-Mesh gefunden');
      console.log('   Name:', clouds.name);
      console.log('   Type:', clouds.type);
      console.log('   Visible:', clouds.visible);
      console.log('   Material:', clouds.material?.type);
      
      if (clouds.material) {
        console.log('   Transparent:', clouds.material.transparent);
        console.log('   Uniforms:', clouds.material.uniforms ? 'Vorhanden' : 'Fehlt');
        
        if (clouds.material.uniforms) {
          console.log('   Time Uniform:', clouds.material.uniforms.time?.value || 'N/A');
          console.log('   Cloud Speed:', clouds.material.uniforms.cloudSpeed?.value || 'N/A');
        }
      }
      
      // Manual Fix-Funktion
      window.fixClouds = () => {
        clouds.visible = true;
        clouds.material.needsUpdate = true;
        console.log('✅ Wolken-Sichtbarkeit aktiviert');
      };
      console.log('\n💡 Zum Aktivieren: fixClouds()');
    } else {
      console.error('❌ Wolken-Layer NICHT gefunden');
      console.log('   Expected: earthMesh.children sollte "earthClouds" enthalten');
      console.log('   Actual:', earthMesh.children.map(c => c.name));
    }
    
    // === ATMOSPHÄRE CHECK ===
    console.log('\n🌟 ATMOSPHÄREN-GLOW');
    console.log('===================');
    const atmosphere = scene.getObjectByName('earthAtmosphere');
    
    if (atmosphere) {
      console.log('✅ Atmosphären-Mesh gefunden');
      console.log('   Name:', atmosphere.name);
      console.log('   Type:', atmosphere.type);
      console.log('   Visible:', atmosphere.visible);
      console.log('   Material:', atmosphere.material?.type);
      console.log('   Position:', atmosphere.position);
      
      if (atmosphere.material?.uniforms) {
        console.log('   Glow Color:', atmosphere.material.uniforms.glowColor?.value);
        console.log('   Glow Intensity:', atmosphere.material.uniforms.glowIntensity?.value);
      }
      
      // Manual Fix-Funktion
      window.fixAtmosphere = () => {
        atmosphere.visible = true;
        atmosphere.material.uniforms.glowIntensity.value = 1.2;
        atmosphere.material.needsUpdate = true;
        console.log('✅ Atmosphäre intensiviert');
      };
      console.log('\n💡 Zum Intensivieren: fixAtmosphere()');
    } else {
      console.error('❌ Atmosphäre NICHT gefunden');
      console.log('   Expected: scene.children sollte "earthAtmosphere" enthalten');
      console.log('   Actual:', scene.children.map(c => c.name));
    }
    
    // === SCENE GRAPH ===
    console.log('\n🌲 SCENE GRAPH');
    console.log('==============');
    scene.traverse((obj) => {
      const depth = getDepth(obj);
      const indent = '  '.repeat(depth);
      console.log(`${indent}${obj.name || '(unnamed)'} [${obj.type}] visible=${obj.visible}`);
    });
    
    // === RENDERER INFO ===
    console.log('\n🎨 RENDERER INFO');
    console.log('================');
    console.log('Programs:', renderer.info.programs.length);
    console.log('Geometries:', renderer.info.memory.geometries);
    console.log('Textures:', renderer.info.memory.textures);
    console.log('Render Calls:', renderer.info.render.calls);
    console.log('Triangles:', renderer.info.render.triangles);
    
    // === HILFSFUNKTIONEN ===
    console.log('\n🛠️  HILFSFUNKTIONEN');
    console.log('==================');
    console.log('window.fixClouds()       - Wolken aktivieren');
    console.log('window.fixAtmosphere()   - Atmosphäre intensivieren');
    console.log('window.toggleClouds()    - Wolken toggle');
    console.log('window.toggleAtmosphere() - Atmosphäre toggle');
    console.log('window.showSceneGraph()  - Scene Graph anzeigen');
    
    window.toggleClouds = () => {
      if (clouds) {
        clouds.visible = !clouds.visible;
        console.log(`Wolken ${clouds.visible ? '✅ AN' : '❌ AUS'}`);
      }
    };
    
    window.toggleAtmosphere = () => {
      if (atmosphere) {
        atmosphere.visible = !atmosphere.visible;
        console.log(`Atmosphäre ${atmosphere.visible ? '✅ AN' : '❌ AUS'}`);
      }
    };
    
    window.showSceneGraph = () => {
      scene.traverse((obj) => {
        const depth = getDepth(obj);
        const indent = '  '.repeat(depth);
        console.log(`${indent}${obj.name || '(unnamed)'} [${obj.type}]`);
      });
    };
    
    console.log('\n✨ Diagnostik abgeschlossen!');
  }
  
  function getDepth(obj) {
    let depth = 0;
    let current = obj;
    while (current.parent) {
      depth++;
      current = current.parent;
    }
    return depth - 1;
  }
})();
