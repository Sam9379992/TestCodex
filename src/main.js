import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

const { createElement: h } = React;

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const EMPTY_CELL = 0;
const DROP_INTERVAL = 700;
const FAST_DROP_INTERVAL = 60;

const SHAPES = {
  I: {
    color: '#37c5f0',
    rotations: [
      [[1, 1, 1, 1]],
      [[1], [1], [1], [1]],
    ],
  },
  O: {
    color: '#f0d537',
    rotations: [
      [
        [1, 1],
        [1, 1],
      ],
    ],
  },
  T: {
    color: '#b15cff',
    rotations: [
      [[0, 1, 0], [1, 1, 1]],
      [[1, 0], [1, 1], [1, 0]],
      [[1, 1, 1], [0, 1, 0]],
      [[0, 1], [1, 1], [0, 1]],
    ],
  },
  S: {
    color: '#5de28b',
    rotations: [
      [[0, 1, 1], [1, 1, 0]],
      [[1, 0], [1, 1], [0, 1]],
    ],
  },
  Z: {
    color: '#ff6b6b',
    rotations: [
      [[1, 1, 0], [0, 1, 1]],
      [[0, 1], [1, 1], [1, 0]],
    ],
  },
  J: {
    color: '#4d8bff',
    rotations: [
      [[1, 0, 0], [1, 1, 1]],
      [[1, 1], [1, 0], [1, 0]],
      [[1, 1, 1], [0, 0, 1]],
      [[0, 1], [0, 1], [1, 1]],
    ],
  },
  L: {
    color: '#ff9f43',
    rotations: [
      [[0, 0, 1], [1, 1, 1]],
      [[1, 0], [1, 0], [1, 1]],
      [[1, 1, 1], [1, 0, 0]],
      [[1, 1], [0, 1], [0, 1]],
    ],
  },
};

const PIECE_TYPES = Object.keys(SHAPES);
const createBoard = () => Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(EMPTY_CELL));
const randomType = () => PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
const createPiece = (type = randomType()) => ({ type, rotation: 0, x: Math.floor(BOARD_WIDTH / 2) - 2, y: 0 });
const getMatrix = (piece) => SHAPES[piece.type].rotations[piece.rotation];

const isValidPosition = (board, piece, x = piece.x, y = piece.y, rotation = piece.rotation) => {
  const matrix = SHAPES[piece.type].rotations[rotation];

  return matrix.every((row, rowIndex) =>
    row.every((cell, colIndex) => {
      if (!cell) return true;
      const nextX = x + colIndex;
      const nextY = y + rowIndex;
      if (nextX < 0 || nextX >= BOARD_WIDTH || nextY >= BOARD_HEIGHT) return false;
      if (nextY < 0) return true;
      return board[nextY][nextX] === EMPTY_CELL;
    }),
  );
};

const mergePiece = (board, piece) => {
  const nextBoard = board.map((row) => [...row]);
  getMatrix(piece).forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) return;
      const boardY = piece.y + rowIndex;
      const boardX = piece.x + colIndex;
      if (boardY >= 0) nextBoard[boardY][boardX] = piece.type;
    });
  });
  return nextBoard;
};

const clearLines = (board) => {
  const keptRows = board.filter((row) => row.some((cell) => cell === EMPTY_CELL));
  const cleared = BOARD_HEIGHT - keptRows.length;
  while (keptRows.length < BOARD_HEIGHT) keptRows.unshift(Array(BOARD_WIDTH).fill(EMPTY_CELL));
  return { board: keptRows, cleared };
};

const scoreForLines = (lines) => [0, 100, 300, 500, 800][lines] ?? lines * 250;

const renderMiniBoard = (piece) => {
  const matrix = getMatrix({ ...piece, rotation: 0 });
  const preview = Array.from({ length: 4 }, () => Array(4).fill(EMPTY_CELL));
  matrix.forEach((row, y) => row.forEach((cell, x) => {
    if (cell) preview[y][x] = piece.type;
  }));
  return preview;
};

