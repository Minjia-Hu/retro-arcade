import { SIZE, EMPTY, CENTER, DIRS, inBounds, other, checkWin } from './logic';

export interface AiLevel {
  id: 'easy' | 'medium' | 'hard';
  name: string;
  depth: number;
}

export const AI_LEVELS: AiLevel[] = [
  { id: 'easy', name: '简单', depth: 1 },
  { id: 'medium', name: '中等', depth: 2 },
  { id: 'hard', name: '困难', depth: 4 },
];

const WIN_SCORE = 1e9;
const TOP_K = 12; // 每层最多搜索的候选数（剪枝）

/** 棋形分值：count = 同色连子数，open = 两端敞开数（0/1/2） */
function shapeScore(count: number, open: number): number {
  if (count >= 5) return 100000; // 五连
  if (count === 4) return open === 2 ? 10000 : open === 1 ? 1000 : 0; // 活四 / 冲四
  if (count === 3) return open === 2 ? 1000 : open === 1 ? 100 : 0; // 活三 / 眠三
  if (count === 2) return open === 2 ? 100 : open === 1 ? 10 : 0; // 活二 / 眠二
  if (count === 1) return open === 2 ? 10 : 0;
  return 0;
}

/** 在空格 idx 落 player 的进攻价值：四方向棋形分之和 */
export function evaluatePoint(board: number[], idx: number, player: number): number {
  const x0 = idx % SIZE;
  const y0 = Math.floor(idx / SIZE);
  let total = 0;
  for (const [dx, dy] of DIRS) {
    let count = 1;
    let x = x0 + dx;
    let y = y0 + dy;
    while (inBounds(x, y) && board[y * SIZE + x] === player) { count += 1; x += dx; y += dy; }
    const fOpen = inBounds(x, y) && board[y * SIZE + x] === EMPTY;
    x = x0 - dx;
    y = y0 - dy;
    while (inBounds(x, y) && board[y * SIZE + x] === player) { count += 1; x -= dx; y -= dy; }
    const bOpen = inBounds(x, y) && board[y * SIZE + x] === EMPTY;
    total += shapeScore(count, (fOpen ? 1 : 0) + (bOpen ? 1 : 0));
  }
  return total;
}

/** 全盘静态评估（从 me 视角）：己方棋形分 - 对方棋形分，按"连段起点"去重 */
export function evaluateBoard(board: number[], me: number): number {
  let score = 0;
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (p === EMPTY) continue;
    const x0 = i % SIZE;
    const y0 = Math.floor(i / SIZE);
    for (const [dx, dy] of DIRS) {
      // 只从连段起点计（前一格非同色），避免重复计同一段
      const px = x0 - dx;
      const py = y0 - dy;
      if (inBounds(px, py) && board[py * SIZE + px] === p) continue;
      let count = 0;
      let x = x0;
      let y = y0;
      while (inBounds(x, y) && board[y * SIZE + x] === p) { count += 1; x += dx; y += dy; }
      const fOpen = inBounds(x, y) && board[y * SIZE + x] === EMPTY;
      const bOpen = inBounds(px, py) && board[py * SIZE + px] === EMPTY;
      const s = shapeScore(count, (fOpen ? 1 : 0) + (bOpen ? 1 : 0));
      score += p === me ? s : -s;
    }
  }
  return score;
}

/** 邻近任一棋子（棋盘距离 ≤2）的空格；空盘返回 [天元] */
export function candidates(board: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  let hasStone = false;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY) continue;
    hasStone = true;
    const x0 = i % SIZE;
    const y0 = Math.floor(i / SIZE);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (!inBounds(x, y)) continue;
        const j = y * SIZE + x;
        if (board[j] === EMPTY && !seen.has(j)) { seen.add(j); out.push(j); }
      }
    }
  }
  if (!hasStone) return [CENTER];
  return out;
}

/** 按"攻防合计价值"降序排列候选（稳定：同分按下标升序） */
function orderedCandidates(board: number[], forPlayer: number): number[] {
  const opp = other(forPlayer);
  const cands = candidates(board);
  return cands
    .map((idx) => ({ idx, s: evaluatePoint(board, idx, forPlayer) + evaluatePoint(board, idx, opp) }))
    .sort((a, b) => b.s - a.s || a.idx - b.idx)
    .map((e) => e.idx);
}

/** minimax + α-β，返回从 me 视角的局面价值 */
function minimaxValue(
  board: number[], toMove: number, me: number, depth: number, alpha: number, beta: number,
): number {
  const cands = orderedCandidates(board, toMove);
  // 立即胜检测：toMove 有一手连五即定局
  for (const c of cands) {
    board[c] = toMove;
    const win = checkWin(board, c, toMove);
    board[c] = EMPTY;
    if (win) return toMove === me ? WIN_SCORE : -WIN_SCORE;
  }
  if (depth <= 0 || cands.length === 0) return evaluateBoard(board, me);
  const isMax = toMove === me;
  let best = isMax ? -Infinity : Infinity;
  for (const c of cands.slice(0, TOP_K)) {
    board[c] = toMove;
    const v = minimaxValue(board, other(toMove), me, depth - 1, alpha, beta);
    board[c] = EMPTY;
    if (isMax) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }
  return best;
}

/**
 * 为 player 求一手最佳落子（depth 越大越强）。
 * 传入 rand 时在"并列最优手"中随机取一个，避免 AI 逐盘复刻同一棋谱；
 * 省略 rand 则严格确定（取下标最小的最优手），供单测复现。
 * 战术必然手（能连五 / 唯一封堵）因最优手唯一，抖动不改变结果。
 */
export function findBestMove(board: number[], player: number, depth: number, rand?: () => number): number {
  if (board.every((v) => v === EMPTY)) return CENTER;
  const cands = orderedCandidates(board, player);
  if (cands.length === 0) return -1; // 满盘（不可达，防御性）
  // 己方能连五则直接落
  for (const c of cands) {
    board[c] = player;
    const win = checkWin(board, c, player);
    board[c] = EMPTY;
    if (win) return c;
  }
  let best = -Infinity;
  let bestMoves: number[] = [cands[0]];
  for (const c of cands.slice(0, TOP_K)) {
    board[c] = player;
    const v = minimaxValue(board, other(player), player, depth - 1, -Infinity, Infinity);
    board[c] = EMPTY;
    if (v > best) { best = v; bestMoves = [c]; }
    else if (v === best) bestMoves.push(c);
  }
  if (rand && bestMoves.length > 1) return bestMoves[Math.floor(rand() * bestMoves.length)];
  return bestMoves[0];
}
