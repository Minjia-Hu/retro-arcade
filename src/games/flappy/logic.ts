// 逻辑坐标系：320 × 480，渲染层负责缩放
export const W = 320;
export const H = 480;
export const BIRD_X = 80;
export const BIRD_R = 12;
export const PIPE_W = 52;
export const PIPE_GAP = 130;

const GRAVITY = 1200; // px/s²
const FLAP_VY = -380; // px/s
const PIPE_SPEED = 120; // px/s
const PIPE_SPACING = 190; // 相邻管道水平间距 px

export type FlappyStatus = 'ready' | 'playing' | 'dead';

export interface Pipe {
  x: number; // 管道左缘
  gapY: number; // 缺口中心
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

/** 推进一帧；返回本帧是否得分（供播放音效） */
export function tick(s: FlappyState, dt: number, rand: () => number = Math.random): boolean {
  if (s.status !== 'playing') return false;

  s.birdVy += GRAVITY * dt;
  s.birdY += s.birdVy * dt;

  // 生成新管道
  const lastX = s.pipes.length > 0 ? s.pipes[s.pipes.length - 1].x : -Infinity;
  if (lastX < W - PIPE_SPACING) {
    const gapY = 80 + rand() * (H - 240);
    s.pipes.push({ x: W + PIPE_W, gapY, passed: false });
  }

  // 移动、清理出屏管道
  for (const p of s.pipes) p.x -= PIPE_SPEED * dt;
  s.pipes = s.pipes.filter((p) => p.x + PIPE_W > 0);

  // 计分
  let scored = false;
  for (const p of s.pipes) {
    if (!p.passed && p.x + PIPE_W < BIRD_X) {
      p.passed = true;
      s.score += 1;
      scored = true;
    }
  }

  // 碰撞：天地边界
  if (s.birdY + BIRD_R >= H || s.birdY - BIRD_R <= 0) {
    s.status = 'dead';
    return scored;
  }
  // 碰撞：管道
  for (const p of s.pipes) {
    const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
    const inGap =
      s.birdY - BIRD_R > p.gapY - PIPE_GAP / 2 && s.birdY + BIRD_R < p.gapY + PIPE_GAP / 2;
    if (inX && !inGap) {
      s.status = 'dead';
      break;
    }
  }
  return scored;
}
