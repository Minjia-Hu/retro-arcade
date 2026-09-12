// 网格坐标系：20 × 30 格，渲染层负责像素化（320×480 / 16px 格）
export const COLS = 20;
export const ROWS = 30;

const BASE_INTERVAL = 0.16; // 秒/步
const MIN_INTERVAL = 0.07;
const SPEEDUP = 0.002; // 每分缩短的秒数；45 分到封顶（0.004 时 23 分就到，休闲玩家还没死就已是极限速）

export type Dir = 'up' | 'down' | 'left' | 'right';
export type SnakeStatus = 'ready' | 'playing' | 'dead';

export interface Cell {
  x: number;
  y: number;
}

export interface SnakeState {
  snake: Cell[]; // [0] 为蛇头
  dir: Dir; // 当前实际方向（本步生效）
  nextDir: Dir; // 玩家最新输入（下一步生效）
  food: Cell;
  score: number;
  status: SnakeStatus;
  stepTimer: number;
}

export interface StepEvents {
  ate: boolean;
  died: boolean;
}

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function stepInterval(score: number): number {
  return Math.max(MIN_INTERVAL, BASE_INTERVAL - score * SPEEDUP);
}

export function spawnFood(snake: Cell[], rand: () => number): Cell {
  // 收集全部空闲格再随机取，保证永不落在蛇身上
  const occupied = new Set(snake.map((c) => `${c.x},${c.y}`));
  const free: Cell[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  return free[Math.floor(rand() * free.length)] ?? { x: 0, y: 0 }; // 兜底：蛇占满全场需 597 分、实际不可达，不做胜利终局（有意取舍）
}

export function createState(rand: () => number = Math.random): SnakeState {
  const snake = [{ x: 10, y: 15 }, { x: 9, y: 15 }, { x: 8, y: 15 }];
  return {
    snake,
    dir: 'right',
    nextDir: 'right',
    food: spawnFood(snake, rand),
    score: 0,
    status: 'ready',
    stepTimer: 0,
  };
}

export function setDirection(s: SnakeState, dir: Dir): void {
  if (s.status === 'dead') return;
  if (dir === OPPOSITE[s.dir]) return; // 禁止 180° 掉头
  s.nextDir = dir;
  if (s.status === 'ready') s.status = 'playing';
}

/** 推进 dt 秒；按固定步进间隔移动，与渲染帧率解耦 */
export function tick(s: SnakeState, dt: number, rand: () => number = Math.random): StepEvents {
  const ev: StepEvents = { ate: false, died: false };
  if (s.status !== 'playing') return ev;
  s.stepTimer += dt;
  while (s.stepTimer >= stepInterval(s.score)) {
    s.stepTimer -= stepInterval(s.score);
    const e = step(s, rand);
    ev.ate = ev.ate || e.ate;
    ev.died = ev.died || e.died;
    if (s.status !== 'playing') break;
  }
  return ev;
}

function step(s: SnakeState, rand: () => number): StepEvents {
  s.dir = s.nextDir;
  const head = s.snake[0];
  const d = DELTA[s.dir];
  const nx = head.x + d.x;
  const ny = head.y + d.y;

  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
    s.status = 'dead';
    return { ate: false, died: true };
  }

  const willEat = nx === s.food.x && ny === s.food.y;
  // 不吃时尾巴本步会移开，走进尾巴格合法；吃则全身保留
  const blocking = willEat ? s.snake : s.snake.slice(0, -1);
  if (blocking.some((c) => c.x === nx && c.y === ny)) {
    s.status = 'dead';
    return { ate: false, died: true };
  }

  s.snake.unshift({ x: nx, y: ny });
  if (willEat) {
    s.score += 1;
    s.food = spawnFood(s.snake, rand);
    return { ate: true, died: false };
  }
  s.snake.pop();
  return { ate: false, died: false };
}
