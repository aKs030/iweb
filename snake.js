import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// Firebase-Konfiguration
const firebaseConfig = { /* Ihre Firebase-Details */ };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Elemente
const canvas = document.getElementById('game');
const context = canvas.getContext('2d');
const scoreBoard = document.getElementById('score-board');
const menu = document.getElementById('menu');
const settingsMenu = document.getElementById('settings-menu');
let grid = 16, count = 0, score = 0, lastInputTime = 0, gameSpeed = 5;

// Snake & Apfel
const snake = { x: 160, y: 160, dx: grid, dy: 0, cells: [], maxCells: 4 };
const apple = { x: 320, y: 320 };
let achievements = [];

// Soundeffekte
const eatSound = new Audio('sounds/eat.mp3');
const gameOverSound = new Audio('sounds/gameover.mp3');

// Canvas-Größe
function resizeCanvas() {
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.8;
    canvas.width = size - (size % grid);
    canvas.height = size - (size % grid);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Spiel zurücksetzen
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

// Highscores
async function saveScore(name, score) {
    await addDoc(collection(db, "scores"), { name, score, timestamp: new Date() });
    fetchScores();
}
async function fetchScores() {
    const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(3));
    const querySnapshot = await getDocs(q);
    console.log("Highscores:", querySnapshot.docs.map(doc => doc.data()));
}

// Hauptspiel-Schleife
function gameLoop() {
    requestAnimationFrame(gameLoop);
    if (++count < gameSpeed) return;
    count = 0;

    context.clearRect(0, 0, canvas.width, canvas.height);
    snake.x += snake.dx;
    snake.y += snake.dy;

    // Wand-Kollision (Teleport)
    if (snake.x < 0) snake.x = canvas.width - grid;
    else if (snake.x >= canvas.width) snake.x = 0;
    if (snake.y < 0) snake.y = canvas.height - grid;
    else if (snake.y >= canvas.height) snake.y = 0;

    // Snake-Logik
    snake.cells.unshift({ x: snake.x, y: snake.y });
    if (snake.cells.length > snake.maxCells) snake.cells.pop();

    // Apfel zeichnen
    context.fillStyle = 'red';
    context.fillRect(apple.x, apple.y, grid - 1, grid - 1);

    // Snake zeichnen & Kollision prüfen
    context.fillStyle = 'green';
    snake.cells.forEach((cell, index) => {
        context.fillRect(cell.x, cell.y, grid - 1, grid - 1);

        if (cell.x === apple.x && cell.y === apple.y) {
            eatSound.play();
            snake.maxCells++;
            score++;
            scoreBoard.textContent = `Punkte: ${score}`;
            apple.x = Math.floor(Math.random() * (canvas.width / grid)) * grid;
            apple.y = Math.floor(Math.random() * (canvas.height / grid)) * grid;

            // Achievement prüfen
            if (score === 10) achievements.push("10 Äpfel gegessen!");
        }

        for (let i = index + 1; i < snake.cells.length; i++) {
            if (cell.x === snake.cells[i].x && cell.y === snake.cells[i].y) {
                gameOverSound.play();
                const name = prompt("Game Over! Dein Name:");
                if (name) saveScore(name, score);
                resetGame();
            }
        }
    });
}

// Steuerung
document.addEventListener('keydown', (e) => {
    const now = Date.now();
    if (now - lastInputTime < 100) return;
    lastInputTime = now;

    if (e.key === "ArrowLeft" && snake.dx === 0) { snake.dx = -grid; snake.dy = 0; }
    else if (e.key === "ArrowUp" && snake.dy === 0) { snake.dy = -grid; snake.dx = 0; }
    else if (e.key === "ArrowRight" && snake.dx === 0) { snake.dx = grid; snake.dy = 0; }
    else if (e.key === "ArrowDown" && snake.dy === 0) { snake.dy = grid; snake.dx = 0; }
});

// Einstellungen
document.getElementById('open-settings').addEventListener('click', () => {
    menu.style.display = 'none';
    settingsMenu.style.display = 'block';
});
document.getElementById('apply-settings').addEventListener('click', () => {
    gameSpeed = 11 - document.getElementById('speed').value;
    settingsMenu.style.display = 'none';
    menu.style.display = 'block';
});

// Startspiel
document.getElementById('start-game').addEventListener('click', () => {
    menu.style.display = 'none';
    resetGame();
    requestAnimationFrame(gameLoop);
});
