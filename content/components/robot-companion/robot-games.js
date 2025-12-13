export class RobotGames {
  constructor(robot) {
    this.robot = robot;
    this.state = {
      ticTacToe: { board: Array(9).fill(null), playerSymbol: 'X', botSymbol: 'O' },
      triviaScore: parseInt(localStorage.getItem('robot-trivia-score') || '0'),
      guessNumber: null,
      guessNumberActive: false,
      currentTrivia: null,
    };
  }

  // --- Tic Tac Toe ---

  startTicTacToe() {
    this.state.ticTacToe.board = Array(9).fill(null);
    this.robot.addMessage('🎮 Tic-Tac-Toe! Du bist X, ich bin O. Viel Glück! 😎', 'bot');

    const gameContainer = document.createElement('div');
    gameContainer.className = 'tic-tac-toe-game';

    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('button');
      cell.className = 'ttt-cell';
      cell.onclick = () => this.playTicTacToeMove(i, gameContainer);
      gameContainer.appendChild(cell);
    }

    this.robot.dom.messages.appendChild(gameContainer);
    this.robot.scrollToBottom();
  }

  playTicTacToeMove(index, gameContainer) {
    if (this.state.ticTacToe.board[index]) return;

    // Player move
    this.state.ticTacToe.board[index] = 'X';
    gameContainer.children[index].textContent = 'X';
    gameContainer.children[index].style.cursor = 'not-allowed';

    if (this.checkTicTacToeWin('X')) {
      this.robot.addMessage('🏆 Du hast gewonnen! Glückwunsch! 🎉', 'bot');
      this.disableTicTacToeBoard(gameContainer);
      setTimeout(() => this.robot.handleAction('games'), 2000);
      return;
    }

    if (this.state.ticTacToe.board.every((cell) => cell !== null)) {
      this.robot.addMessage('🤝 Unentschieden! Gut gespielt!', 'bot');
      setTimeout(() => this.robot.handleAction('games'), 2000);
      return;
    }

    // Bot move
    setTimeout(() => {
      const botMove = this.getBotTicTacToeMove();
      if (botMove !== -1) {
        this.state.ticTacToe.board[botMove] = 'O';
        gameContainer.children[botMove].textContent = 'O';
        gameContainer.children[botMove].style.cursor = 'not-allowed';

        if (this.checkTicTacToeWin('O')) {
          this.robot.addMessage('🤖 Ich habe gewonnen! Nochmal versuchen? 😏', 'bot');
          this.disableTicTacToeBoard(gameContainer);
          setTimeout(() => this.robot.handleAction('games'), 2000);
          return;
        }

        if (this.state.ticTacToe.board.every((cell) => cell !== null)) {
          this.robot.addMessage('🤝 Unentschieden! Gut gespielt!', 'bot');
          setTimeout(() => this.robot.handleAction('games'), 2000);
        }
      }
    }, 500);
  }

  getBotTicTacToeMove() {
    const board = this.state.ticTacToe.board;

    // Check for winning move
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'O';
        if (this.checkTicTacToeWin('O')) {
          board[i] = null;
          return i;
        }
        board[i] = null;
      }
    }

    // Block player winning move
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'X';
        if (this.checkTicTacToeWin('X')) {
          board[i] = null;
          return i;
        }
        board[i] = null;
      }
    }

    // Take center if available
    if (!board[4]) return 4;

    // Take random available spot
    const available = board
      .map((cell, idx) => (cell === null ? idx : null))
      .filter((idx) => idx !== null);
    return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : -1;
  }

  checkTicTacToeWin(symbol) {
    const board = this.state.ticTacToe.board;
    const winPatterns = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    return winPatterns.some((pattern) => pattern.every((idx) => board[idx] === symbol));
  }

  disableTicTacToeBoard(gameContainer) {
    Array.from(gameContainer.children).forEach((cell) => {
      cell.style.cursor = 'not-allowed';
      cell.onclick = null;
    });
  }

  // --- Trivia ---

  startTrivia() {
    const questions = [
      {
        q: 'Welches Jahr wurde JavaScript veröffentlicht?',
        options: ['1995', '1999', '2005', '1991'],
        answer: 0,
      },
      {
        q: 'Was bedeutet HTML?',
        options: [
          'Hyper Text Markup Language',
          'High Tech Modern Language',
          'Home Tool Markup Language',
          'Hyperlinks and Text Markup Language',
        ],
        answer: 0,
      },
      {
        q: 'Welcher Planet ist der größte im Sonnensystem?',
        options: ['Saturn', 'Jupiter', 'Uranus', 'Neptun'],
        answer: 1,
      },
      {
        q: 'In welchem Jahr fiel die Berliner Mauer?',
        options: ['1987', '1989', '1991', '1985'],
        answer: 1,
      },
      {
        q: 'Was ist die Geschwindigkeit des Lichts?',
        options: ['300.000 km/s', '150.000 km/s', '450.000 km/s', '200.000 km/s'],
        answer: 0,
      },
    ];

    const question = questions[Math.floor(Math.random() * questions.length)];
    this.state.currentTrivia = question;

    this.robot.addMessage(`🧠 Trivia-Quiz! Score: ${this.state.triviaScore}`, 'bot');
    this.robot.addMessage(question.q, 'bot');

    const options = question.options.map((opt, idx) => ({
      label: opt,
      action: `triviaAnswer_${idx}`,
    }));

    this.robot.addOptions(options);
  }

  handleTriviaAnswer(answerIdx) {
    if (!this.state.currentTrivia) return;

    const correct = answerIdx === this.state.currentTrivia.answer;

    if (correct) {
      this.state.triviaScore++;
      localStorage.setItem('robot-trivia-score', this.state.triviaScore);
      this.robot.addMessage('✅ Richtig! Sehr gut! 🎉', 'bot');

      if (this.state.triviaScore === 5 && !this.robot.easterEggFound.has('trivia-master')) {
        this.robot.unlockEasterEgg(
          'trivia-master',
          '🧠 Trivia-Master! 5 richtige Antworten! Du bist ein Genie! 🏆',
        );
      }
    } else {
      this.robot.addMessage(
        `❌ Leider falsch! Die richtige Antwort war: ${this.state.currentTrivia.options[this.state.currentTrivia.answer]}`,
        'bot',
      );
    }

    setTimeout(() => {
      this.robot.addMessage('Noch eine Frage?', 'bot');
      this.robot.addOptions([
        { label: 'Ja, weiter!', action: 'playTrivia' },
        { label: 'Zurück', action: 'games' },
      ]);
    }, 1500);
  }

  // --- Number Guessing ---

  startGuessNumber() {
    this.state.guessNumber = {
      target: Math.floor(Math.random() * 100) + 1,
      attempts: 0,
      maxAttempts: 7,
    };

    this.robot.addMessage(
      '🎲 Zahlenraten! Ich denke an eine Zahl zwischen 1 und 100. Du hast 7 Versuche!',
      'bot',
    );
    this.robot.addMessage('Gib eine Zahl ein:', 'bot');

    // Override next input
    this.state.guessNumberActive = true;
  }

  handleGuessNumber(guess) {
    if (!this.state.guessNumberActive) return;

    const num = parseInt(guess);
    if (isNaN(num) || num < 1 || num > 100) {
      this.robot.addMessage('⚠️ Bitte eine Zahl zwischen 1 und 100 eingeben!', 'bot');
      return;
    }

    this.state.guessNumber.attempts++;
    const { target, attempts, maxAttempts } = this.state.guessNumber;

    if (num === target) {
      this.robot.addMessage(
        `🎉 Richtig! Die Zahl war ${target}! Du hast ${attempts} Versuche gebraucht! 🏆`,
        'bot',
      );
      this.state.guessNumberActive = false;

      if (attempts <= 3 && !this.robot.easterEggFound.has('lucky-guesser')) {
        this.robot.unlockEasterEgg(
          'lucky-guesser',
          '🍀 Lucky Guesser! In 3 oder weniger Versuchen! Unglaublich! 🎯',
        );
      }

      setTimeout(() => this.robot.handleAction('games'), 2000);
    } else if (attempts >= maxAttempts) {
      this.robot.addMessage(`😅 Keine Versuche mehr! Die Zahl war ${target}. Nochmal?`, 'bot');
      this.state.guessNumberActive = false;
      setTimeout(() => this.robot.handleAction('games'), 2000);
    } else {
      const hint = num < target ? '📈 Zu niedrig!' : '📉 Zu hoch!';
      this.robot.addMessage(`${hint} Versuche übrig: ${maxAttempts - attempts}`, 'bot');
    }
  }
}
