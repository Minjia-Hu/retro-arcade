import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { createScreenCanvas } from '../../core/screen';
import * as L from './logic';
import { AI_LEVELS, findBestMove, type AiLevel } from './ai';

const W = 320;
const H = 320;
const MARGIN = 20;
const GAP = (W - 2 * MARGIN) / (L.SIZE - 1); // spacing between intersections
const STONE_R = 11; // stone diameter 22

function at(x: number, y: number): number { return y * L.SIZE + x; }
function px(c: number): number { return MARGIN + c * GAP; }

const STAR = [at(3, 3), at(11, 3), at(3, 11), at(11, 11), L.CENTER]; // star points

/** Paper palette (mockup 2f) */
const PAPER = {
  board: '#efe0c3',
  line: '#b5a88f',
  ink: '#2b2118',
  black: '#2b2118',
  white: '#fffaf0',
  whiteShade: '#ddd1bc',
  hover: '#d6336c',
  shadow: 'rgba(43, 33, 24, .3)',
} as const;

const MODES: { id: 'pvp' | AiLevel['id']; label: string }[] = [
  { id: 'pvp', label: '2 PLAYERS' },
  { id: 'easy', label: 'AI EASY' },
  { id: 'medium', label: 'AI MEDIUM' },
  { id: 'hard', label: 'AI HARD' },
];

/**
 * Short labels for the top-bar pill: cab-pill doesn't wrap, and the two-word MODES labels
 * ("2 PLAYERS") next to a long displayName like GOMOKU forced a line break and squeezed the
 * game name into an ellipsis. The pill needs one word; overlay buttons keep the full MODES labels.
 */
const PILL_LABEL: Record<'pvp' | AiLevel['id'], string> = {
  pvp: 'PVP', easy: 'EASY', medium: 'MEDIUM', hard: 'HARD',
};
const PLAY_HINTS = ['CLICK TO PLACE', 'FIVE IN A ROW WINS'];

