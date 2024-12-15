import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSy...",
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

async function saveScore(name, score) {
  try {
    await addDoc(collection(db, 'scores'), { name, score, timestamp: new Date() });
    fetchScores();
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
  }
}

async function fetchScores() {
  const q = query(collection(db, 'scores'), orderBy('score', 'desc'), limit(3));
  const snapshot = await getDocs(q);
  const scores = [];
  snapshot.forEach(doc => scores.push(doc.data()));

  const scoreList = document.getElementById('score-list');
  scoreList.innerHTML = '';
  scores.forEach(s => {
    const li = document.createElement('li');
    li.textContent = `${s.name}: ${s.score}`;
    scoreList.appendChild(li);
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

function gameLoop() {
  requestAnimationFrame(gameLoop);

  if (++count < 4) return;
  count = 0;

  context.clearRect(0, 0, canvas.width, canvas.height);
  snake.x += snake.dx;
  snake.y += snake.dy;

  if (snake.x < 0) snake.x = canvas.width - grid;
  if (snake.x >= canvas.width) snake.x = 0;
  if (snake.y < 0) snake.y = canvas.height - grid;
  if (snake.y >= canvas.height) snake.y = 0;

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
      apple.x = Math.floor(Math.random() * 25) * grid;
      apple.y = Math.floor(Math.random() * 25) * grid;
    }

    for (let i = index + 1; i < snake.cells.length; i++) {
      if (cell.x === snake.cells[i].x && cell.y === snake.cells[i].y) {
        const playerName = prompt("Game Over! Dein Name:");
        if (playerName) saveScore(playerName, score);
        resetGame();
      }
    }
  });
}

function setupKeyboardControls() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && snake.dx === 0) { snake.dx = -grid; snake.dy = 0; }
    if (e.key === 'ArrowUp' && snake.dy === 0) { snake.dy = -grid; snake.dx = 0; }
    if (e.key === 'ArrowRight' && snake.dx === 0) { snake.dx = grid; snake.dy = 0; }
    if (e.key === 'ArrowDown' && snake.dy === 0) { snake.dy = grid; snake.dx = 0; }
  });
}

// Steuerungsauswahl
document.getElementById('keyboard-control').addEventListener('click', () => {
  document.getElementById('menu').style.display = 'none';
  setupKeyboardControls();
  gameLoop();
});

fetchScores();