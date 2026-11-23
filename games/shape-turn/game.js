'use strict';

(() => {
  const SIZE = 5;
  const puzzles = [
    { cells: [[1, 1], [1, 2], [2, 2], [3, 2], [3, 1]], turns: 1 },
    { cells: [[1, 2], [2, 1], [2, 2], [2, 3], [3, 3]], turns: -1 },
    { cells: [[1, 1], [1, 2], [1, 3], [2, 1], [3, 1]], turns: 2 },
    { cells: [[1, 2], [1, 3], [2, 2], [2, 1], [3, 1]], turns: 1 },
    { cells: [[1, 1], [1, 2], [1, 3], [2, 2], [2, 3]], turns: -1 },
    { cells: [[1, 1], [1, 2], [1, 3], [2, 2], [3, 2]], turns: 2 },
    { cells: [[1, 1], [2, 1], [2, 2], [2, 3], [3, 2]], turns: -1 },
    { cells: [[1, 3], [2, 1], [2, 2], [2, 3], [3, 2]], turns: 1 }
  ];

  function clockwise(cells) {
    return cells.map(([row, column]) => [column, SIZE - 1 - row]);
  }

  function occupied(cells) {
    return new Set(cells.map(([row, column]) => row * SIZE + column));
  }

  function shape(cells) {
    const grid = document.createElement('div');
    grid.className = 'turn-shape';
    grid.setAttribute('aria-hidden', 'true');
    const filled = occupied(cells);
    for (let index = 0; index < SIZE * SIZE; index++) {
      const cell = document.createElement('span');
      cell.className = filled.has(index) ? 'turn-cell filled' : 'turn-cell';
      grid.append(cell);
    }
    return grid;
  }

  function describe(cells) {
    const names = ['왼쪽 끝', '왼쪽', '가운데', '오른쪽', '오른쪽 끝'];
    const rows = Array.from({ length: SIZE }, (_, row) => cells.filter(cell => cell[0] === row).map(cell => cell[1]));
    return rows.map((columns, row) => columns.length
      ? (row + 1) + '행 ' + columns.sort((a, b) => a - b).map(column => names[column]).join(', ')
      : '').filter(Boolean).join('. ');
  }

  function angleLabel(turns) {
    if (turns === 2) return '반 바퀴(180°)';
    return turns < 0 ? '왼쪽으로 90°' : '오른쪽으로 90°';
  }

  function draw(cells, turns) {
    const display = document.createElement('div');
    display.className = 'turn-display';
    const board = document.createElement('div');
    board.className = 'turn-board';
    board.setAttribute('role', 'img');
    board.setAttribute('aria-label', '처음 도형의 칠해진 칸. ' + describe(cells));
    board.style.setProperty('--turn-amount', turns * 90 + 'deg');
    board.append(shape(cells));
    const instruction = document.createElement('span');
    instruction.className = 'turn-instruction';
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = turns < 0 ? '↶' : '↷';
    instruction.append(arrow, angleLabel(turns));
    display.append(board, instruction);
    return display;
  }

  const rounds = puzzles.map(({ cells, turns }, index) => {
    const orientations = [cells];
    for (let rotation = 1; rotation < 4; rotation++) orientations.push(clockwise(orientations[rotation - 1]));
    const offset = [2, 2, 3, 1, 0, 0, 1, 2][index];
    const choices = Array.from({ length: 4 }, (_, choice) => {
      const rotated = orientations[(choice + offset) % 4];
      return { label: '보기 ' + (choice + 1) + '. ' + describe(rotated), art: () => shape(rotated) };
    });
    return {
      prompt: '화살표 방향으로 돌리면 어떤 모양일까요?',
      explanation: '도형의 가운데를 기준으로 ' + angleLabel(turns) + ' 돌렸어요. 같은 모양을 찾아보세요.',
      choices,
      answer: (turns - offset + 4) % 4,
      art: () => draw(cells, turns)
    };
  });

  startMotionQuiz({
    rounds,
    movement: '손으로 도형의 튀어나온 부분을 짚어 본 뒤 화살표 방향으로 손을 돌려요.',
    saveScore: scores => reportGameResult({ gameId: 'shape-turn', playerCount: scores.length, scores })
  });
})();
