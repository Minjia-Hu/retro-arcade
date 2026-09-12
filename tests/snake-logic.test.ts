import { describe, it, expect } from 'vitest';
import {
  createState, setDirection, tick, stepInterval, spawnFood, COLS, ROWS,
} from '../src/games/snake/logic';

const rand = () => 0.5;

describe('snake logic', () => {
  it('initial state: ready, 3 segments, heading right, food in bounds and off the snake', () => {
    const s = createState(rand);
    expect(s.status).toBe('ready');
    expect(s.snake).toHaveLength(3);
    expect(s.snake[0]).toEqual({ x: 10, y: 15 });
    expect(s.dir).toBe('right');
    expect(s.food.x).toBeGreaterThanOrEqual(0);
    expect(s.food.x).toBeLessThan(COLS);
    expect(s.food.y).toBeGreaterThanOrEqual(0);
    expect(s.food.y).toBeLessThan(ROWS);
    expect(s.snake.some((c) => c.x === s.food.x && c.y === s.food.y)).toBe(false);
  });

  it('a 180° turn is ignored and does not start the game', () => {
    const s = createState(rand);
    setDirection(s, 'left'); // currently heading right
    expect(s.nextDir).toBe('right');
    expect(s.status).toBe('ready');
  });

  it('a legal turn starts the game', () => {
    const s = createState(rand);
    setDirection(s, 'up');
    expect(s.status).toBe('playing');
    expect(s.nextDir).toBe('up');
  });

  it('tick while ready does not move', () => {
    const s = createState(rand);
    tick(s, 1, rand);
    expect(s.snake[0]).toEqual({ x: 10, y: 15 });
  });

  it('advances one cell after one step interval accumulates', () => {
    const s = createState(rand);
    setDirection(s, 'right');
    tick(s, stepInterval(0), rand);
    expect(s.snake[0]).toEqual({ x: 11, y: 15 });
    expect(s.snake).toHaveLength(3);
  });

  it('eating: scores, grows, food relocates off the snake', () => {
    const s = createState(rand);
    s.food = { x: 11, y: 15 };
    setDirection(s, 'right');
    const ev = tick(s, stepInterval(0), rand);
    expect(ev.ate).toBe(true);
    expect(s.score).toBe(1);
    expect(s.snake).toHaveLength(4);
    expect(s.food).not.toEqual({ x: 11, y: 15 });
    expect(s.snake.some((c) => c.x === s.food.x && c.y === s.food.y)).toBe(false);
  });

  it('hitting a wall kills', () => {
    const s = createState(rand);
    s.snake = [{ x: COLS - 1, y: 5 }, { x: COLS - 2, y: 5 }, { x: COLS - 3, y: 5 }];
    s.dir = 'right';
    s.nextDir = 'right';
    s.status = 'playing';
    s.food = { x: 0, y: 0 };
    const ev = tick(s, stepInterval(0), rand);
    expect(ev.died).toBe(true);
    expect(s.status).toBe('dead');
  });

  it('hitting its own body kills', () => {
    const s = createState(rand);
    s.snake = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }];
    s.dir = 'left';
    s.nextDir = 'left';
    s.food = { x: 0, y: 0 };
    setDirection(s, 'down'); // (5,6) below the head (5,5) is body, not tail
    const ev = tick(s, stepInterval(0), rand);
    expect(ev.died).toBe(true);
    expect(s.status).toBe('dead');
  });

  it('entering the tail cell that is about to move away is legal', () => {
    const s = createState(rand);
    s.snake = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }];
    s.dir = 'left';
    s.nextDir = 'left';
    s.food = { x: 0, y: 0 };
    setDirection(s, 'down'); // (5,6) is the tail and moves away this step
    tick(s, stepInterval(0), rand);
    expect(s.status).toBe('playing');
    expect(s.snake[0]).toEqual({ x: 5, y: 6 });
    expect(s.snake).toHaveLength(4);
  });

  it('tick while dead freezes the world', () => {
    const s = createState(rand);
    s.status = 'dead';
    const ev = tick(s, 1, rand);
    expect(s.snake[0]).toEqual({ x: 10, y: 15 });
    expect(ev.ate).toBe(false);
    expect(ev.died).toBe(false);
  });

  it('the step interval shrinks with score and has a floor', () => {
    expect(stepInterval(0)).toBeGreaterThan(stepInterval(10));
    expect(stepInterval(500)).toBe(stepInterval(1000));
    // The floor must not arrive too early: casual games end around 10–30 apples, so 30 still needs headroom; 45 is top speed
    expect(stepInterval(30)).toBeGreaterThan(stepInterval(1000));
    expect(stepInterval(45)).toBe(stepInterval(1000));
  });

  it('spawnFood lands only on free cells', () => {
    const zero = () => 0;
    const food = spawnFood([{ x: 0, y: 0 }, { x: 1, y: 0 }], zero);
    expect(food).toEqual({ x: 2, y: 0 }); // the first free cell in row-major order
  });

  it('one tick spanning two intervals advances two cells', () => {
    const s = createState(rand);
    setDirection(s, 'right');
    tick(s, stepInterval(0) * 2, rand);
    expect(s.snake[0]).toEqual({ x: 12, y: 15 });
  });

  it('two inputs within one interval: the last legal one wins', () => {
    const s = createState(rand); // heading right
    setDirection(s, 'up');
    setDirection(s, 'down'); // legal relative to the current dir (right); overrides up
    tick(s, stepInterval(0), rand);
    expect(s.snake[0]).toEqual({ x: 10, y: 16 });
  });

  it('two inputs within one interval: an illegal second one is rejected', () => {
    const s = createState(rand); // heading right
    setDirection(s, 'up');
    setDirection(s, 'left'); // a reversal relative to the current dir (right); rejected
    expect(s.nextDir).toBe('up');
    tick(s, stepInterval(0), rand);
    expect(s.snake[0]).toEqual({ x: 10, y: 14 });
  });
});
