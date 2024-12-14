const canvas = document.getElementById('game');
const context = canvas.getContext('2d');
const joystick = document.getElementById('joystick');
const joystickContainer = document.querySelector('.joystick-container');

const grid = 16;
let count = 0;

// Snake attributes
const snake = {
  x: 160,
  y: 160,
  dx: grid,
  dy: 0,
  cells: [],
  maxCells: 4,
};

// Apple attributes
const apple = {
  x: 320,
  y: 320,
};

// Get a random grid position
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// Game loop
function gameLoop() {
  requestAnimationFrame(gameLoop);

  if (++count < 4) return;

  count = 0;
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Move snake
  snake.x += snake.dx;
  snake.y += snake.dy;

  // Wrap around edges
  if (snake.x < 0) snake.x = canvas.width - grid;
  else if (snake.x >= canvas.width) snake.x = 0;

  if (snake.y < 0) snake.y = canvas.height - grid;
  else if (snake.y >= canvas.height) snake.y = 0;

  // Track snake cells
  snake.cells.unshift({ x: snake.x, y: snake.y });
  if (snake.cells.length > snake.maxCells) snake.cells.pop();

  // Draw apple
  context.fillStyle = 'red';
  context.fillRect(apple.x, apple.y, grid - 1, grid - 1);

  // Draw snake
  context.fillStyle = 'green';
  snake.cells.forEach((cell, index) => {
    context.fillRect(cell.x, cell.y, grid - 1, grid - 1);

    // Snake eats apple
    if (cell.x === apple.x && cell.y === apple.y) {
      snake.maxCells++;
      apple.x = getRandomInt(0, 25) * grid;
      apple.y = getRandomInt(0, 25) * grid;
    }

    // Snake collides with itself
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

// Start game loop
requestAnimationFrame(gameLoop);

// Joystick variables
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

  // Limit joystick movement
  const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), 40);
  const angle = Math.atan2(deltaY, deltaX);

  const joystickX = Math.cos(angle) * distance;
  const joystickY = Math.sin(angle) * distance;

  joystick.style.transform = `translate(${joystickX}px, ${joystickY}px)`;

  // Determine direction
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    // Horizontal movement
    if (deltaX > 0 && snake.dx === 0) {
      snake.dx = grid;
      snake.dy = 0;
    } else if (deltaX < 0 && snake.dx === 0) {
      snake.dx = -grid;
      snake.dy = 0;
    }
  } else {
    // Vertical movement
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
  joystick.style.transform = `translate(0, 0)`;
});