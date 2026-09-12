import { describe, it, expect } from 'vitest';
import {
  createState, flap, tick, H, BIRD_X, BIRD_R, BIRD_RY, GROUND_H, PIPE_W, PIPE_GAP,
} from '../src/games/flappy/logic';

const rand = () => 0.5; // fixed random for assertions

describe('flappy logic', () => {
  it('initial state: ready, bird centred, zero score', () => {
    const s = createState();
    expect(s.status).toBe('ready');
    expect(s.birdY).toBe(H / 2);
    expect(s.score).toBe(0);
    expect(s.pipes).toEqual([]);
  });

  it('tick while ready changes nothing', () => {
    const s = createState();
    tick(s, 0.016, rand);
    expect(s.birdY).toBe(H / 2);
    expect(s.pipes).toEqual([]);
  });

  it('flap enters playing and gives upward velocity', () => {
    const s = createState();
    flap(s);
    expect(s.status).toBe('playing');
    expect(s.birdVy).toBeLessThan(0);
  });

  it('gravity increases fall speed over time', () => {
    const s = createState();
    flap(s);
    const vy1 = s.birdVy;
    tick(s, 0.1, rand);
    expect(s.birdVy).toBeGreaterThan(vy1);
  });

  it('hitting the ground kills', () => {
    const s = createState();
    flap(s);
    s.birdY = H - BIRD_R; // on the ground
    s.birdVy = 100;
    tick(s, 0.1, rand);
    expect(s.status).toBe('dead');
  });

  it('a pipe fully passing the bird scores 1 and tick returns true', () => {
    const s = createState();
    flap(s);
    s.birdY = H / 2;
    // A pipe about to pass, with the gap aligned to the bird to avoid a collision
    s.pipes.push({ x: BIRD_X - PIPE_W - 0.5, gapY: H / 2, passed: false });
    const scored = tick(s, 0.016, rand);
    expect(scored).toBe(true);
    expect(s.score).toBe(1);
    expect(s.status).toBe('playing');
  });

  it('hitting a pipe kills', () => {
    const s = createState();
    flap(s);
    // The pipe sits on the bird's x, with the gap far away
    s.pipes.push({ x: BIRD_X - PIPE_W / 2, gapY: H / 2 + PIPE_GAP * 2, passed: false });
    s.birdY = H / 2;
    s.birdVy = 0;
    tick(s, 0.001, rand);
    expect(s.status).toBe('dead');
  });

  it('flap does nothing after death', () => {
    const s = createState();
    s.status = 'dead';
    flap(s);
    expect(s.status).toBe('dead');
  });

  it('hitting the ceiling kills', () => {
    const s = createState();
    flap(s);
    s.birdY = BIRD_R;
    s.birdVy = -400;
    tick(s, 0.1, rand);
    expect(s.status).toBe('dead');
  });

  it('off-screen pipes are removed', () => {
    const s = createState();
    flap(s);
    s.birdY = H / 2;
    s.pipes.push({ x: -PIPE_W - 1, gapY: H / 2, passed: true }, { x: 200, gapY: H / 2, passed: false });
    tick(s, 0.016, rand);
    expect(s.pipes.every((p) => p.x + PIPE_W > 0)).toBe(true);
    expect(s.pipes).toHaveLength(1); // the off-screen one is gone; lastX=200 > W-SPAWN_MARGIN=130, so no spawn this frame
  });

  it('tick while dead freezes the world', () => {
    const s = createState();
    s.status = 'dead';
    s.birdY = 100;
    s.pipes.push({ x: 200, gapY: H / 2, passed: false });
    tick(s, 0.1, rand);
    expect(s.birdY).toBe(100);
    expect(s.pipes[0].x).toBe(200);
  });

  it('the same pipe never scores twice', () => {
    const s = createState();
    flap(s);
    s.birdY = H / 2;
    s.pipes.push({ x: BIRD_X - PIPE_W - 0.5, gapY: H / 2, passed: false });
    tick(s, 0.016, rand);
    tick(s, 0.016, rand);
    expect(s.score).toBe(1);
  });

  it('dies at the top of the ground, not the bottom of the canvas', () => {
    const s = createState();
    flap(s);
    s.birdY = H - GROUND_H - BIRD_RY - 1; // body 1px above the ground
    s.birdVy = 100; // moves ≥ 1px down this frame
    tick(s, 0.05, rand);
    expect(s.status).toBe('dead');
  });

  it('the gap never goes below the ground for any random value', () => {
    // rand=1 is the lowest gap; the spawn branch had no coverage before
    const s = createState();
    flap(s);
    s.birdY = H / 2;
    tick(s, 0.001, () => 1);
    expect(s.pipes).toHaveLength(1);
    expect(s.pipes[0].gapY + PIPE_GAP / 2).toBeLessThanOrEqual(H - GROUND_H);
    expect(s.pipes[0].gapY - PIPE_GAP / 2).toBeGreaterThanOrEqual(0);
  });

  it('vertical collision uses the body half-height (smaller than the horizontal radius): no death without visibly touching the pipe', () => {
    const s = createState();
    flap(s);
    // The pipe sits on the bird's x; the body's bottom edge just touches the gap's bottom, and the extra ring BIRD_R would add does not count
    s.pipes.push({ x: BIRD_X - PIPE_W / 2, gapY: H / 2, passed: false });
    s.birdY = H / 2 + PIPE_GAP / 2 - BIRD_RY - 0.5;
    s.birdVy = 0;
    tick(s, 0.0001, rand);
    expect(BIRD_RY).toBeLessThan(BIRD_R);
    expect(s.status).toBe('playing');
  });
});
