import { describe, it, expect } from 'vitest';
import {
  SIZE, EMPTY, BLACK, WHITE, CENTER, createBoard, inBounds, other,
  checkWin, createGame, playMove,
} from '../src/games/gomoku/logic';

const at = (x: number, y: number) => y * SIZE + x;

describe('gomoku logic', () => {
  it('常量与空棋盘', () => {
    expect(SIZE).toBe(15);
    expect(CENTER).toBe(112);
    expect(createBoard()).toHaveLength(225);
    expect(createBoard().every((v) => v === EMPTY)).toBe(true);
    expect(other(BLACK)).toBe(WHITE);
    expect(other(WHITE)).toBe(BLACK);
  });

  it('inBounds 边界', () => {
    expect(inBounds(0, 0)).toBe(true);
    expect(inBounds(14, 14)).toBe(true);
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(15, 0)).toBe(false);
  });

  it('checkWin：水平五连', () => {
    const b = createBoard();
    for (let x = 3; x <= 7; x++) b[at(x, 7)] = BLACK;
    expect(checkWin(b, at(5, 7), BLACK)).toBe(true);
  });

  it('checkWin：垂直五连', () => {
    const b = createBoard();
    for (let y = 2; y <= 6; y++) b[at(5, y)] = WHITE;
    expect(checkWin(b, at(5, 4), WHITE)).toBe(true);
  });

  it('checkWin：主对角线五连', () => {
    const b = createBoard();
    for (let k = 0; k < 5; k++) b[at(3 + k, 3 + k)] = BLACK;
    expect(checkWin(b, at(5, 5), BLACK)).toBe(true);
  });

  it('checkWin：反对角线五连', () => {
    const b = createBoard();
    for (let k = 0; k < 5; k++) b[at(8 - k, 3 + k)] = BLACK;
    expect(checkWin(b, at(6, 5), BLACK)).toBe(true);
  });

  it('checkWin：四连不算', () => {
    const b = createBoard();
    for (let x = 3; x <= 6; x++) b[at(x, 7)] = BLACK;
    expect(checkWin(b, at(5, 7), BLACK)).toBe(false);
  });

  it('checkWin：长连（六连）也算胜（自由风格）', () => {
    const b = createBoard();
    for (let x = 3; x <= 8; x++) b[at(x, 7)] = BLACK;
    expect(checkWin(b, at(5, 7), BLACK)).toBe(true);
  });

  it('playMove：落子、翻手、记录 last', () => {
    const s = createGame();
    expect(s.turn).toBe(BLACK);
    expect(playMove(s, CENTER)).toBe(true);
    expect(s.board[CENTER]).toBe(BLACK);
    expect(s.last).toBe(CENTER);
    expect(s.turn).toBe(WHITE);
    expect(s.moves).toBe(1);
  });

  it('playMove：拒绝占用格/越界/终局后落子', () => {
    const s = createGame();
    playMove(s, CENTER);
    expect(playMove(s, CENTER)).toBe(false); // 占用
    expect(playMove(s, -1)).toBe(false); // 越界
    expect(playMove(s, 225)).toBe(false);
    s.status = 'won';
    expect(playMove(s, 0)).toBe(false); // 终局
  });

  it('playMove：连五即胜、置 winner', () => {
    const s = createGame();
    // 黑白交替落子，黑在第 7 行连成五
    const blacks = [at(3, 7), at(4, 7), at(5, 7), at(6, 7)];
    const whites = [at(3, 8), at(4, 8), at(5, 8), at(6, 8)];
    for (let i = 0; i < 4; i++) {
      playMove(s, blacks[i]);
      playMove(s, whites[i]);
    }
    expect(playMove(s, at(7, 7))).toBe(true); // 黑第五子
    expect(s.status).toBe('won');
    expect(s.winner).toBe(BLACK);
  });

  it('playMove：填满且末手不成五则和棋', () => {
    const s = createGame();
    s.board.fill(BLACK);
    s.board[CENTER] = EMPTY;
    // 让中心四方向邻格为白，落子不成五
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      s.board[at(7 + dx, 7 + dy)] = WHITE;
      s.board[at(7 - dx, 7 - dy)] = WHITE;
    }
    s.turn = BLACK;
    s.moves = 224;
    expect(playMove(s, CENTER)).toBe(true);
    expect(s.status).toBe('draw');
  });
});
