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
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDragging && draggedHindernis) {
      const rect = canvas.getBoundingClientRect();
      draggedHindernis.x = e.clientX - rect.left - draggedHindernis.breite / 2;
      draggedHindernis.y = e.clientY - rect.top - draggedHindernis.hoehe / 2;
      render();
    }
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
    draggedHindernis = null;
  });

  // Event-Listener
  newLevelBtn.addEventListener('click', newLevel);
  addHindernisBtn.addEventListener('click', () => {
    levels[currentLevelIndex].hindernisse.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      breite: 60,
      hoehe: 40,
      farbe: 'brown'
    });
    render();
  });
  addGegnerBtn.addEventListener('click', () => {
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

  levelSelect.addEventListener('change', (e) => {
    currentLevelIndex = parseInt(e.target.value, 10);
    render();
  });

  // Initialisierung
  newLevel();
});