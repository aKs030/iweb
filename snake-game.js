const canvas = document.getElementById('game');
const context = canvas.getContext('2d');
const joystickContainer = document.getElementById('joystick-container');
const joystick = document.getElementById('joystick');

// Steuerungsmodi
const touchscreenBtn = document.getElementById('touchscreen-btn');
const joystickBtn = document.getElementById('joystick-btn');

// Snake Eigenschaften
const grid = 16;
let count = 0;

const snake = {
  x: 160,
  y: 160,
  dx: grid,
  dy: 0,
  cells: [],
  maxCells: 4,
};

const apple = {
  x: 320,
  y: 320,
};

// Zufällige Position generieren
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// Spiel-Loop
function gameLoop() {
  requestAnimationFrame(gameLoop);

  if (++count < 4) return;

  count = 0;
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Snake Bewegung
  snake.x += snake.dx;
  snake.y += snake.dy;

  // Bildschirmrand-Handling
  if (snake.x < 0) snake.x = canvas.width - grid;
  else if (snake.x >= canvas.width) snake.x = 0;

  if (snake.y < 0) snake.y = canvas.height - grid;
  else if (snake.y >= canvas.height) snake.y = 0;

  // Snake-Position aktualisieren
  snake.cells.unshift({ x: snake.x, y: snake.y });
  if (snake.cells.length > snake.maxCells) snake.cells.pop();

  // Apple zeichnen
  context.fillStyle = 'red';
  context.fillRect(apple.x, apple.y, grid - 1, grid - 1);

  // Snake zeichnen
  context.fillStyle = 'green';
  snake.cells.forEach((cell, index) => {
    context.fillRect(cell.x, cell.y, grid - 1, grid - 1);

    // Snake frisst Apple
    if (cell.x === apple.x && cell.y === apple.y) {
      snake.maxCells++;
      apple.x = getRandomInt(0, 25) * grid;
      apple.y = getRandomInt(0, 25) * grid;
    }

    // Snake kollidiert mit sich selbst
    for (let i = index + 1; i < snake.cells.length; i++) {
      if (cell.x === snake.cells[i].x && cell.y === snake.cells[i].y) {
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

// Eventlistener für Touchscreen-Steuerung
function setupTouchscreenControls() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && snake.dx === 0) {
      snake.dx = -grid;
      snake.dy = 0;
    } else if (e.key === 'ArrowUp' && snake.dy === 0) {
      snake.dy = -grid;
      snake.dx = 0;
    } else if (e.key === 'ArrowRight' && snake.dx === 0) {
      snake.dx = grid;
      snake.dy = 0;
    } else if (e.key === 'ArrowDown' && snake.dy === 0) {
      snake.dy = grid;
      snake.dx = 0;
    }
  });
}

// Eventlistener für Joystick-Steuerung
function setupJoystickControls() {
  let dragging = false;
  let startX, startY;

  joystick.addEventListener('touchstart', (e) => {
    dragging = true;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  });

  joystick.addEventListener('touchmove', (e) => {
    if (!dragging) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 0 && snake.dx === 0) {
        snake.dx = grid;
        snake.dy = 0;
      } else if (deltaX < 0 && snake.dx === 0) {
        snake.dx = -grid;
        snake.dy = 0;
      }
    } else {
      if (deltaY > 0 && snake.dy === 0) {
        snake.dy = grid;
        snake.dx = 0;
      } else if (deltaY < 0 && snake.dy === 0) {
        snake.dy = -grid;
        snake.dx = 0;
      }
    }
  });

  joystick.addEventListener('touchend', () => {
    dragging = false;
  });
}

// Steuerungsauswahl
touchscreenBtn.addEventListener('click', () => {
  joystickContainer.style.display = 'none';
  setupTouchscreenControls();
});

joystickBtn.addEventListener('click', () => {
  joystickContainer.style.display = 'flex';
  setupJoystickControls();
});

// Spiel starten
requestAnimationFrame(gameLoop);