const canvas = document.getElementById('game');
const context = canvas.getContext('2d');

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

// Zufällige Position für Apfel generieren
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// Spielschleife
function gameLoop() {
  requestAnimationFrame(gameLoop);

  if (++count < 4) return;

  count = 0;
  context.clearRect(0, 0, canvas.width, canvas.height);

  snake.x += snake.dx;
  snake.y += snake.dy;

  // Begrenzung der Spielwelt
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

// Touchscreen-Steuerung
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

// Joystick-Steuerung
const joystickContainer = document.createElement('div');
joystickContainer.id = 'joystick-container';
joystickContainer.style.position = 'absolute';
joystickContainer.style.bottom = '20px';
joystickContainer.style.left = '20px';
joystickContainer.style.width = '150px';
joystickContainer.style.height = '150px';
joystickContainer.style.background = 'rgba(255, 255, 255, 0.1)';
joystickContainer.style.borderRadius = '50%';
joystickContainer.style.display = 'flex';
joystickContainer.style.justifyContent = 'center';
joystickContainer.style.alignItems = 'center';
document.body.appendChild(joystickContainer);

const joystick = document.createElement('div');
joystick.id = 'joystick';
joystick.style.width = '50px';
joystick.style.height = '50px';
joystick.style.background = '#fff';
joystick.style.borderRadius = '50%';
joystick.style.touchAction = 'none';
joystick.style.position = 'relative';
joystickContainer.appendChild(joystick);

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

// Start der Spielschleife
requestAnimationFrame(gameLoop);