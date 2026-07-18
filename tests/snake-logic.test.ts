import { describe, it, expect } from 'vitest';
import {
  createState, setDirection, tick, stepInterval, spawnFood, COLS, ROWS,
} from '../src/games/snake/logic';

const rand = () => 0.5;

describe('snake logic', () => {
  it('初始状态：ready、3 节、向右、食物在界内且不在蛇身上', () => {
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

  it('180° 掉头被忽略且不开局', () => {
    const s = createState(rand);
    setDirection(s, 'left'); // 当前向右
    expect(s.nextDir).toBe('right');
    expect(s.status).toBe('ready');
  });

  it('合法转向使游戏开局', () => {
    const s = createState(rand);
    setDirection(s, 'up');
    expect(s.status).toBe('playing');
    expect(s.nextDir).toBe('up');
  });

  it('ready 状态下 tick 不移动', () => {
    const s = createState(rand);
    tick(s, 1, rand);
    expect(s.snake[0]).toEqual({ x: 10, y: 15 });
  });

  it('累积一个步进间隔后前进一格', () => {
    const s = createState(rand);
    setDirection(s, 'right');
    tick(s, stepInterval(0), rand);
    expect(s.snake[0]).toEqual({ x: 11, y: 15 });
    expect(s.snake).toHaveLength(3);
  });

  it('吃到食物：加分、变长、食物换位且不在蛇身上', () => {
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

  it('撞墙判死', () => {
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

  it('撞到自己身体判死', () => {
    const s = createState(rand);
    s.snake = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }];
    s.dir = 'left';
    s.nextDir = 'left';
    s.food = { x: 0, y: 0 };
    setDirection(s, 'down'); // 头 (5,5) 下方 (5,6) 是身体（非尾巴）
    const ev = tick(s, stepInterval(0), rand);
    expect(ev.died).toBe(true);
    expect(s.status).toBe('dead');
  });

  it('走进即将移开的尾巴格是合法的', () => {
    const s = createState(rand);
    s.snake = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }];
    s.dir = 'left';
    s.nextDir = 'left';
    s.food = { x: 0, y: 0 };
    setDirection(s, 'down'); // (5,6) 是尾巴，本步会移开
    tick(s, stepInterval(0), rand);
    expect(s.status).toBe('playing');
    expect(s.snake[0]).toEqual({ x: 5, y: 6 });
    expect(s.snake).toHaveLength(4);
  });

  it('dead 状态下 tick 冻结世界', () => {
    const s = createState(rand);
    s.status = 'dead';
    const ev = tick(s, 1, rand);
    expect(s.snake[0]).toEqual({ x: 10, y: 15 });
    expect(ev.ate).toBe(false);
    expect(ev.died).toBe(false);
  });

  it('步进间隔随分数缩短且有下限', () => {
    expect(stepInterval(0)).toBeGreaterThan(stepInterval(10));
    expect(stepInterval(500)).toBe(stepInterval(1000));
  });

  it('spawnFood 只落在空闲格', () => {
    const zero = () => 0;
    const food = spawnFood([{ x: 0, y: 0 }, { x: 1, y: 0 }], zero);
    expect(food).toEqual({ x: 2, y: 0 }); // 行优先扫描的第一个空格
  });
});
