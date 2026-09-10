// 逻辑坐标系：320 × 480，渲染层负责缩放
export const W = 320;
export const H = 480;
export const BIRD_X = 80;
export const BIRD_R = 12; // 横向半宽
export const BIRD_RY = 9; // 纵向半高：身体画成 24×18，判定盒与画面一致，玩家不会「没碰到就死」
export const PIPE_W = 52;
export const PIPE_GAP = 130;

const GRAVITY = 1200; // px/s²
const FLAP_VY = -380; // px/s
const PIPE_SPEED = 120; // px/s
const SPAWN_MARGIN = 190; // 触发生成的右侧余量；实际管道间距 = SPAWN_MARGIN + PIPE_W（另有每帧 ≤ PIPE_SPEED*dt 的离散化漂移）
const EDGE_MARGIN = 15; // 缺口边缘距天花板 / 地面的最小余量
export const GROUND_H = 28; // 地面高度。致死线与缺口范围都以地面顶边为底，渲染层读它画地面

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
  if (lastX < W - SPAWN_MARGIN) {
    const m = PIPE_GAP / 2 + EDGE_MARGIN; // 缺口完整留在天花板与地面之间
    const gapY = m + rand() * (H - GROUND_H - 2 * m);
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
  if (s.birdY + BIRD_RY >= H - GROUND_H || s.birdY - BIRD_RY <= 0) {
    s.status = 'dead';
    return scored;
  }
  // 碰撞：管道
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
