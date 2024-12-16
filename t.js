document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM geladen, starte Setup...");
    const canvas = document.getElementById('tetris');
    const context = canvas.getContext('2d');

    const nextCanvas = document.getElementById('next');
    const nextCtx = nextCanvas.getContext('2d');

    const columns = 10;
    const rows = 20;
    let cellSizeX;
    let cellSizeY;

    let nextCellSize = 20; 
    const NEXT_COLUMNS = 4;
    const NEXT_ROWS = 4;

    let arena;
    let player;
    let dropCounter;
    let dropInterval;
    let lastTime;
    let gameActive;

    let score = 0;
    let level = 1;
    let linesCleared = 0;

    const scoreEl = document.getElementById('score');
    const levelEl = document.getElementById('level');
    const linesEl = document.getElementById('lines');

    const pieces = 'ILJOTSZ';

    const SHAPES = {
        'T': [
            [0,0,0,0],
            [0,1,0,0],
            [1,1,1,0],
            [0,0,0,0]
        ],
        'O': [
            [0,0,0,0],
            [0,1,1,0],
            [0,1,1,0],
            [0,0,0,0]
        ],
        'L': [
            [0,0,0,0],
            [1,0,0,0],
            [1,0,0,0],
            [1,1,0,0]
        ],
        'J': [
            [0,0,0,0],
            [0,0,1,0],
            [0,0,1,0],
            [0,1,1,0]
        ],
        'I': [
            [0,1,0,0],
            [0,1,0,0],
            [0,1,0,0],
            [0,1,0,0]
        ],
        'S': [
            [0,0,0,0],
            [0,1,1,0],
            [1,1,0,0],
            [0,0,0,0]
        ],
        'Z': [
            [0,0,0,0],
            [1,1,0,0],
            [0,1,1,0],
            [0,0,0,0]
        ]
    };
    
    

    const COLORS = [
        null,
        '#FF0D72',
        '#0DC2FF',
        '#0DFF72',
        '#F538FF',
        '#FF8E0D',
        '#FFE138',
        '#3877FF'
    ];

    function handleResize() {
        const aspect = rows / columns;
        const dpr = window.devicePixelRatio || 1;

        const availableWidth = window.innerWidth * 0.5;
        const availableHeight = window.innerHeight * 0.5;
        
        let canvasWidth = availableWidth;
        let canvasHeight = canvasWidth * aspect;

        if (canvasHeight > availableHeight) {
            canvasHeight = availableHeight;
            canvasWidth = canvasHeight / aspect;
        }

        // Runde auf ganze Pixel
        canvasWidth = Math.floor(canvasWidth);
        canvasHeight = Math.floor(canvasHeight);

        // CSS-Größe setzen
        canvas.style.width = canvasWidth + 'px';
        canvas.style.height = canvasHeight + 'px';

        // Interne Auflösung mit devicePixelRatio
        canvas.width = Math.floor(canvasWidth * dpr);
        canvas.height = Math.floor(canvasHeight * dpr);

        // Kontext skalieren
        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        cellSizeX = (canvas.width / dpr) / columns;
        cellSizeY = (canvas.height / dpr) / rows;
        
        draw();
    }

    window.addEventListener('resize', handleResize);

    function createMatrix(w, h) {
        const matrix = [];
        for (let i = 0; i < h; i++) {
            matrix.push(new Array(w).fill(0));
        }
        return matrix;
    }

    function collide(arena, player) {
        const m = player.matrix;
        const o = player.pos;
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0 &&
                    (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }

    function merge(arena, player) {
        player.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    arena[y + player.pos.y][x + player.pos.x] = value;
                }
            });
        });
    }

    function drawCell(ctx, x, y, sizeX, sizeY, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * sizeX, y * sizeY, sizeX, sizeY);
    }

    function drawMatrix(ctx, matrix, offsetX, offsetY, sizeX, sizeY) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    drawCell(ctx, x + offsetX, y + offsetY, sizeX, sizeY, COLORS[value]);
                }
            });
        });
    }

    function draw() {
        if (!canvas.width || !canvas.height) return;
        context.fillStyle = '#000';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Arena zeichnen
        for (let y = 0; y < arena.length; y++) {
            for (let x = 0; x < arena[y].length; x++) {
                if (arena[y][x] !== 0) {
                    drawCell(context, x, y, cellSizeX, cellSizeY, COLORS[arena[y][x]]);
                }
            }
        }

        // Aktueller Stein
        if (player.matrix) {
            drawMatrix(context, player.matrix, player.pos.x, player.pos.y, cellSizeX, cellSizeY);
        }

        // Nächstes Teil zeichnen
        drawNextPiece();
    }

    function drawNextPiece() {
        nextCtx.fillStyle = '#000';
        nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
        if (!player.nextMatrix) return;
        const offsetX = (NEXT_COLUMNS / 2 | 0) - (player.nextMatrix[0].length / 2 | 0);
        const offsetY = (NEXT_ROWS / 2 | 0) - (player.nextMatrix.length / 2 | 0);
        drawMatrix(nextCtx, player.nextMatrix, offsetX, offsetY, nextCellSize, nextCellSize);
    }

    function createPiece(type) {
        const shape = SHAPES[type];
        const matrix = shape.map(row => row.map(value => value ? 1 : 0));
        const colorIndex = (Math.random() * (COLORS.length - 1) | 0) + 1;
        for (let y = 0; y < matrix.length; y++) {
            for (let x = 0; x < matrix[y].length; x++) {
                if (matrix[y][x] !== 0) {
                    matrix[y][x] = colorIndex;
                }
            }
        }
        return matrix;
    }

    function playerDrop() {
        player.pos.y++;
        if (collide(arena, player)) {
            player.pos.y--;
            merge(arena, player);
            let cleared = arenaSweep();
            addScore(cleared);
            playerReset();
        }
        dropCounter = 0;
    }

    function arenaSweep() {
        let rowCount = 1;
        let cleared = 0;
        outer: for (let y = arena.length - 1; y >= 0; y--) {
            for (let x = 0; x < arena[y].length; x++) {
                if (arena[y][x] === 0) {
                    continue outer;
                }
            }
            const row = arena.splice(y, 1)[0].fill(0);
            arena.unshift(row);
            y++;
            cleared += rowCount;
        }
        return cleared;
    }

    function addScore(lines) {
        if (lines > 0) {
            const points = [40, 100, 300, 1200];
            score += points[lines - 1] * level;
            linesCleared += lines;
            if (linesCleared >= level * 10) {
                level++;
                dropInterval = Math.max(100, dropInterval - 100);
            }
            updateScoreboard();
        }
    }

    function updateScoreboard() {
        scoreEl.textContent = score;
        levelEl.textContent = level;
        linesEl.textContent = linesCleared;
    }

    function playerMove(dir) {
        player.pos.x += dir;
        if (collide(arena, player)) {
            player.pos.x -= dir;
        }
    }

    function playerRotate(dir) {
        const pos = player.pos.x;
        let offset = 1;
        rotate(player.matrix, dir);
        while (collide(arena, player)) {
            player.pos.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > player.matrix[0].length) {
                rotate(player.matrix, -dir);
                player.pos.x = pos;
                return;
            }
        }
    }

    function rotate(matrix, dir) {
        for (let y = 0; y < matrix.length; y++) {
          for (let x = 0; x < y; x++) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
          }
        }
        if (dir > 0) {
          matrix.forEach(row => row.reverse());
        } else {
          matrix.reverse();
        }
      }
      function playerRotate(dir) {
        const pos = player.pos.x;
        let offset = 1;
        rotate(player.matrix, dir);
        while (collide(arena, player)) {
          player.pos.x += offset;
          offset = -(offset + (offset > 0 ? 1 : -1));
          if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
          }
        }
      }
      

    function playerReset() {
        if (player.nextMatrix) {
            player.matrix = player.nextMatrix;
        } else {
            player.matrix = randomPiece();
        }
        player.nextMatrix = randomPiece();

        player.pos.y = 0;
        player.pos.x = (arena[0].length / 2 | 0) -
                       (player.matrix[0].length / 2 | 0);

        if (collide(arena, player)) {
            console.log("Game Over");
            gameActive = false;
        }
    }

    function randomPiece() {
        const piece = pieces[pieces.length * Math.random() | 0];
        return createPiece(piece);
    }

    function update(time = 0) {
        if (!gameActive) return; 
        const deltaTime = time - lastTime;
        lastTime = time;

        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            playerDrop();
        }

        draw();
        requestAnimationFrame(update);
    }

    function initGame() {
        console.log("initGame aufgerufen");
        arena = createMatrix(columns, rows);
        score = 0;
        level = 1;
        linesCleared = 0;
        updateScoreboard();
        player = {
            pos: { x:0, y:0 },
            matrix: null,
            nextMatrix: null
        };
        dropInterval = 1000;
        dropCounter = 0;
        lastTime = 0;
        gameActive = true;
        playerReset();
        handleResize();
        update();
    }

    document.getElementById('startBtn').addEventListener('click', () => {
        console.log("Start-Button geklickt");
        initGame();
    });

    document.getElementById('leftBtn').addEventListener('click', () => {
        if (gameActive) playerMove(-1);
        draw();
    });
    document.getElementById('rightBtn').addEventListener('click', () => {
        if (gameActive) playerMove(1);
        draw();
    });
    document.getElementById('rotateBtn').addEventListener('click', () => {
        if (gameActive) playerRotate(1);
        draw();
    });
    document.getElementById('dropBtn').addEventListener('click', () => {
        if (gameActive) playerDrop();
        draw();
    });
    document.getElementById('fallBtn').addEventListener('click', () => {
        if (gameActive) {
            while(!collide(arena, player)){
                player.pos.y++;
            }
            player.pos.y--;
            merge(arena, player);
            let cleared = arenaSweep();
            addScore(cleared);
            playerReset();
            draw();
        }
    });

    // Tastatursteuerung mit preventDefault
    document.addEventListener('keydown', event => {
        if (!gameActive) return;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
            event.preventDefault();
        }
        if (event.key === 'ArrowLeft') {
            playerMove(-1);
        } else if (event.key === 'ArrowRight') {
            playerMove(1);
        } else if (event.key === 'ArrowDown') {
            playerDrop();
        } else if (event.key === 'ArrowUp') {
            playerRotate(1);
        } else if (event.key === ' ') {
            // Hard drop
            while(!collide(arena, player)){
                player.pos.y++;
            }
            player.pos.y--;
            merge(arena, player);
            let cleared = arenaSweep();
            addScore(cleared);
            playerReset();
        }
        draw();
    });

    // Initiales Rendering (Leeres Feld, bevor gestartet wird)
    handleResize();
    draw();
});
