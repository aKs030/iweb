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

// Steuerung per Tippen
const controls = document.createElement('div');
controls.id = 'controls';
controls.style.position = 'absolute';
controls.style.top = '0';
controls.style.left = '0';
controls.style.width = '100%';
controls.style.height = '100%';
controls.style.display = 'grid';
controls.style.gridTemplateColumns = '1fr 1fr';
controls.style.gridTemplateRows = '1fr 1fr';
controls.style.zIndex = '1000';
controls.style.touchAction = 'none';
document.body.appendChild(controls);

// Bereiche für Steuerung erstellen
['up', 'right', 'down', 'left'].forEach((direction) => {
  const button = document.createElement('div');
  button.dataset.direction = direction;
  button.style.background = 'rgba(255, 255, 255, 0.1)';
  button.style.border = '1px solid rgba(255, 255, 255, 0.2)';
  button.style.display = 'flex';
  button.style.justifyContent = 'center';
  button.style.alignItems = 'center';
  button.style.fontSize = '20px';
  button.style.color = 'white';
  button.style.touchAction = 'none';

  // Beschriftung hinzufügen (optional)
  if (direction === 'up') button.innerText = '⬆';
  if (direction === 'right') button.innerText = '➡';
  if (direction === 'down') button.innerText = '⬇';
  if (direction === 'left') button.innerText = '⬅';

  button.addEventListener('click', () => {
    if (direction === 'up' && snake.dy === 0) {
      snake.dx = 0;
      snake.dy = -grid;
    } else if (direction === 'right' && snake.dx === 0) {
      snake.dx = grid;
      snake.dy = 0;
    } else if (direction === 'down' && snake.dy === 0) {
      snake.dx = 0;
      snake.dy = grid;
    } else if (direction === 'left' && snake.dx === 0) {
      snake.dx = -grid;
      snake.dy = 0;
    }
  });

  controls.appendChild(button);
});

// Bereiche für Steuerung anpassen
const controlAreas = controls.querySelectorAll('div');
controlAreas[0].style.gridArea = '1 / 1 / 2 / 3'; // Up
controlAreas[1].style.gridArea = '1 / 3 / 3 / 4'; // Right
controlAreas[2].style.gridArea = '3 / 1 / 4 / 3'; // Down
controlAreas[3].style.gridArea = '2 / 1 / 3 / 2'; // Left

// Start der Spielschleife
requestAnimationFrame(gameLoop);