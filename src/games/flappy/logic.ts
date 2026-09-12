// Logic space: 320 × 480; the renderer scales
export const W = 320;
export const H = 480;
export const BIRD_X = 80;
export const BIRD_R = 12; // horizontal half-width
export const BIRD_RY = 9; // vertical half-height: the body is drawn 24×18, so the hitbox matches the art and nobody dies without touching
export const PIPE_W = 52;
export const PIPE_GAP = 130;

const GRAVITY = 1200; // px/s²
const FLAP_VY = -380; // px/s
const PIPE_SPEED = 120; // px/s
const SPAWN_MARGIN = 190; // right-side margin that triggers a spawn; actual pipe spacing = SPAWN_MARGIN + PIPE_W (plus up to PIPE_SPEED*dt of per-frame drift)
const EDGE_MARGIN = 15; // minimum gap clearance from the ceiling / ground
export const GROUND_H = 28; // ground height. The death line and the gap range are measured from its top edge; the renderer reads it to draw the ground

export type FlappyStatus = 'ready' | 'playing' | 'dead';

export interface Pipe {
  x: number; // left edge of the pipe
  gapY: number; // centre of the gap
  passed: boolean;
}

export interface FlappyState {
  birdY: number;
  birdVy: number;
  pipes: Pipe[];
  score: number;
  status: FlappyStatus;
}

export function createState(): FlappyState {
  return { birdY: H / 2, birdVy: 0, pipes: [], score: 0, status: 'ready' };
}

export function flap(s: FlappyState): void {
  if (s.status === 'dead') return;
  s.status = 'playing';
  s.birdVy = FLAP_VY;
}

/** Advance one frame; returns whether a point was scored (for the sound effect) */
export function tick(s: FlappyState, dt: number, rand: () => number = Math.random): boolean {
  if (s.status !== 'playing') return false;

  s.birdVy += GRAVITY * dt;
  s.birdY += s.birdVy * dt;

  // Spawn a new pipe
  const lastX = s.pipes.length > 0 ? s.pipes[s.pipes.length - 1].x : -Infinity;
  if (lastX < W - SPAWN_MARGIN) {
    const m = PIPE_GAP / 2 + EDGE_MARGIN; // the whole gap stays between ceiling and ground
    const gapY = m + rand() * (H - GROUND_H - 2 * m);
    s.pipes.push({ x: W + PIPE_W, gapY, passed: false });
  }

  // Move, drop pipes that left the screen
  for (const p of s.pipes) p.x -= PIPE_SPEED * dt;
  s.pipes = s.pipes.filter((p) => p.x + PIPE_W > 0);

  // Score
  let scored = false;
  for (const p of s.pipes) {
    if (!p.passed && p.x + PIPE_W < BIRD_X) {
      p.passed = true;
      s.score += 1;
      scored = true;
    }
  }

  // Collision: ceiling and ground
  if (s.birdY + BIRD_RY >= H - GROUND_H || s.birdY - BIRD_RY <= 0) {
    s.status = 'dead';
    return scored;
  }
  // Collision: pipes
  for (const p of s.pipes) {
    const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
    const inGap =
      s.birdY - BIRD_RY > p.gapY - PIPE_GAP / 2 && s.birdY + BIRD_RY < p.gapY + PIPE_GAP / 2;
    if (inX && !inGap) {
      s.status = 'dead';
      break;
    }
  }
  return scored;
}
