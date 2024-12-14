export function setupKeyboardControls(snake) {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && snake.dx === 0) {
      snake.dx = -16;
      snake.dy = 0;
    } else if (e.key === 'ArrowUp' && snake.dy === 0) {
      snake.dy = -16;
      snake.dx = 0;
    } else if (e.key === 'ArrowRight' && snake.dx === 0) {
      snake.dx = 16;
      snake.dy = 0;
    } else if (e.key === 'ArrowDown' && snake.dy === 0) {
      snake.dy = 16;
      snake.dx = 0;
    }
  });
}

export function setupTouchControls(snake) {
  let startX, startY;

  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  });

  canvas.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;

    const dx = endX - startX;
    const dy = endY - startY;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && snake.dx === 0) {
        snake.dx = 16;
        snake.dy = 0;
      } else if (dx < 0 && snake.dx === 0) {
        snake.dx = -16;
        snake.dy = 0;
      }
    } else {
      if (dy > 0 && snake.dy === 0) {
        snake.dy = 16;
        snake.dx = 0;
      } else if (dy < 0 && snake.dy === 0) {
        snake.dy = -16;
        snake.dx = 0;
      }
    }
  });
}

export function setupJoystickControls(snake) {
  document.getElementById('joystick-container').style.display = 'block';

  document.querySelectorAll('#joystick-container button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = btn.getAttribute('data-dir');
      if (dir === 'up' && snake.dy === 0) {
        snake.dy = -16;
        snake.dx = 0;
      } else if (dir === 'down' && snake.dy === 0) {
        snake.dy = 16;
        snake.dx = 0;
      } else if (dir === 'left' && snake.dx === 0) {
        snake.dx = -16;
        snake.dy = 0;
      } else if (dir === 'right' && snake.dx === 0) {
        snake.dx = 16;
        snake.dy = 0;
      }
    });
  });
}