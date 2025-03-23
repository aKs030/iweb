document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('editorCanvas');
  const ctx = canvas.getContext('2d');
  const levelSelect = document.getElementById('levelSelect');
  const newLevelBtn = document.getElementById('newLevelBtn');
  const addHindernisBtn = document.getElementById('addHindernisBtn');
  const addGegnerBtn = document.getElementById('addGegnerBtn');
  const exportJSONBtn = document.getElementById('exportJSONBtn');
  const toggleSafeBtn = document.getElementById('toggleSafeBtn');

  let levels = [];
  let currentLevelIndex = 0;
  let isDragging = false;
  let draggedHindernis = null;
  let draggedGegner = null;
  let undoStack = [];

  function newLevel() {
    levels.push({ hindernisse: [], gegner: null });
    currentLevelIndex = levels.length - 1;
    updateLevelSelect();
    render();
  }

  function deleteLevel() {
    if (levels.length > 1) {
      levels.splice(currentLevelIndex, 1);
      currentLevelIndex = Math.max(0, currentLevelIndex - 1);
      updateLevelSelect();
      render();
    } else {
      alert('Es muss mindestens ein Level vorhanden sein.');
    }
  }

  function updateLevelSelect() {
    levelSelect.innerHTML = '';
    levels.forEach((_, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `Level ${index + 1}`;
      levelSelect.appendChild(option);
    });
    levelSelect.value = currentLevelIndex;
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Hintergrund zeichnen
    ctx.fillStyle = '#87ceeb'; // Himmelblau
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Boden zeichnen
    const BODEN_HOEHE = 50;
    ctx.fillStyle = 'green'; // Grün für den Boden
    ctx.fillRect(0, canvas.height - BODEN_HOEHE, canvas.width, BODEN_HOEHE);

    // Spielfeld-Ränder zeichnen
    ctx.strokeStyle = 'red'; // Rote Linie für die Ränder
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height - BODEN_HOEHE);



    // Hindernisse und Gegner zeichnen
    const levelData = levels[currentLevelIndex] || { hindernisse: [], gegner: null };
    levelData.hindernisse.forEach(h => {
      ctx.fillStyle = h.farbe;
      ctx.fillRect(h.x, h.y, h.breite, h.hoehe);
    });

    if (levelData.gegner) {
      ctx.fillStyle = levelData.gegner.farbe;
      ctx.fillRect(levelData.gegner.x, levelData.gegner.y, levelData.gegner.breite, levelData.gegner.hoehe);
    }
  }

  function animateGegner() {
    const levelData = levels[currentLevelIndex];
    if (levelData.gegner) {
      const gegner = levelData.gegner;
      gegner.x += gegner.speed;
      if (gegner.x > gegner.maxX || gegner.x < gegner.minX) {
        gegner.speed *= -1;
      }
      render();
      requestAnimationFrame(animateGegner);
    }
  }

  function saveState() {
    undoStack.push(JSON.parse(JSON.stringify(levels)));
    if (undoStack.length > 20) undoStack.shift(); // Begrenzung der Historie
  }

  function undo() {
    if (undoStack.length > 0) {
      levels = undoStack.pop();
      render();
      updateLevelSelect();
    } else {
      alert('Keine weiteren Aktionen zum Rückgängig machen.');
    }
  }

  function duplicateLevel() {
    saveState();
    const currentLevel = JSON.parse(JSON.stringify(levels[currentLevelIndex]));
    levels.splice(currentLevelIndex + 1, 0, currentLevel);
    currentLevelIndex++;
    updateLevelSelect();
    render();
  }

  function deleteHindernis() {
    saveState();
    const currentLevel = levels[currentLevelIndex];
    if (currentLevel.hindernisse.length > 0) {
      currentLevel.hindernisse.pop();
      render();
    } else {
      alert('Keine Hindernisse zum Löschen vorhanden.');
    }
  }

  function deleteGegner() {
    saveState();
    const currentLevel = levels[currentLevelIndex];
    if (currentLevel.gegner) {
      currentLevel.gegner = null;
      render();
    } else {
      alert('Kein Gegner zum Löschen vorhanden.');
    }
  }

  function changeHindernisColor() {
    saveState();
    const currentLevel = levels[currentLevelIndex];
    if (currentLevel.hindernisse.length > 0) {
      const lastHindernis = currentLevel.hindernisse[currentLevel.hindernisse.length - 1];
      lastHindernis.farbe = prompt('Gib eine neue Farbe für das Hindernis ein (z. B. "blue", "#FF0000"):', lastHindernis.farbe || 'brown') || lastHindernis.farbe;
      render();
    } else {
      alert('Keine Hindernisse vorhanden, um die Farbe zu ändern.');
    }
  }

  function resetCurrentLevel() {
    saveState();
    levels[currentLevelIndex] = { hindernisse: [], gegner: null };
    render();
  }

  canvas.addEventListener('mousedown', (e) => {
    const levelData = levels[currentLevelIndex];
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    draggedHindernis = levelData.hindernisse.find(h =>
      mouseX >= h.x && mouseX <= h.x + h.breite &&
      mouseY >= h.y && mouseY <= h.y + h.hoehe
    );

    if (draggedHindernis) {
      isDragging = true;
    } else if (levelData.gegner && 
               mouseX >= levelData.gegner.x && mouseX <= levelData.gegner.x + levelData.gegner.breite &&
               mouseY >= levelData.gegner.y && mouseY <= levelData.gegner.y + levelData.gegner.hoehe) {
      draggedGegner = levelData.gegner;
      isDragging = true;
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (draggedHindernis) {
        if (e.shiftKey) {
          // Skalieren des Blocks
          draggedHindernis.breite = Math.max(20, mouseX - draggedHindernis.x);
          draggedHindernis.hoehe = Math.max(20, mouseY - draggedHindernis.y);
        } else {
          // Verschieben des Blocks
          draggedHindernis.x = mouseX - draggedHindernis.breite / 2;
          draggedHindernis.y = mouseY - draggedHindernis.hoehe / 2;
        }
      } else if (draggedGegner) {
        draggedGegner.x = mouseX - draggedGegner.breite / 2;
        draggedGegner.y = mouseY - draggedGegner.hoehe / 2;
      }
      render();
    }
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
    draggedHindernis = null;
    draggedGegner = null;
  });

  // Event-Listener
  newLevelBtn.addEventListener('click', newLevel);
  addHindernisBtn.addEventListener('click', () => {
    saveState();
    levels[currentLevelIndex].hindernisse.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      breite: 60,
      hoehe: 40,
      farbe: 'brown',
      safe: false // Standardmäßig kein sicherer Block
    });
    render();
  });

  // Neuer Button für grünen Block
  document.getElementById('addGreenBlockBtn').addEventListener('click', () => {
    saveState();
    levels[currentLevelIndex].hindernisse.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      breite: 60,
      hoehe: 40,
      farbe: 'green',
      safe: true // Sicherer Block
    });
    render();
  });

  addGegnerBtn.addEventListener('click', () => {
    saveState();
    levels[currentLevelIndex].gegner = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      breite: 60,
      hoehe: 40,
      farbe: 'red',
      speed: 2,
      minX: canvas.width / 2 - 60,
      maxX: canvas.width / 2 + 60
    };
    animateGegner();
  });
  exportJSONBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(levels, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'levels.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  toggleSafeBtn.addEventListener('click', () => {
    const currentLevel = levels[currentLevelIndex];
    if (!currentLevel.hindernisse.length) return;
    const lastHindernis = currentLevel.hindernisse[currentLevel.hindernisse.length - 1];
    lastHindernis.safe = !lastHindernis.safe;
    render();
  });

  document.getElementById('duplicateLevelBtn').addEventListener('click', duplicateLevel);
  document.getElementById('deleteHindernisBtn').addEventListener('click', deleteHindernis);
  document.getElementById('deleteGegnerBtn').addEventListener('click', deleteGegner);
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('changeColorBtn').addEventListener('click', changeHindernisColor);
  document.getElementById('resetLevelBtn').addEventListener('click', resetCurrentLevel);

  levelSelect.addEventListener('change', (e) => {
    currentLevelIndex = parseInt(e.target.value, 10);
    render();
  });

  // Initialisierung
  newLevel();
});