import { describe, it, expect } from 'vitest';
import {
  createState, movePaddle, launch, tick, makeBricks, speedFor,
  W, H, PADDLE_W, PADDLE_Y, BALL_R,
} from '../src/games/breakout/logic';

describe('breakout logic', () => {
  it('initial state: ready, 3 lives, level 1, 40 bricks, ball on the paddle', () => {
    const s = createState();
    expect(s.status).toBe('ready');
    expect(s.lives).toBe(3);
    expect(s.level).toBe(1);
    expect(s.bricks).toHaveLength(40);
    expect(s.ballY).toBe(PADDLE_Y - BALL_R);
    expect(s.ballX).toBe(s.paddleX);
  });

  it('movePaddle clamps at both edges', () => {
    const s = createState();
    movePaddle(s, -100);
    expect(s.paddleX).toBe(PADDLE_W / 2);
    movePaddle(s, W + 100);
    expect(s.paddleX).toBe(W - PADDLE_W / 2);
  });

  it('moving the paddle while ready carries the ball', () => {
    const s = createState();
    movePaddle(s, 100);
    expect(s.ballX).toBe(100);
  });

  it('after launch: playing, ball going up, speed equals speedFor(level)', () => {
    const s = createState();
    launch(s);
    expect(s.status).toBe('playing');
    expect(s.vy).toBeLessThan(0);
    expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(speedFor(1), 5);
  });

  it('ball speed caps at level 7: the keyboard paddle moves at 300px/s and cannot keep up beyond that', () => {
    expect(speedFor(6)).toBeLessThan(speedFor(7));
    expect(speedFor(7)).toBe(speedFor(20));
    expect(speedFor(7) * 0.8).toBeLessThanOrEqual(320); // max horizontal component comparable to the paddle speed
  });

  it('serves toward the open side: right from the left half, left from the right half', () => {
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

  it('tick while ready does not move the ball', () => {
    const s = createState();
    tick(s, 1);
    expect(s.ballX).toBe(s.paddleX);
    expect(s.ballY).toBe(PADDLE_Y - BALL_R);
  });

  it('bounces off the left wall', () => {
    const s = createState();
    launch(s);
    s.ballX = BALL_R + 1;
    s.ballY = 200;
    s.vx = -100;
    s.vy = -50;
    tick(s, 0.05);
    expect(s.vx).toBeGreaterThan(0);
  });

  it('bounces off the ceiling', () => {
    const s = createState();
    launch(s);
    s.ballX = 200;
    s.ballY = BALL_R + 1;
    s.vx = 50;
    s.vy = -100;
    tick(s, 0.05);
    expect(s.vy).toBeGreaterThan(0);
  });

  it('paddle bounce angle follows the hit position: left half goes left, right half goes right, speed unchanged', () => {
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

  it('breaking a brick: scores, kills the brick, bounces, reports the event', () => {
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

  it('falling out: lives-1, back to ready, ball back on the paddle', () => {
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

  it('losing the last life is game over', () => {
    const s = createState();
    launch(s);
    s.lives = 1;
    s.ballY = H + 10;
    s.vy = 100;
    const ev = tick(s, 0.001);
    expect(ev.over).toBe(true);
    expect(s.status).toBe('over');
  });

  it('level clear: next level, checkerboard of 20 bricks, back to ready', () => {
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

  it('speed rises with level; three layouts cycle', () => {
    expect(speedFor(2)).toBeGreaterThan(speedFor(1));
    expect(makeBricks(1)).toHaveLength(40); // full grid
    expect(makeBricks(2)).toHaveLength(20); // checkerboard
    expect(makeBricks(3)).toHaveLength(20); // inverted pyramid
    expect(makeBricks(4)).toHaveLength(40); // back to the full grid
  });
});
