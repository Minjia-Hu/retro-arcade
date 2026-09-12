import { describe, it, expect } from 'vitest';
import {
  createState, movePaddle, launch, tick, makeBricks, speedFor,
  W, H, PADDLE_W, PADDLE_Y, BALL_R,
} from '../src/games/breakout/logic';

describe('breakout logic', () => {
  it('初始状态：ready、3 命、第 1 关、40 块砖、球贴板', () => {
    const s = createState();
    expect(s.status).toBe('ready');
    expect(s.lives).toBe(3);
    expect(s.level).toBe(1);
    expect(s.bricks).toHaveLength(40);
    expect(s.ballY).toBe(PADDLE_Y - BALL_R);
    expect(s.ballX).toBe(s.paddleX);
  });

  it('movePaddle 两侧钳制', () => {
    const s = createState();
    movePaddle(s, -100);
    expect(s.paddleX).toBe(PADDLE_W / 2);
    movePaddle(s, W + 100);
    expect(s.paddleX).toBe(W - PADDLE_W / 2);
  });

  it('ready 状态下移板带着球走', () => {
    const s = createState();
    movePaddle(s, 100);
    expect(s.ballX).toBe(100);
  });

  it('launch 后 playing、球向上、速度模长为 speedFor(level)', () => {
    const s = createState();
    launch(s);
    expect(s.status).toBe('playing');
    expect(s.vy).toBeLessThan(0);
    expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(speedFor(1), 5);
  });

  it('球速在第 7 关封顶：键盘挡板 300px/s，再快就物理上追不上', () => {
    expect(speedFor(6)).toBeLessThan(speedFor(7));
    expect(speedFor(7)).toBe(speedFor(20));
    expect(speedFor(7) * 0.8).toBeLessThanOrEqual(320); // 最大水平分量与挡板速度相当
  });

  it('发球朝空间大的一侧：挡板在左半场向右发，在右半场向左发', () => {
    const l = createState();
    movePaddle(l, 100);
    launch(l);
    expect(l.vx).toBeGreaterThan(0);
    const r = createState();
    movePaddle(r, 220);
    launch(r);
    expect(r.vx).toBeLessThan(0);
    expect(Math.hypot(r.vx, r.vy)).toBeCloseTo(speedFor(1), 5);
  });

  it('ready 状态下 tick 球不动', () => {
    const s = createState();
    tick(s, 1);
    expect(s.ballX).toBe(s.paddleX);
    expect(s.ballY).toBe(PADDLE_Y - BALL_R);
  });

  it('左墙反弹', () => {
    const s = createState();
    launch(s);
    s.ballX = BALL_R + 1;
    s.ballY = 200;
    s.vx = -100;
    s.vy = -50;
    tick(s, 0.05);
    expect(s.vx).toBeGreaterThan(0);
  });

  it('顶墙反弹', () => {
    const s = createState();
    launch(s);
    s.ballX = 200;
    s.ballY = BALL_R + 1;
    s.vx = 50;
    s.vy = -100;
    tick(s, 0.05);
    expect(s.vy).toBeGreaterThan(0);
  });

  it('挡板反弹角度随击中位置：左半出左、右半出右，且速度模长不变', () => {
    const left = createState();
    launch(left);
    left.ballX = left.paddleX - PADDLE_W / 4;
    left.ballY = PADDLE_Y - BALL_R;
    left.vx = 0;
    left.vy = 100;
    tick(left, 0.001);
    expect(left.vx).toBeLessThan(0);
    expect(left.vy).toBeLessThan(0);
    expect(Math.hypot(left.vx, left.vy)).toBeCloseTo(speedFor(1), 5);

    const right = createState();
    launch(right);
    right.ballX = right.paddleX + PADDLE_W / 4;
    right.ballY = PADDLE_Y - BALL_R;
    right.vx = 0;
    right.vy = 100;
    tick(right, 0.001);
    expect(right.vx).toBeGreaterThan(0);
  });

  it('碎砖：计分、砖失效、反弹、报事件', () => {
    const s = createState();
    launch(s);
    const b = s.bricks[0];
    s.ballX = b.x + b.w / 2;
    s.ballY = b.y + b.h / 2;
    s.vx = 0;
    s.vy = -100;
    const ev = tick(s, 0.001);
    expect(ev.broke).toBe(true);
    expect(b.alive).toBe(false);
    expect(s.score).toBe(b.points);
  });

  it('落底丢命：命-1、回 ready、球重新贴板', () => {
    const s = createState();
    launch(s);
    s.ballY = H + 10;
    s.vy = 100;
    const ev = tick(s, 0.001);
    expect(ev.lost).toBe(true);
    expect(s.lives).toBe(2);
    expect(s.status).toBe('ready');
    expect(s.ballX).toBe(s.paddleX);
  });

  it('最后一命落底判负', () => {
    const s = createState();
    launch(s);
    s.lives = 1;
    s.ballY = H + 10;
    s.vy = 100;
    const ev = tick(s, 0.001);
    expect(ev.over).toBe(true);
    expect(s.status).toBe('over');
  });

  it('清关：进入下一关、棋盘格布局 20 块、回 ready', () => {
    const s = createState();
    launch(s);
    for (const b of s.bricks) b.alive = false;
    const last = s.bricks[0];
    last.alive = true;
    s.ballX = last.x + last.w / 2;
    s.ballY = last.y + last.h / 2;
    s.vx = 0;
    s.vy = -100;
    const ev = tick(s, 0.001);
    expect(ev.cleared).toBe(true);
    expect(s.level).toBe(2);
    expect(s.bricks).toHaveLength(20);
    expect(s.bricks.every((b) => b.alive)).toBe(true);
    expect(s.status).toBe('ready');
  });

  it('球速随关卡递增；三种布局循环', () => {
    expect(speedFor(2)).toBeGreaterThan(speedFor(1));
    expect(makeBricks(1)).toHaveLength(40); // 满阵
    expect(makeBricks(2)).toHaveLength(20); // 棋盘格
    expect(makeBricks(3)).toHaveLength(20); // 倒金字塔
    expect(makeBricks(4)).toHaveLength(40); // 循环回满阵
  });
});
