// Logic space: 320 × 480; the renderer scales
export const W = 320;
export const H = 480;
export const PADDLE_W = 56;
export const PADDLE_H = 8;
export const PADDLE_Y = H - 24; // top edge of the paddle
export const BALL_R = 5;

const BASE_SPEED = 220; // px/s
const LEVEL_SPEED = 30; // per-level increment
const MAX_SPEED = 400; // capped from level 7: the keyboard paddle moves at 300 px/s (KEY_PADDLE_SPEED in index.ts) and can't keep up with a faster ball
const MAX_BOUNCE_X = 0.8; // max horizontal component off the paddle's edge (fraction of speed)

export type BreakoutStatus = 'ready' | 'playing' | 'over';

export interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  points: number;
  alive: boolean;
  /** Row index (0-based). The renderer colours by row instead of reverse-engineering makeBricks' private layout from y */
  row: number;
}

export interface BreakoutState {
  paddleX: number; // paddle centre
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  bricks: Brick[];
  level: number;
  lives: number;
  score: number;
  status: BreakoutStatus;
}

export interface TickEvents {
  broke: boolean;
  paddleHit: boolean;
  lost: boolean;
  cleared: boolean;
  over: boolean;
}

export function speedFor(level: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + (level - 1) * LEVEL_SPEED);
}

/** Three layouts in rotation: full grid 40 / checkerboard 20 / inverted pyramid 20 */
export function makeBricks(level: number): Brick[] {
  const cols = 8;
  const rows = 5;
  const bw = 35;
  const bh = 14;
  const gap = 4;
  const x0 = (W - (cols * bw + (cols - 1) * gap)) / 2;
  const y0 = 60;
  const pattern = (level - 1) % 3;
  const bricks: Brick[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (pattern === 1 && (r + c) % 2 === 1) continue;
      if (pattern === 2 && (c < r || c >= cols - r)) continue;
      bricks.push({
        x: x0 + c * (bw + gap),
        y: y0 + r * (bh + gap),
        w: bw,
        h: bh,
        points: (rows - r) * 10, // higher rows score more
        alive: true,
        row: r,
      });
    }
  }
  return bricks;
}

export function createState(): BreakoutState {
  return {
    paddleX: W / 2,
    ballX: W / 2,
    ballY: PADDLE_Y - BALL_R,
    vx: 0,
    vy: 0,
    bricks: makeBricks(1),
    level: 1,
    lives: 3,
    score: 0,
    status: 'ready',
  };
}

export function movePaddle(s: BreakoutState, x: number): void {
  s.paddleX = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, x));
  if (s.status === 'ready') s.ballX = s.paddleX; // before launch the ball rides the paddle
}

export function launch(s: BreakoutState): void {
  if (s.status !== 'ready') return;
  const sp = speedFor(s.level);
  // Serve toward the side with more room: right from the left half, left from the right half. No randomness
  s.vx = sp * 0.35 * (s.paddleX <= W / 2 ? 1 : -1);
  s.vy = -sp * Math.sqrt(1 - 0.35 * 0.35);
  s.status = 'playing';
}

function attachBall(s: BreakoutState): void {
  s.vx = 0;
  s.vy = 0;
  s.ballX = s.paddleX;
  s.ballY = PADDLE_Y - BALL_R;
  s.status = 'ready';
}

export function tick(s: BreakoutState, dt: number): TickEvents {
  const ev: TickEvents = { broke: false, paddleHit: false, lost: false, cleared: false, over: false };
  if (s.status !== 'playing') return ev;

  s.ballX += s.vx * dt;
  s.ballY += s.vy * dt;

  // Side walls and ceiling
  if (s.ballX < BALL_R) {
    s.ballX = BALL_R;
    s.vx = Math.abs(s.vx);
  } else if (s.ballX > W - BALL_R) {
    s.ballX = W - BALL_R;
    s.vx = -Math.abs(s.vx);
  }
  if (s.ballY < BALL_R) {
    s.ballY = BALL_R;
    s.vy = Math.abs(s.vy);
  }

  // Paddle (only while falling): bounce angle from the hit position, speed preserved
  const px = s.paddleX - PADDLE_W / 2;
  if (
    s.vy > 0
    && s.ballY + BALL_R >= PADDLE_Y
    && s.ballY + BALL_R <= PADDLE_Y + PADDLE_H + 6
    && s.ballX >= px - BALL_R
    && s.ballX <= px + PADDLE_W + BALL_R
  ) {
    const offset = Math.max(-1, Math.min(1, (s.ballX - s.paddleX) / (PADDLE_W / 2)));
    const sp = speedFor(s.level);
    s.vx = sp * offset * MAX_BOUNCE_X;
    s.vy = -Math.sqrt(sp * sp - s.vx * s.vx);
    s.ballY = PADDLE_Y - BALL_R;
    ev.paddleHit = true;
  }

  // Bricks: at most one per frame, bounce on the axis with the shallower overlap
  for (const b of s.bricks) {
    if (!b.alive) continue;
    if (
      s.ballX + BALL_R > b.x && s.ballX - BALL_R < b.x + b.w
      && s.ballY + BALL_R > b.y && s.ballY - BALL_R < b.y + b.h
    ) {
      b.alive = false;
      s.score += b.points;
      const overlapX = Math.min(s.ballX + BALL_R - b.x, b.x + b.w - (s.ballX - BALL_R));
      const overlapY = Math.min(s.ballY + BALL_R - b.y, b.y + b.h - (s.ballY - BALL_R));
      if (overlapX < overlapY) s.vx = -s.vx;
      else s.vy = -s.vy;
      ev.broke = true;
      break;
    }
  }

  // Level clear: next layout, ball back on the paddle, wait for launch
  if (s.bricks.every((b) => !b.alive)) {
    s.level += 1;
    s.bricks = makeBricks(s.level);
    attachBall(s);
    ev.cleared = true;
    return ev;
  }

  // Lose a life at the bottom (the only deadly edge)
  if (s.ballY - BALL_R > H) {
    s.lives -= 1;
    ev.lost = true;
    if (s.lives <= 0) {
      s.status = 'over';
      ev.over = true;
    } else {
      attachBall(s);
    }
  }
  return ev;
}
