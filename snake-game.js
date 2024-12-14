const canvas = document.getElementById('game');
const context = canvas.getContext('2d');
const grid = 16;
let count = 0;

// Snake-Objekt
const snake = {
  x: 160,
  y: 160,
  dx: grid,
  dy: 0,
  cells: [],
  maxCells: 4,
};

// Apple-Objekt
const apple = {
  x: 320,
  y: 320,
};

// Zufällige Position für Apfel generieren
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// Hauptspiel-Schleife
function gameLoop() {
  requestAnimationFrame(gameLoop);

  if (++count < 4) return;

  count = 0;
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Schlange bewegen
  snake.x += snake.dx;
  snake.y += snake.dy;

  // Begrenzung des Spielfelds
  if (snake.x < 0) snake.x = canvas.width - grid;
  else if (snake.x >= canvas.width) snake.x = 0;

  if (snake.y < 0) snake.y = canvas.height - grid;
  else if (snake.y >= canvas.height) snake.y = 0;

  snake.cells.unshift({ x: snake.x, y: snake.y });

  if (snake.cells.length > snake.maxCells) snake.cells.pop();

  // Apfel zeichnen
  context.fillStyle = 'red';
  context.fillRect(apple.x, apple.y, grid - 1, grid - 1);

  // Schlange zeichnen
  context.fillStyle = 'green';
  snake.cells.forEach((cell, index) => {
    context.fillRect(cell.x, cell.y, grid - 1, grid - 1);

    // Apfel gegessen
    if (cell.x === apple.x && cell.y === apple.y) {
      snake.maxCells++;
      apple.x = getRandomInt(0, 25) * grid;
      apple.y = getRandomInt(0, 25) * grid;
    }

    // Kollision mit sich selbst
    for (let i = index + 1; i < snake.cells.length; i++) {
      if (cell.x === snake.cells[i].x && cell.y === snake.cells[i].y) {
        // Spiel zurücksetzen
        snake.x = 160;
        snake.y = 160;
        snake.cells = [];
        snake.maxCells = 4;
        snake.dx = grid;
        snake.dy = 0;

        apple.x = getRandomInt(0, 25) * grid;
        apple.y = getRandomInt(0, 25) * grid;
      }
    }
  });
}

// Tastatursteuerung
function setupKeyboardControls() {
  document.addEventListener('keydown', (e) => {
    if (e.which === 37 && snake.dx === 0) {
      snake.dx = -grid;
      snake.dy = 0;
    } else if (e.which === 38 && snake.dy === 0) {
      snake.dy = -grid;
      snake.dx = 0;
    } else if (e.which === 39 && snake.dx === 0) {
      snake.dx = grid;
      snake.dy = 0;
    } else if (e.which === 40 && snake.dy === 0) {
      snake.dy = grid;
      snake.dx = 0;
    }
  });
}

// Touchscreen-Steuerung
function setupTouchControls() {
  let touchStartX = 0;
  let touchStartY = 0;

  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  });

  canvas.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0 && snake.dx === 0) {
        snake.dx = grid;
        snake.dy = 0;
      } else if (diffX < 0 && snake.dx === 0) {
        snake.dx = -grid;
        snake.dy = 0;
      }
    } else {
      if (diffY > 0 && snake.dy === 0) {
        snake.dy = grid;
        snake.dx = 0;
      } else if (diffY < 0 && snake.dy === 0) {
        snake.dy = -grid;
        snake.dx = 0;
      }
    }
  });
}

// Joystick-Steuerung
function setupJoystickControls() {
  const joystick = document.createElement('div');
  joystick.innerHTML = `
    <div id="joystick-container">
      <button data-dir="up">⬆</button>
      <div>
        <button data-dir="left">⬅</button>
        <button data-dir="right">➡</button>
      </div>
      <button data-dir="down">⬇</button>
    </div>
  `;

  joystick.style.position = 'absolute';
  joystick.style.bottom = '20px';
  joystick.style.left = '50%';
  joystick.style.transform = 'translateX(-50%)';
  joystick.style.zIndex = '1000';
  joystick.style.textAlign = 'center';

  document.body.appendChild(joystick);

  document.querySelectorAll('#joystick-container button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const direction = e.target.getAttribute('data-dir');

      if (direction === 'up' && snake.dy === 0) {
        snake.dx = 0;
        snake.dy = -grid;
      } else if (direction === 'down' && snake.dy === 0) {
        snake.dx = 0;
        snake.dy = grid;
      } else if (direction === 'left' && snake.dx === 0) {
        snake.dx = -grid;
        snake.dy = 0;
      } else if (direction === 'right' && snake.dx === 0) {
        snake.dx = grid;
        snake.dy = 0;
      }
    });
  });
}

// Steuerungsmenü anzeigen
function showMenu() {
  const menu = document.createElement('div');
  menu.id = 'menu';
  menu.style.position = 'absolute';
  menu.style.top = '50%';
  menu.style.left = '50%';
  menu.style.transform = 'translate(-50%, -50%)';
  menu.style.background = 'white';
  menu.style.padding = '20px';
  menu.style.textAlign = 'center';
  menu.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';

  menu.innerHTML = `
    <h2>Wähle eine Steuerung</h2>
    <button id="keyboard-control">Tastatur</button>
    <button id="touch-control">Touchscreen</button>
    <button id="joystick-control">Joystick</button>
  `;

  document.body.appendChild(menu);

  document.getElementById('keyboard-control').addEventListener('click', () => {
    document.body.removeChild(menu);
    setupKeyboardControls();
    requestAnimationFrame(gameLoop);
  });

  document.getElementById('touch-control').addEventListener('click', () => {
    document.body.removeChild(menu);
    setupTouchControls();
    requestAnimationFrame(gameLoop);
  });

  document.getElementById('joystick-control').addEventListener('click', () => {
    document.body.removeChild(menu);
    setupJoystickControls();
    requestAnimationFrame(gameLoop);
  });
}

// Menü anzeigen
showMenu();