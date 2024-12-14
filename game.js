import { saveScore, fetchTopScores } from './firebase.js';

const canvas = document.getElementById('game');
const context = canvas.getContext('2d');

const grid = 16;
let count = 0;
let score = 0;

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

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function gameLoop() {
  requestAnimationFrame(gameLoop);

  if (++count < 4) return;

  count = 0;
  context.clearRect(0, 0, canvas.width, canvas.height);

  snake.x += snake.dx;
  snake.y += snake.dy;

  if (snake.x < 0) snake.x = canvas.width - grid;
  else if (snake.x >= canvas.width) snake.x = 0;

  if (snake.y < 0) snake.y = canvas.height - grid;
  else if (snake.y >= canvas.height) snake.y = 0;

  snake.cells.unshift({ x: snake.x, y: snake.y });

  if (snake.cells.length > snake.maxCells) snake.cells.pop();

  context.fillStyle = 'red';
  context.fillRect(apple.x, apple.y, grid - 1, grid - 1);

  context.fillStyle = 'green';
  snake.cells.forEach((cell, index) => {
    context.fillRect(cell.x, cell.y, grid - 1, grid - 1);

    if (cell.x === apple.x && cell.y === apple.y) {
      snake.maxCells++;
      score++;
      apple.x = getRandomInt(0, 25) * grid;
      apple.y = getRandomInt(0, 25) * grid;
    }

    for (let i = index + 1; i < snake.cells.length; i++) {
      if (cell.x === snake.cells[i].x && cell.y === snake.cells[i].y) {
        alert(`Game Over! Score: ${score}`);
        const playerName = prompt("Gib deinen Namen ein:");
        saveScore(playerName, score);
        resetGame();
      }
    }
  });
}

function resetGame() {
  snake.x = 160;
  snake.y = 160;
  snake.cells = [];
  snake.maxCells = 4;
  snake.dx = grid;
  snake.dy = 0;
  score = 0;
}

document.getElementById('keyboard-control').addEventListener('click', () => {
  document.getElementById('menu').style.display = 'none';
  setupKeyboardControls();
  requestAnimationFrame(gameLoop);
});

document.getElementById('touch-control').addEventListener('click', () => {
  document.getElementById('menu').style.display = 'none';
  setupTouchControls();
  requestAnimationFrame(gameLoop);
});

document.getElementById('joystick-control').addEventListener('click', () => {
  document.getElementById('menu').style.display = 'none';
  setupJoystickControls();
  requestAnimationFrame(gameLoop);
});

fetchTopScores().then(scores => {
  const scoreList = document.getElementById('score-list');
  scores.forEach((score, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${score.name}: ${score.score}`;
    scoreList.appendChild(li);
  });
});