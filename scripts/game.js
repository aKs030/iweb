import { saveScore, getTopScores } from './firebase.js';
import { setupKeyboardControls, setupTouchControls, setupJoystickControls } from './controls.js';

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

const scoreDisplay = document.getElementById('score-display');
const menu = document.getElementById('menu');

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
      scoreDisplay.textContent = `Punkte: ${score}`;
      apple.x = getRandomInt(0, 25) * grid;
      apple.y = getRandomInt(0, 25) * grid;
    }

    for (let i = index + 1; i < snake.cells.length; i++) {
      if (cell.x === snake.cells[i].x && cell.y === snake.cells[i].y) {
        endGame();
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
  scoreDisplay.textContent = `Punkte: ${score}`;
}

async function endGame() {
  const playerName = prompt("Name eingeben:");
  if (playerName) await saveScore(playerName, score);
  resetGame();
  displayHighscores();
}

async function displayHighscores() {
  const scores = await getTopScores();
  const scoreList = document.getElementById('score-list');
  scoreList.innerHTML = '';
  scores.forEach((s, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${s.name}: ${s.score}`;
    scoreList.appendChild(li);
  });
}

document.getElementById('keyboard-control').addEventListener('click', () => {
  menu.style.display = 'none';
  setupKeyboardControls(snake);
  requestAnimationFrame(gameLoop);
});

document.getElementById('touch-control').addEventListener('click', () => {
  menu.style.display = 'none';
  setupTouchControls(snake);
  requestAnimationFrame(gameLoop);
});

document.getElementById('joystick-control').addEventListener('click', () => {
  menu.style.display = 'none';
  setupJoystickControls(snake);
  requestAnimationFrame(gameLoop);
});

displayHighscores();