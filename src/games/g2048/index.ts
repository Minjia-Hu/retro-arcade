import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { createScreenCanvas } from '../../core/screen';
import { padScore } from '../../core/format';
import * as L from './logic';

const PAD = 8;
const CELL = 71;
const W = L.SIZE * CELL + (L.SIZE + 1) * PAD; // 4*71 + 5*8 = 324
const H = W;

/** 纸盘配色（设计稿 2d 的 T 对象） */
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

  let head: { score: HTMLElement; best: HTMLElement; undo: HTMLButtonElement } | null = null;
  let shownScore = '';
  let shownBest = '';

  /** 浮层盖住棋盘时，输入整体冻结（照 SUDOKU 的 frozen() 写法） */
  function frozen(): boolean {
    return paused || Boolean(ctx?.overlayOpen());
  }

  function buildHead(host: HTMLElement): void {
    host.innerHTML = `
      <div class="head-card"><span class="head-label">SCORE</span><span data-ref="score">000000</span></div>
      <div class="head-card"><span class="head-label">BEST</span><span data-ref="best">000000</span></div>
      <button class="head-btn" data-ref="undo" aria-label="撤销">↩ UNDO</button>`;
    const q = <T extends HTMLElement>(r: string) => host.querySelector<T>(`[data-ref="${r}"]`)!;
    head = { score: q('score'), best: q('best'), undo: q<HTMLButtonElement>('undo') };
    head.undo.addEventListener('click', () => {
      head!.undo.blur();
      doUndo();
    });
    shownScore = '';
    shownBest = '';
  }

  /** 每帧同步；只在值变了才写 DOM */
  function syncHead(): void {
    if (!head) return;
    const s = padScore(state.score, 6);
    if (s !== shownScore) { shownScore = s; head.score.textContent = s; }
    const b = padScore(best, 6);
    if (b !== shownBest) { shownBest = b; head.best.textContent = b; }
    head.undo.disabled = !state.prev;
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
              // logic.ts 的 move() 在 status !== 'playing' 时直接拒绝移动，
              // 光收浮层不够——必须显式把状态切回 playing，否则棋盘会卡死。
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
    // ≤4 用软描边，≥8 用墨色描边（设计稿 2d）
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
      tools: [{ id: 'new', label: '↺ NEW', aria: '新局' }],
    },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      best = ctx.storage.get('best.g2048', 0);
      bestAtStart = best;
      ({ canvas, g } = createScreenCanvas(container, W, H));
      if (ctx.head) buildHead(ctx.head);
      ctx.onTool('new', newGame);

      ctx.input.onSwipe(canvas, doMove);
      ctx.input.onKey((code) => {
        if (frozen()) return;
        const dir = KEY_DIR[code];
        if (dir) doMove(dir);
        else if (code === 'KeyZ') doUndo();
      });

      loop = new GameLoop(() => {}, render); // 无时间模拟，仅驱动渲染
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
      ctx = null; // 事件监听由 frame 的 InputService.dispose() 统一清理
    },
  };
}
