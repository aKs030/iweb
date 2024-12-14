import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAdkQKbKU854FSaXIttjg30xh4DVGdj-Es",
  authDomain: "snake-ed264.firebaseapp.com",
  projectId: "snake-ed264",
  storageBucket: "snake-ed264.firebasestorage.app",
  messagingSenderId: "95766919512",
  appId: "1:95766919512:web:78498968a8383721cecd2d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

const scoreBoard = document.getElementById('score-board');
const menu = document.getElementById('menu');
const joystickContainer = document.getElementById('joystick-container');

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
      scoreBoard.textContent = `Punkte: ${score}`;
      apple.x = getRandomInt(0, 25) * grid;
      apple.y = getRandomInt(0, 25) * grid;
    }

    for (let i = index + 1; i < snake.cells.length; i++) {
      if (cell.x === snake.cells[i].x && cell.y === snake.cells[i].y) {
        saveScore(score);
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
  scoreBoard.textContent = `Punkte: ${score}`;
}

async function saveScore(score) {
  const name = prompt("Gib deinen Namen ein:");
  if (name) {
    await addDoc(collection(db, "scores"), { name, score });
    fetchScores();
  }
}

async function fetchScores() {
  const scoresList = document.getElementById("score-list");
  scoresList.innerHTML = "<li>Lade Highscores...</li>";

  const scores = [];
  const querySnapshot = await getDocs(collection(db, "scores"));
  querySnapshot.forEach(doc => scores.push({ name: doc.data().name, score: doc.data().score }));
  scores.sort((a, b) => b.score - a.score);

  scoresList.innerHTML = scores.slice(0, 3).map(s => `<li>${s.name}: ${s.score}</li>`).join("");
}

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

function setupTouchControls() {
  let touchStartX, touchStartY;

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;

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

document.getElementById('keyboard-control').addEventListener('click', () => {
  menu.style.display = 'none';
  setupKeyboardControls();
  requestAnimationFrame(gameLoop);
});

document.getElementById('touch-control').addEventListener('click', () => {
  menu.style.display = 'none';
  setupTouchControls();
  requestAnimationFrame(gameLoop);
});

document.getElementById('joystick-control').addEventListener('click', () => {
  menu.style.display = 'none';
  joystickContainer.style.display = 'block';
  requestAnimationFrame(gameLoop);
});

fetchScores();