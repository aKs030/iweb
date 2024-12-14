<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Snake Game</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      background: black;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    canvas {
      border: 1px solid white;
    }

    #menu {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      text-align: center;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    #joystick-container {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      flex-direction: column;
      align-items: center;
    }

    #joystick-container button {
      background: #333;
      color: white;
      border: none;
      padding: 10px;
      margin: 5px;
      font-size: 20px;
      border-radius: 5px;
      cursor: pointer;
    }

    #joystick-container button:active {
      background: #555;
    }

    #joystick-container .row {
      display: flex;
      justify-content: center;
    }
  </style>
</head>
<body>
  <canvas id="game" width="400" height="400"></canvas>
  <div id="menu">
    <h2>Wähle eine Steuerung</h2>
    <button id="keyboard-control">Tastatur</button>
    <button id="touch-control">Touchscreen</button>
    <button id="joystick-control">Joystick</button>
  </div>
  <div id="joystick-container">
    <button data-dir="up">⬆</button>
    <div class="row">
      <button data-dir="left">⬅</button>
      <button data-dir="right">➡</button>
    </div>
    <button data-dir="down">⬇</button>
  </div>

  <script>
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
    function setupKeyboardControls() {
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
    }

    // Touchscreen-Steuerung
    function setupTouchControls() {
      let touchStartX = 0;
      let touchStartY = 0;

      canvas.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          const touch = e.touches[0];
          touchStartX = touch.clientX;
          touchStartY = touch.clientY;
        },
        { passive: false }
      );

      canvas.addEventListener(
        'touchend',
        (e) => {
          e.preventDefault();
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
        },
        { passive: false }
      );
    }

    // Joystick-Steuerung
    function setupJoystickControls() {
      const joystick = document.getElementById('joystick-container');
      joystick.style.display = 'flex';

      joystick.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const direction = e.target.getAttribute('data-dir');

          if (direction === 'up' && snake.dy === 0) {
            snake.dx = 0;
            snake.dy = -grid;
          } else if (direction === 'down' && snake.dy === 0) {
            snake.dx = 0;
            snake.dy = grid;
          } else if (direction === 'left' && snake.dx === 0) {
            snake.dx = -grid;
            snake.dy = 0;
          } else if (direction === 'right' && snake.dx === 0) {
            snake.dx = grid;
            snake.dy = 0;
          }
        });
      });
    }

    // Menülogik
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
  </script>
</body>
</html>