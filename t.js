document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('tetris');
    const context = canvas.getContext('2d');

    let columns = 10;
    let rows = 20;
    let cellSizeX;
    let cellSizeY;

    function handleResize() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        canvas.width = width;
        canvas.height = height;

        cellSizeX = canvas.width / columns;
        cellSizeY = canvas.height / rows;

        draw();
    }

    // Beim Laden und bei Fensteränderung aktualisieren
    handleResize();
    window.addEventListener('resize', handleResize);

    function drawCell(x, y, color) {
        context.fillStyle = color;
        context.fillRect(x * cellSizeX, y * cellSizeY, cellSizeX, cellSizeY);
    }

    const SHAPES = {
        'T': [
            [0, 1, 0],
            [1, 1, 1],
            [0, 0, 0]
        ],
        'O': [
            [1, 1],
            [1, 1]
        ],
        'L': [
            [1, 0, 0],
            [1, 0, 0],
            [1, 1, 0]
        ],
        'J': [
            [0, 0, 1],
            [0, 0, 1],
            [0, 1, 1]
        ],
        'I': [
            [0, 1, 0, 0],
            [0, 1, 0, 0],
            [0, 1, 0, 0],
            [0, 1, 0, 0],
        ],
        'S': [
            [0, 1, 1],
            [1, 1, 0],
            [0, 0, 0]
        ],
        'Z': [
            [1, 1, 0],
            [0, 1, 1],
            [0, 0, 0]
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

    const arena = createMatrix(columns, rows); 
    let dropCounter = 0;
    let dropInterval = 1000;
    let lastTime = 0;
    let gameActive = false;

    const player = {
        pos: { x: 0, y: 0 },
        matrix: null
    };

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

    function drawMatrix(matrix, offset) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    drawCell(x + offset.x, y + offset.y, COLORS[value]);
                }
            });
        });
    }

    function draw() {
        if (!canvas.width || !canvas.height) return;
        context.fillStyle = '#000';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Arena
        for (let y = 0; y < arena.length; y++) {
            for (let x = 0; x < arena[y].length; x++) {
                if (arena[y][x] !== 0) {
                    drawCell(x, y, COLORS[arena[y][x]]);
                }
            }
        }

        // Aktueller Stein
        if (player.matrix) {
            drawMatrix(player.matrix, player.pos);
        }
    }

    function playerReset() {
        const pieces = 'ILJOTSZ';
        const piece = pieces[pieces.length * Math.random() | 0];
        player.matrix = createPiece(piece);
        player.pos.y = 0;
        player.pos.x = (arena[0].length / 2 | 0) -
            (player.matrix[0].length / 2 | 0);

        if (collide(arena, player)) {
            // Spiel beenden, da kein Platz mehr
            arena.forEach(row => row.fill(0));
            gameActive = false;
        }
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
            arenaSweep();
            playerReset();
        }
        dropCounter = 0;
    }

    function arenaSweep() {
        outer: for (let y = arena.length - 1; y > 0; y--) {
            for (let x = 0; x < arena[y].length; x++) {
                if (arena[y][x] === 0) {
                    continue outer;
                }
            }
            const row = arena.splice(y, 1)[0].fill(0);
            arena.unshift(row);
            y++;
        }
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
