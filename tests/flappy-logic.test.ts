import { describe, it, expect } from 'vitest';
import {
  createState, flap, tick, H, BIRD_X, BIRD_R, BIRD_RY, GROUND_H, PIPE_W, PIPE_GAP,
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

  it('撞天花板判死', () => {
    const s = createState();
    flap(s);
    s.birdY = BIRD_R;
    s.birdVy = -400;
    tick(s, 0.1, rand);
    expect(s.status).toBe('dead');
  });

  it('出屏管道被移除', () => {
    const s = createState();
    flap(s);
    s.birdY = H / 2;
    s.pipes.push({ x: -PIPE_W - 1, gapY: H / 2, passed: true }, { x: 200, gapY: H / 2, passed: false });
    tick(s, 0.016, rand);
    expect(s.pipes.every((p) => p.x + PIPE_W > 0)).toBe(true);
    expect(s.pipes).toHaveLength(1); // 出屏那根被清除；lastX=200 > W-SPAWN_MARGIN=130，故本帧不生成新管道
  });

  it('dead 状态下 tick 冻结世界', () => {
    const s = createState();
    s.status = 'dead';
    s.birdY = 100;
    s.pipes.push({ x: 200, gapY: H / 2, passed: false });
    tick(s, 0.1, rand);
    expect(s.birdY).toBe(100);
    expect(s.pipes[0].x).toBe(200);
  });

  it('同一根管道不会重复计分', () => {
    const s = createState();
    flap(s);
    s.birdY = H / 2;
    s.pipes.push({ x: BIRD_X - PIPE_W - 0.5, gapY: H / 2, passed: false });
    tick(s, 0.016, rand);
    tick(s, 0.016, rand);
    expect(s.score).toBe(1);
  });

  it('落到地面顶边即死，不必穿到画布底边', () => {
    const s = createState();
    flap(s);
    s.birdY = H - GROUND_H - BIRD_RY - 1; // 身体下沿距地面 1px
    s.birdVy = 100; // 本帧下移 ≥ 1px
    tick(s, 0.05, rand);
    expect(s.status).toBe('dead');
  });

  it('缺口无论随机值多大都不会低于地面', () => {
    // rand=1 是最往下的缺口；生成分支此前零覆盖
    const s = createState();
    flap(s);
    s.birdY = H / 2;
    tick(s, 0.001, () => 1);
    expect(s.pipes).toHaveLength(1);
    expect(s.pipes[0].gapY + PIPE_GAP / 2).toBeLessThanOrEqual(H - GROUND_H);
    expect(s.pipes[0].gapY - PIPE_GAP / 2).toBeGreaterThanOrEqual(0);
  });

  it('纵向判定用身体半高（比横向半径小），画面上没碰到管口就不死', () => {
    const s = createState();
    flap(s);
    // 管道正压在小鸟 x 上；小鸟身体下沿恰好贴着缺口下沿，比 BIRD_R 判定多出的那圈不算碰
    s.pipes.push({ x: BIRD_X - PIPE_W / 2, gapY: H / 2, passed: false });
    s.birdY = H / 2 + PIPE_GAP / 2 - BIRD_RY - 0.5;
    s.birdVy = 0;
    tick(s, 0.0001, rand);
    expect(BIRD_RY).toBeLessThan(BIRD_R);
    expect(s.status).toBe('playing');
  });
});