export function createGomoku(): Game {
  let game: L.GomokuState | null = null; // null = not started (mode menu open)
  let mode: 'pvp' | AiLevel['id'] = 'pvp';
  let aiLevel: AiLevel | null = null; // null = two players
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let loop: GameLoop | null = null;
  let ctx: GameContext | null = null;
  let paused = false;
  let thinking = false;
  let worker: Worker | null = null;
  let token = 0; // invalidates stale Worker replies (after restart / back to menu)
  let endedAt = 0; // result shortcut is armed only while the result card is open
  let hover = -1; // hovered intersection, -1 = none
  let hoverCleanup: (() => void) | null = null;

  let head: { black: HTMLElement; white: HTMLElement; result: HTMLElement; newGame: HTMLButtonElement } | null = null;
  let shownAi: boolean | null = null; // cache for the turn-chip labels; reset in buildHead

  function buildHead(host: HTMLElement): void {
    host.innerHTML = `
      <div class="chip" data-ref="black" aria-label="Black">● BLACK</div>
      <div class="chip" data-ref="white" aria-label="White">○ WHITE</div>
      <span class="chip" data-ref="result" role="status" hidden></span>
      <button class="head-btn" data-ref="new-game" hidden>▶ NEW GAME</button>`;
    const q = (r: string) => host.querySelector<HTMLElement>(`[data-ref="${r}"]`)!;
    const newGame = q('new-game') as HTMLButtonElement;
    newGame.addEventListener('click', () => {
      newGame.blur();
      showMenu();
    });
    head = { black: q('black'), white: q('white'), result: q('result'), newGame };
    shownAi = false; // matches the hard-coded BLACK/WHITE defaults above
  }

  /** Labels follow the mode: YOU/CPU against the AI, BLACK/WHITE for two players (the mockup only shows the AI case) */
  function syncHead(): void {
    if (!head || !game) return;
    // The labels only change with the mode, but writing them every frame rebuilds text nodes — cached like 2048/MINES
    const ai = mode !== 'pvp';
    if (ai !== shownAi) {
      shownAi = ai;
      head.black.textContent = ai ? '● YOU' : '● BLACK';
      head.white.textContent = ai ? '○ CPU' : '○ WHITE';
    }
    const turn = game.turn;
    const ended = game.status !== 'playing';
    head.black.hidden = ended;
    head.white.hidden = ended;
    head.result.hidden = !ended;
    head.newGame.hidden = !ended;
    const title = ended ? resultTitle() : '';
    if (head.result.textContent !== title) head.result.textContent = title;
    head.black.classList.toggle('is-turn', turn === L.BLACK && game.status === 'playing');
    head.white.classList.toggle('is-turn', turn === L.WHITE && game.status === 'playing');
  }

  /** All input freezes while an overlay covers the board (same frozen() as SUDOKU) */
  function frozen(): boolean {
    return paused || Boolean(ctx?.overlayOpen());
  }

  function humanCanPlay(): boolean {
    if (!game || game.status !== 'playing' || thinking) return false;
    if (aiLevel && game.turn === L.WHITE) return false; // the AI's turn
    return true;
  }

  function canInteract(): boolean {
    return !frozen() && humanCanPlay();
  }

  function ensureWorker(): Worker | null {
    if (worker) return worker;
    try {
      worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent) => {
        const { idx, token: replyToken } = e.data as { idx: number; token: number };
        if (replyToken !== token) return; // stale reply: the player went back to the menu or started over. Check before clearing thinking, or an old game's reply unfreezes the new one
        thinking = false;
        if (paused || !game || game.status !== 'playing') return;
        applyAiMove(idx);
      };
      return worker;
    } catch {
      worker = null; // no Worker support: fall back to the main thread
      return null;
    }
  }

  function requestAi(): void {
    if (!game || !aiLevel || game.status !== 'playing') return;
    thinking = true;
    const w = ensureWorker();
    if (w) {
      w.postMessage({ board: game.board.slice(), player: game.turn, depth: aiLevel.depth, token });
    } else {
      // No Worker: compute on the main thread (playable, may stutter briefly)
      const idx = findBestMove(game.board.slice(), game.turn, aiLevel.depth, Math.random);
      applyAiMove(idx);
    }
  }

  function applyAiMove(idx: number): void {
    thinking = false;
    if (!game || game.status !== 'playing') return;
    if (L.playMove(game, idx)) afterMove();
  }

  function afterMove(): void {
    if (!game) return;
    if (game.status === 'won' || game.status === 'draw') {
      ctx?.audio.play(game.status === 'won' ? 'win' : 'over');
      reportEnd();
    } else {
      ctx?.audio.play('action');
      if (aiLevel && game.turn === L.WHITE) requestAi();
    }
  }

  function startGame(m: 'pvp' | AiLevel['id']): void {
    mode = m;
    game = L.createGame();
    aiLevel = m === 'pvp' ? null : (AI_LEVELS.find((l) => l.id === m) ?? null);
    token += 1;
    thinking = false;
    hover = -1;
    endedAt = 0;
    ctx?.setHints(PLAY_HINTS);
    ctx?.overlay(null);
    ctx?.setPill(PILL_LABEL[m]);
    ctx?.audio.play('click');
    // The human is black and moves first, the AI is white; no opening request needed
  }

  function showMenu(): void {
    endedAt = 0;
    const resumable = game !== null && game.status === 'playing';
    const reviewable = game !== null && game.status !== 'playing';
    ctx?.overlay({
      title: 'GOMOKU',
      tone: 'win',
      lines: [],
      actions: [
        ...(resumable
          ? [{ label: '✕ RESUME', kind: 'secondary' as const, onPress: () => ctx?.overlay(null) }]
          : []),
        ...(reviewable
          ? [{ label: 'VIEW BOARD', kind: 'secondary' as const, onPress: viewBoard }]
          : []),
        ...MODES.map((m) => ({
          label: m.label, kind: 'secondary' as const, onPress: () => startGame(m.id),
        })),
      ],
      hints: [resumable ? 'RESUME OR PICK A MODE' : reviewable ? 'VIEW BOARD OR PICK A MODE' : 'PICK A MODE TO BEGIN'],
    });
  }

  function viewBoard(): void {
    if (!game || game.status === 'playing') return;
    endedAt = 0;
    hover = -1;
    ctx?.overlay(null);
  }

  /** Result shortcuts reveal the final board; menus and review never consume them. */
  function viewResultIfEnded(): boolean {
    if (!ctx?.overlayOpen() || !game || game.status === 'playing' || !endedAt) return false;
    if (performance.now() - endedAt >= 400) { // clicks pile up at the moment of the last move
      viewBoard();
    }
    return true;
  }

  function resultTitle(): string {
    if (!game || game.status === 'draw') return 'DRAW';
    if (mode !== 'pvp') return game.winner === L.BLACK ? 'YOU WIN' : 'CPU WINS';
    return game.winner === L.BLACK ? 'BLACK WINS' : 'WHITE WINS';
  }

  function reportEnd(): void {
    if (!game) return;
    endedAt = performance.now();
    const draw = game.status === 'draw';
    const humanWon = mode === 'pvp' || game.winner === L.BLACK;
    ctx?.setHints(draw
      ? ['FINAL BOARD', 'RING: LAST MOVE']
      : ['FINAL BOARD', 'RING: LAST MOVE', 'LINE: WINNING ROW']);
    ctx?.overlay({
      title: resultTitle(),
      tone: draw ? 'win' : humanWon ? 'win' : 'lose',
      lines: [MODES.find((m) => m.id === mode)!.label],
      actions: [
        { label: 'VIEW BOARD', onPress: viewBoard },
        { label: '▶ NEW GAME', kind: 'secondary', onPress: showMenu },
      ],
      hints: ['SPACE / TAP TO VIEW BOARD'],
    });
  }

  /** CSS coordinates → logic coordinates (the canvas is a fixed 320×320, no view scaling) */
  function toLogical(cssX: number, cssY: number): [number, number] {
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    return [(cssX / rect.width) * W, (cssY / rect.height) * H];
  }

  /** Nearest intersection; -1 when outside the board */
  function intersectionAt(cssX: number, cssY: number): number {
    const [x, y] = toLogical(cssX, cssY);
    const c = Math.round((x - MARGIN) / GAP);
    const r = Math.round((y - MARGIN) / GAP);
    if (c < 0 || c >= L.SIZE || r < 0 || r >= L.SIZE) return -1;
    return r * L.SIZE + c;
  }

  function placeStone(cssX: number, cssY: number): void {
    if (viewResultIfEnded()) return;
    if (!canInteract() || !game) return;
    const idx = intersectionAt(cssX, cssY);
    if (idx < 0 || game.board[idx] !== L.EMPTY) return;
    if (L.playMove(game, idx)) {
      hover = -1;
      afterMove();
    }
  }

  function updateHover(cssX: number, cssY: number): void {
    if (!canInteract() || !game) { hover = -1; return; }
    const idx = intersectionAt(cssX, cssY);
    hover = idx >= 0 && game.board[idx] === L.EMPTY ? idx : -1;
  }

  function clearHover(): void {
    hover = -1;
  }

  function drawBoardBase(): void {
    if (!g) return;
    g.fillStyle = PAPER.board;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = PAPER.line;
    g.lineWidth = 1;
    for (let k = 0; k < L.SIZE; k++) {
      g.beginPath();
      g.moveTo(px(0), px(k)); g.lineTo(px(L.SIZE - 1), px(k));
      g.moveTo(px(k), px(0)); g.lineTo(px(k), px(L.SIZE - 1));
      g.stroke();
    }
    g.fillStyle = PAPER.ink;
    for (const sIdx of STAR) {
      g.beginPath();
      g.arc(px(sIdx % L.SIZE), px(Math.floor(sIdx / L.SIZE)), 3, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawStone(idx: number, player: number): void {
    if (!g) return;
    const cx = px(idx % L.SIZE);
    const cy = px(Math.floor(idx / L.SIZE));
    // Shadow
    g.beginPath();
    g.arc(cx + 1, cy + 2, STONE_R, 0, Math.PI * 2);
    g.fillStyle = PAPER.shadow;
    g.fill();
    // Stone + ink stroke
    g.beginPath();
    g.arc(cx, cy, STONE_R, 0, Math.PI * 2);
    g.fillStyle = player === L.BLACK ? PAPER.black : PAPER.white;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = PAPER.ink;
    g.stroke();
    // Inner highlight (black) / shade (white)
    g.beginPath();
    g.arc(cx - STONE_R * 0.3, cy - STONE_R * 0.3, STONE_R * 0.4, 0, Math.PI * 2);
    g.fillStyle = player === L.BLACK ? 'rgba(255, 255, 255, .2)' : PAPER.whiteShade;
    g.fill();
  }

  function drawHoverGhost(): void {
    if (!g || hover < 0) return;
    const cx = px(hover % L.SIZE);
    const cy = px(Math.floor(hover / L.SIZE));
    g.save();
    g.setLineDash([4, 3]);
    g.lineWidth = 2;
    g.strokeStyle = PAPER.hover;
    g.beginPath();
    g.arc(cx, cy, STONE_R, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  /** Presentation only: highlight winning runs through the last move using logic.ts's directions. */
  function drawFinalMarkers(): void {
    if (!g || !game || game.status === 'playing' || game.last < 0) return;
    const x = game.last % L.SIZE;
    const y = Math.floor(game.last / L.SIZE);
    g.save();
    g.strokeStyle = PAPER.hover;
    g.lineWidth = 3;
    g.lineCap = 'round';
    if (game.status === 'won') {
      for (const [dx, dy] of L.DIRS) {
        let x1 = x, y1 = y, x2 = x, y2 = y;
        let count = 1;
        while (L.inBounds(x1 - dx, y1 - dy) && game.board[at(x1 - dx, y1 - dy)] === game.winner) {
          x1 -= dx; y1 -= dy; count++;
        }
        while (L.inBounds(x2 + dx, y2 + dy) && game.board[at(x2 + dx, y2 + dy)] === game.winner) {
          x2 += dx; y2 += dy; count++;
        }
        if (count < 5) continue;
        g.beginPath();
        g.moveTo(px(x1), px(y1));
        g.lineTo(px(x2), px(y2));
        g.stroke();
      }
    }
    // A contrasting centre keeps the last-move ring distinct from the winning line.
    g.beginPath();
    g.arc(px(x), px(y), 5, 0, Math.PI * 2);
    g.fillStyle = game.board[game.last] === L.BLACK ? PAPER.black : PAPER.white;
    g.fill();
    g.stroke();
    g.restore();
  }

  function render(): void {
    if (!g) return;
    drawBoardBase();
    if (game) {
      for (let i = 0; i < game.board.length; i++) {
        if (game.board[i] !== L.EMPTY) drawStone(i, game.board[i]);
      }
      drawFinalMarkers();
      if (canInteract()) drawHoverGhost();
    }
    syncHead();
  }

  return {
    meta: {
      id: 'gomoku',
      name: 'Gomoku',
      icon: '⚫',
      displayName: 'GOMOKU',
      hints: PLAY_HINTS,
      screen: 'paper',
      head: true,
      pausable: false,
      // ☰ (as in MINES/SUDOKU) rather than "↺ NEW": this button opens the mode menu, it doesn't
      // restart directly; and "↺ NEW" + the long name GOMOKU + the mode pill wrapped the top bar
      // (NEW on two lines, GOMOKU truncated). A single-character button frees exactly enough room.
      tools: [{ id: 'menu', label: '☰', aria: 'Mode menu' }],
    },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      ({ canvas, g } = createScreenCanvas(container, W, H));

      if (ctx.head) buildHead(ctx.head);
      ctx.onTool('menu', () => showMenu());

      ctx.input.onTapAt(canvas, placeStone);
      ctx.input.onKey((code) => {
        if (code !== 'Space' && code !== 'Enter') return;
        // Let a focused native button own the action. InputService prevents Space's
        // default, so activate it here; Enter already has native button behavior.
        if (document.activeElement instanceof HTMLButtonElement) {
          if (code === 'Space') document.activeElement.click();
          return;
        }
        viewResultIfEnded();
      });

      // The hover ghost needs move coordinates, which InputService doesn't offer; native listeners go straight on the canvas
      const onMove = (e: PointerEvent) => {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        updateHover(e.clientX - rect.left, e.clientY - rect.top);
      };
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerleave', clearHover);
      canvas.addEventListener('pointercancel', clearHover);
      hoverCleanup = () => {
        canvas?.removeEventListener('pointermove', onMove);
        canvas?.removeEventListener('pointerleave', clearHover);
        canvas?.removeEventListener('pointercancel', clearHover);
      };

      // No save: every mount starts at the mode menu
      showMenu();

      loop = new GameLoop(() => {}, render); // no simulation, just drives rendering
      loop.start();
    },

    pause(): void { paused = true; loop?.pause(); },
    resume(): void { paused = false; loop?.resume(); },

    destroy(): void {
      loop?.stop();
      loop = null;
      token += 1; // invalidate in-flight Worker replies
      worker?.terminate();
      worker = null;
      hoverCleanup?.();
      hoverCleanup = null;
      canvas?.remove();
      canvas = null;
      g = null;
      head = null;
      ctx = null; // listeners are cleaned up by frame's InputService.dispose()
    },
  };
}
