export const gameState = {
  snake: {
    x: 160,
    y: 160,
    dx: 16,
    dy: 0,
    cells: [],
    maxCells: 4,
  },
  apple: {
    x: 320,
    y: 320,
  },
  score: 0,
  grid: 16,
  count: 0,
};

export function resetGame() {
  gameState.snake.x = 160;
  gameState.snake.y = 160;
  gameState.snake.dx = 16;
  gameState.snake.dy = 0;
  gameState.snake.cells = [];
  gameState.snake.maxCells = 4;
  gameState.apple.x = 320;
  gameState.apple.y = 320;
  gameState.score = 0;
}

export function gameLoop(context, updateScoreCallback, gameOverCallback) {
  requestAnimationFrame(() => gameLoop(context, updateScoreCallback, gameOverCallback));

  if (++gameState.count < 4) return;

  gameState.count = 0;
  context.clearRect(0, 0, 400, 400);

  // Bewegung der Schlange
  gameState.snake.x += gameState.snake.dx;
  gameState.snake.y += gameState.snake.dy;

  // Grenzen
  if (gameState.snake.x < 0) gameState.snake.x = 400 - gameState.grid;
  if (gameState.snake.x >= 400) gameState.snake.x = 0;
  if (gameState.snake.y < 0) gameState.snake.y = 400 - gameState.grid;
  if (gameState.snake.y >= 400) gameState.snake.y = 0;

  // Körper aktualisieren
  gameState.snake.cells.unshift({ x: gameState.snake.x, y: gameState.snake.y });
  if (gameState.snake.cells.length > gameState.snake.maxCells) gameState.snake.cells.pop();

  // Apfel zeichnen
  context.fillStyle = "red";
  context.fillRect(gameState.apple.x, gameState.apple.y, gameState.grid - 1, gameState.grid - 1);

  // Schlange zeichnen
  context.fillStyle = "green";
  gameState.snake.cells.forEach((cell, index) => {
    context.fillRect(cell.x, cell.y, gameState.grid - 1, gameState.grid - 1);

    // Apfel gegessen
    if (cell.x === gameState.apple.x && cell.y === gameState.apple.y) {
      gameState.snake.maxCells++;
      gameState.score++;
      updateScoreCallback(gameState.score);

      gameState.apple.x = Math.floor(Math.random() * 25) * gameState.grid;
      gameState.apple.y = Math.floor(Math.random() * 25) * gameState.grid;
    }

    // Kollision mit sich selbst
    for (let i = index + 1; i < gameState.snake.cells.length; i++) {
      if (cell.x === gameState.snake.cells[i].x && cell.y === gameState.snake.cells[i].y) {
        gameOverCallback(gameState.score);
        resetGame();
      }
    }
  });
}