function App() {
  const [board, setBoard] = useState(createBoard);
  const [currentPiece, setCurrentPiece] = useState(() => createPiece());
  const [nextPiece, setNextPiece] = useState(() => createPiece());
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [isRunning, setIsRunning] = useState(true);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isSoftDropping, setIsSoftDropping] = useState(false);
  const boardRef = useRef(board);
  const pieceRef = useRef(currentPiece);
  const nextPieceRef = useRef(nextPiece);

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { pieceRef.current = currentPiece; }, [currentPiece]);
  useEffect(() => { nextPieceRef.current = nextPiece; }, [nextPiece]);

  const restartGame = useCallback(() => {
    setBoard(createBoard());
    setCurrentPiece(createPiece());
    setNextPiece(createPiece());
    setScore(0);
    setLines(0);
    setLevel(1);
    setIsGameOver(false);
    setIsRunning(true);
    setIsSoftDropping(false);
  }, []);

  const lockCurrentPiece = useCallback(() => {
    const mergedBoard = mergePiece(boardRef.current, pieceRef.current);
    const { board: clearedBoard, cleared } = clearLines(mergedBoard);
    const spawnedPiece = { ...nextPieceRef.current, x: Math.floor(BOARD_WIDTH / 2) - 2, y: 0 };

    setBoard(clearedBoard);
    setScore((prev) => prev + scoreForLines(cleared) + 10);
    setLines((prev) => {
      const total = prev + cleared;
      setLevel(Math.floor(total / 10) + 1);
      return total;
    });
    setCurrentPiece(spawnedPiece);
    setNextPiece(createPiece());

    if (!isValidPosition(clearedBoard, spawnedPiece)) {
      setIsGameOver(true);
      setIsRunning(false);
    }
  }, []);

  const movePiece = useCallback((deltaX, deltaY) => {
    if (isGameOver) return false;
    const next = { ...pieceRef.current, x: pieceRef.current.x + deltaX, y: pieceRef.current.y + deltaY };
    if (isValidPosition(boardRef.current, next)) {
      setCurrentPiece(next);
      return true;
    }
    if (deltaY > 0) lockCurrentPiece();
    return false;
  }, [isGameOver, lockCurrentPiece]);

  const rotatePiece = useCallback(() => {
    if (isGameOver) return;
    const totalRotations = SHAPES[pieceRef.current.type].rotations.length;
    const nextRotation = (pieceRef.current.rotation + 1) % totalRotations;
    for (const offset of [0, -1, 1, -2, 2]) {
      if (isValidPosition(boardRef.current, pieceRef.current, pieceRef.current.x + offset, pieceRef.current.y, nextRotation)) {
        setCurrentPiece((prev) => ({ ...prev, x: prev.x + offset, rotation: nextRotation }));
        return;
      }
    }
  }, [isGameOver]);

  const hardDrop = useCallback(() => {
    if (isGameOver) return;
    let dropDistance = 0;
    let nextY = pieceRef.current.y;
    while (isValidPosition(boardRef.current, pieceRef.current, pieceRef.current.x, nextY + 1, pieceRef.current.rotation)) {
      nextY += 1;
      dropDistance += 1;
    }
    setCurrentPiece((prev) => ({ ...prev, y: nextY }));
    setScore((prev) => prev + dropDistance * 2);
    setTimeout(() => { lockCurrentPiece(); }, 0);
  }, [isGameOver, lockCurrentPiece]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat && event.key !== 'ArrowDown') return;
      if (event.key === 'p' || event.key === 'P') {
        setIsRunning((prev) => !prev);
        return;
      }
      if (isGameOver && event.key !== 'Enter') return;
      switch (event.key) {
        case 'ArrowLeft': movePiece(-1, 0); break;
        case 'ArrowRight': movePiece(1, 0); break;
        case 'ArrowDown': {
          setIsSoftDropping(true);
          const moved = movePiece(0, 1);
          if (moved) setScore((prev) => prev + 1);
          break;
        }
        case 'ArrowUp':
        case 'x':
        case 'X': rotatePiece(); break;
        case ' ': event.preventDefault(); hardDrop(); break;
        case 'Enter': if (isGameOver) restartGame(); break;
        default: break;
      }
    };
    const handleKeyUp = (event) => {
      if (event.key === 'ArrowDown') setIsSoftDropping(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hardDrop, isGameOver, movePiece, restartGame, rotatePiece]);

  useEffect(() => {
    if (!isRunning || isGameOver) return undefined;
    const speed = Math.max(120, DROP_INTERVAL - (level - 1) * 55);
    const interval = isSoftDropping ? FAST_DROP_INTERVAL : speed;
    const timer = window.setInterval(() => movePiece(0, 1), interval);
    return () => window.clearInterval(timer);
  }, [isRunning, isGameOver, isSoftDropping, level, movePiece]);

  const displayBoard = useMemo(() => {
    const previewBoard = board.map((row) => [...row]);
    getMatrix(currentPiece).forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
      if (!cell) return;
      const drawY = currentPiece.y + rowIndex;
      const drawX = currentPiece.x + colIndex;
      if (drawY >= 0 && drawY < BOARD_HEIGHT && drawX >= 0 && drawX < BOARD_WIDTH) previewBoard[drawY][drawX] = currentPiece.type;
    }));
    return previewBoard;
  }, [board, currentPiece]);

  const nextBoard = useMemo(() => renderMiniBoard(nextPiece), [nextPiece]);

  const boardCells = displayBoard.flatMap((row, rowIndex) => row.map((cell, colIndex) => h('div', {
    key: `${rowIndex}-${colIndex}`,
    className: `cell ${cell ? 'filled' : ''}`,
    style: { '--cell-color': cell ? SHAPES[cell].color : 'transparent' },
  })));

  const nextCells = nextBoard.flatMap((row, rowIndex) => row.map((cell, colIndex) => h('div', {
    key: `next-${rowIndex}-${colIndex}`,
    className: `mini-cell ${cell ? 'filled' : ''}`,
    style: { '--cell-color': cell ? SHAPES[cell].color : 'transparent' },
  })));

  return h('main', { className: 'app-shell' },
    h('section', { className: 'game-panel' },
      h('div', { className: 'title-row' },
        h('div', null,
          h('p', { className: 'eyebrow' }, 'React game'),
          h('h1', null, 'Тетрис'),
        ),
        h('button', { type: 'button', className: 'primary-button', onClick: restartGame }, 'Новая игра'),
      ),
      h('div', { className: 'layout-grid' },
        h('div', { className: 'board-wrap' },
          h('div', { className: 'board', role: 'grid', 'aria-label': 'Поле тетриса' }, boardCells),
          (!isRunning || isGameOver) && h('div', { className: 'overlay' },
            h('h2', null, isGameOver ? 'Игра окончена' : 'Пауза'),
            h('p', null, isGameOver
              ? 'Нажмите Enter или кнопку «Новая игра», чтобы начать заново.'
              : 'Нажмите P, чтобы продолжить.'),
          ),
        ),
        h('aside', { className: 'sidebar' },
          h('div', { className: 'card stats-card' },
            h('h2', null, 'Статистика'),
            h('dl', null,
              h('div', null, h('dt', null, 'Очки'), h('dd', null, score)),
              h('div', null, h('dt', null, 'Линии'), h('dd', null, lines)),
              h('div', null, h('dt', null, 'Уровень'), h('dd', null, level)),
            ),
          ),
          h('div', { className: 'card' },
            h('h2', null, 'Следующая'),
            h('div', { className: 'mini-board', 'aria-label': 'Следующая фигура' }, nextCells),
          ),
          h('div', { className: 'card controls-card' },
            h('h2', null, 'Управление'),
            h('ul', null,
              h('li', null, '← → — движение'),
              h('li', null, '↑ / X — поворот'),
              h('li', null, '↓ — ускорить падение'),
              h('li', null, 'Пробел — мгновенно сбросить'),
              h('li', null, 'P — пауза'),
            ),
          ),
        ),
      ),
    ),
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(h(React.StrictMode, null, h(App)));
