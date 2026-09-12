import { SIZE, EMPTY, CENTER, DIRS, inBounds, other, checkWin } from './logic';

export interface AiLevel {
  id: 'easy' | 'medium' | 'hard';
  name: string;
  depth: number;
}

export const AI_LEVELS: AiLevel[] = [
  { id: 'easy', name: 'Easy', depth: 1 },
  { id: 'medium', name: 'Medium', depth: 2 },
  { id: 'hard', name: 'Hard', depth: 4 },
];

const WIN_SCORE = 1e9;
const TOP_K = 12; // candidates searched per ply (pruning)

/** Shape score: count = stones in a row, open = open ends (0/1/2) */
function shapeScore(count: number, open: number): number {
  if (count >= 5) return 100000; // five
  // A blocked four must outscore an open three: a four demands an immediate answer, a three is
  // only a threat. Tied, the AI saw "ignore their four and build my own three" as just as good as blocking
  if (count === 4) return open === 2 ? 10000 : open === 1 ? 3000 : 0; // open four / blocked four
  if (count === 3) return open === 2 ? 1000 : open === 1 ? 100 : 0; // open three / blocked three
  if (count === 2) return open === 2 ? 100 : open === 1 ? 10 : 0; // open two / blocked two
  if (count === 1) return open === 2 ? 10 : 0;
  return 0;
}

/** Attacking value of player placing at empty idx: sum of the shape scores in four directions */
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

/** Static evaluation of the whole board from me's view: own shapes minus theirs, deduplicated by run start */
export function evaluateBoard(board: number[], me: number): number {
  let score = 0;
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (p === EMPTY) continue;
    const x0 = i % SIZE;
    const y0 = Math.floor(i / SIZE);
    for (const [dx, dy] of DIRS) {
      // Count only from the start of a run (previous cell not the same colour) so no run is counted twice
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

/** Empty cells within distance 2 of any stone; an empty board returns [CENTER] */
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

/** Candidates ordered by attack + defence value, descending (stable: ties by ascending index) */
function orderedCandidates(board: number[], forPlayer: number): number[] {
  const opp = other(forPlayer);
  const cands = candidates(board);
  return cands
    .map((idx) => ({ idx, s: evaluatePoint(board, idx, forPlayer) + evaluatePoint(board, idx, opp) }))
    .sort((a, b) => b.s - a.s || a.idx - b.idx)
    .map((e) => e.idx);
}

/** Minimax with α-β; returns the position's value from me's view */
function minimaxValue(
  board: number[], toMove: number, me: number, depth: number, alpha: number, beta: number,
): number {
  const cands = orderedCandidates(board, toMove);
  // Immediate win check: if toMove can make five, the position is decided
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
 * Best move for player (deeper is stronger).
 * With rand, one of the tied best moves is picked at random so the AI doesn't replay the same
 * game every time; without it the result is deterministic (lowest index), for tests.
 * Forced tactical moves (making five / the only block) have a unique best, so the jitter never changes them.
 */
export function findBestMove(board: number[], player: number, depth: number, rand?: () => number): number {
  if (board.every((v) => v === EMPTY)) return CENTER;
  const cands = orderedCandidates(board, player);
  if (cands.length === 0) return -1; // full board (unreachable, defensive)
  // Take an immediate five if there is one
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
