import { describe, it, expect } from 'vitest';
import {
  createState, flap, tick, W, H, BIRD_X, BIRD_R, PIPE_W, PIPE_GAP,
} from '../src/games/flappy/logic';

const rand = () => 0.5; // 固定随机数便于断言

describe('flappy logic', () => {
  it('初始状态：ready、小鸟居中、零分', () => {
    const s = createState();
    expect(s.status).toBe('ready');
    expect(s.birdY).toBe(H / 2);
    expect(s.score).toBe(0);
    expect(s.pipes).toEqual([]);
  });

  it('ready 状态下 tick 不产生任何变化', () => {
    const s = createState();
    tick(s, 0.016, rand);
    expect(s.birdY).toBe(H / 2);
    expect(s.pipes).toEqual([]);
  });

  it('flap 进入 playing 并给向上速度', () => {
    const s = createState();
    flap(s);
    expect(s.status).toBe('playing');
    expect(s.birdVy).toBeLessThan(0);
  });

  it('重力使下落速度随时间增加', () => {
    const s = createState();
    flap(s);
    const vy1 = s.birdVy;
    tick(s, 0.1, rand);
    expect(s.birdVy).toBeGreaterThan(vy1);
  });

  it('坠地判死', () => {
    const s = createState();
    flap(s);
    s.birdY = H - BIRD_R; // 贴地
    s.birdVy = 100;
    tick(s, 0.1, rand);
    expect(s.status).toBe('dead');
  });

  it('管道完全越过小鸟时得 1 分且 tick 返回 true', () => {
    const s = createState();
    flap(s);
    s.birdY = H / 2;
    // 放一根即将越过的管道，缺口对准小鸟避免碰撞
    s.pipes.push({ x: BIRD_X - PIPE_W - 0.5, gapY: H / 2, passed: false });
    const scored = tick(s, 0.016, rand);
    expect(scored).toBe(true);
    expect(s.score).toBe(1);
    expect(s.status).toBe('playing');
  });

  it('撞管道判死', () => {
    const s = createState();
    flap(s);
    // 管道正压在小鸟 x 上，缺口远离小鸟
    s.pipes.push({ x: BIRD_X - PIPE_W / 2, gapY: H / 2 + PIPE_GAP * 2, passed: false });
    s.birdY = H / 2;
    s.birdVy = 0;
    tick(s, 0.001, rand);
    expect(s.status).toBe('dead');
  });

  it('dead 后 flap 无效', () => {
    const s = createState();
    s.status = 'dead';
    flap(s);
    expect(s.status).toBe('dead');
  });
});
