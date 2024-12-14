import { gameState } from "./game.js";

export function setupKeyboardControls() {
  document.addEventListener("keydown", (e) => {
    if (e.which === 37 && gameState.snake.dx === 0) {
      gameState.snake.dx = -gameState.grid;
      gameState.snake.dy = 0;
    } else if (e.which === 38 && gameState.snake.dy === 0) {
      gameState.snake.dy = -gameState.grid;
      gameState.snake.dx = 0;
    } else if (e.which === 39 && gameState.snake.dx === 0) {
      gameState.snake.dx = gameState.grid;
      gameState.snake.dy = 0;
    } else if (e.which === 40 && gameState.snake.dy === 0) {
      gameState.snake.dy = gameState.grid;
      gameState.snake.dx = 0;
    }
  });
}