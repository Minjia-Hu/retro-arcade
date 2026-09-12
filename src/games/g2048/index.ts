import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { createScreenCanvas } from '../../core/screen';
import { padScore } from '../../core/format';
import * as L from './logic';

const PAD = 8;
const CELL = 71;
const W = L.SIZE * CELL + (L.SIZE + 1) * PAD; // 4*71 + 5*8 = 324
const H = W;

/** Paper palette (the T object in mockup 2d) */
const WELL = '#efe5d3';
const EMPTY_LINE = '#ddd1bc';
const INK = '#2b2118';
const TILE: Record<number, [bg: string, fg: string]> = {
  2: ['#f6efe3', '#8a7a66'],
  4: ['#efe0c3', '#8a7a66'],
  8: ['#ffd9a8', INK],
  16: ['#ffbe76', INK],
  32: ['#ff8c42', '#fffaf0'],
  64: ['#e8590c', '#fffaf0'],
  128: ['#d6336c', '#fffaf0'],
  256: ['#0b7285', '#fffaf0'],
};
const TILE_SUPER: [string, string] = ['#0b7285', '#fffaf0'];
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const KEY_DIR: Record<string, L.Dir> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export function createG2048(): Game {
  let state = L.createState();
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let loop: GameLoop | null = null;
  let ctx: GameContext | null = null;
  let best = 0;
  let bestAtStart = 0;
  let paused = false;
  let endedAt = 0;

  let head: { score: HTMLElement; best: HTMLElement; undo: HTMLButtonElement } | null = null;
  let shownScore = '';
  let shownBest = '';
  let shownUndoOff: boolean | null = null;

  /** All input freezes while an overlay covers the board (same frozen() as SUDOKU) */
  function frozen(): boolean {
    return paused || Boolean(ctx?.overlayOpen());
  }

  function buildHead(host: HTMLElement): void {
    host.innerHTML = `
      <div class="head-card"><span class="head-label">SCORE</span><span data-ref="score">000000</span></div>
      <div class="head-card"><span class="head-label">BEST</span><span data-ref="best">000000</span></div>
      <button class="head-btn" data-ref="undo" aria-label="Undo">↩ UNDO</button>`;
    const q = <T extends HTMLElement>(r: string) => host.querySelector<T>(`[data-ref="${r}"]`)!;
    head = { score: q('score'), best: q('best'), undo: q<HTMLButtonElement>('undo') };
    head.undo.addEventListener('click', () => {
      head!.undo.blur();
      doUndo();
    });
    shownScore = '';
    shownBest = '';
    shownUndoOff = null;
  }

  /** Synced every frame; writes the DOM only when a value changed */
  function syncHead(): void {
    if (!head) return;
    const s = padScore(state.score, 6);
    if (s !== shownScore) { shownScore = s; head.score.textContent = s; }
    const b = padScore(best, 6);
    if (b !== shownBest) { shownBest = b; head.best.textContent = b; }
    // With an overlay open, doUndo is blocked by frozen() but the button still looked enabled — the
    // head bar sits outside .screen and is clickable, so clicks did nothing with no feedback.
    // The disabled state now reflects frozen() too, and this was the one uncached value here
    const off = !state.prev || frozen();
    if (off !== shownUndoOff) { shownUndoOff = off; head.undo.disabled = off; }
  }

  /**
   * While the result overlay is up, Space / a canvas tap = ▶ NEW GAME. Only for `over`: the
   * 2048! overlay is a KEEP GOING / NEW GAME choice that Space must not make for the player.
   * Returns whether the input was consumed.
   */
  function restartIfEnded(): boolean {
    if (!ctx?.overlayOpen() || state.status !== 'over') return false;
    if (performance.now() - endedAt >= 400) newGame(); // inputs pile up at the moment the game ends
    return true;
  }

  function newGame(): void {
    state = L.createState();
    bestAtStart = best;
    ctx?.overlay(null);
  }

  function reportEnd(): void {
    const record = state.score > bestAtStart;
    if (state.status === 'won') {
      ctx?.overlay({
        title: '2048!',
        tone: 'win',
        lines: [`SCORE ${padScore(state.score, 6)}`, `BEST ${padScore(best, 6)}`],
        actions: [
          {
            label: '▶ KEEP GOING',
            onPress: () => {
              // logic.ts' move() refuses to move unless status is 'playing'; dismissing the
              // overlay isn't enough — the status must be switched back or the board is stuck.
              L.continueAfterWin(state);
              ctx?.overlay(null);
            },
          },
          { label: '↺ NEW GAME', kind: 'secondary', onPress: newGame },
        ],
        hints: ['KEEP GOING OR START OVER'],
      });
      return;
    }
    ctx?.overlay({
      title: record ? 'NEW HIGH SCORE' : 'GAME OVER',
      tone: record ? 'record' : 'lose',
      lines: [`SCORE ${padScore(state.score, 6)}`, `BEST ${padScore(best, 6)}`],
      actions: [{ label: '▶ NEW GAME', onPress: newGame }],
      hints: ['SPACE / TAP FOR A NEW GAME'],
    });
  }

  function doMove(dir: L.Dir): void {
    if (frozen()) return;
    const prevStatus = state.status;
    if (!L.move(state, dir)) return;
    ctx?.audio.play('action');
    if (state.score > best) {
      best = state.score;
      ctx?.storage.set('best.g2048', best);
    }
    if (state.status !== prevStatus) {
      endedAt = performance.now();
      if (state.status === 'won') ctx?.audio.play('win');
      else if (state.status === 'over') ctx?.audio.play('over');
      if (state.status !== 'playing') reportEnd();
    }
  }

  function doUndo(): void {
    if (frozen()) return;
    if (L.undo(state)) ctx?.audio.play('click');
  }

  function drawTile(x: number, y: number, v: number): void {
    if (!g) return;
    const px = PAD + x * (CELL + PAD);
    const py = PAD + y * (CELL + PAD);
    if (v === 0) {
      g.strokeStyle = EMPTY_LINE;
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
      g.setLineDash([]);
      return;
    }
    const [bg, fg] = TILE[v] ?? TILE_SUPER;
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(px, py, CELL, CELL, 8);
    g.fill();
    // ≤4 gets a soft stroke, ≥8 an ink stroke (mockup 2d)
    g.strokeStyle = v <= 4 ? EMPTY_LINE : INK;
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(px + 1, py + 1, CELL - 2, CELL - 2, 7);
    g.stroke();
    g.fillStyle = fg;
    g.font = `700 ${v >= 128 ? 22 : 26}px ${MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(v), px + CELL / 2, py + CELL / 2 + 1);
  }

  function render(): void {
    if (!g) return;
    g.fillStyle = WELL;
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < L.SIZE; y++) {
      for (let x = 0; x < L.SIZE; x++) drawTile(x, y, state.board[y * L.SIZE + x]);
    }
    syncHead();
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  return {
    meta: {
      id: 'g2048',
      name: '2048',
      icon: '🔢',
      displayName: '2048',
      hints: ['↑↓←→ / SWIPE TO MERGE', 'Z UNDO'],
      screen: 'paper',
      head: true,
      pausable: false,
      tools: [{ id: 'new', label: '↺ NEW', aria: 'New game' }],
    },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      best = ctx.storage.get('best.g2048', 0);
      bestAtStart = best;
      ({ canvas, g } = createScreenCanvas(container, W, H));
      if (ctx.head) buildHead(ctx.head);
      ctx.onTool('new', newGame);

      ctx.input.onSwipe(canvas, doMove);
      ctx.input.onTapAt(canvas, () => { restartIfEnded(); }); // exclusive with onSwipe: a tap is <10px of movement
      ctx.input.onKey((code) => {
        if ((code === 'Space' || code === 'Enter') && restartIfEnded()) return;
        if (frozen()) return;
        const dir = KEY_DIR[code];
        if (dir) doMove(dir);
        else if (code === 'KeyZ') doUndo();
      });

      loop = new GameLoop(() => {}, render); // no simulation, just drives rendering
      loop.start();
    },

    pause(): void {
      paused = true;
      loop?.pause();
    },

    resume(): void {
      paused = false;
      loop?.resume();
    },

    destroy(): void {
      loop?.stop();
      loop = null;
      canvas?.remove();
      canvas = null;
      g = null;
      head = null;
      ctx = null; // listeners are cleaned up by frame's InputService.dispose()
    },
  };
}
