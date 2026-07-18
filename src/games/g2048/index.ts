import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { THEME } from '../../core/theme';
import * as L from './logic';

const W = 320;
const H = 480;
const PAD = 7;
const CELL = 71; // 4*71 + 5*7 = 319 ≈ 棋盘宽 320
const BOARD_X = 0;
const BOARD_Y = 100;
const BOARD_SIZE = SIZE_PX();
const UNDO_RECT = { x: W / 2 - 60, y: 432, w: 120, h: 34 };

function SIZE_PX(): number {
  return L.SIZE * CELL + (L.SIZE + 1) * PAD;
}

// 经典 2048 配色（Gabriele Cirulli 原版）
const BOARD_BG = '#bbada0';
const CELL_EMPTY = '#cdc1b4';
const TILE_SUPER = '#3c3a32'; // 4096 及以上
const TEXT_DARK = '#776e65'; // 2/4 与遮罩文字
const TEXT_LIGHT = '#f9f6f2'; // 8 及以上
const TILE_COLORS: Record<number, string> = {
  2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563',
  32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61',
  512: '#edc850', 1024: '#edc22e', 2048: '#edc22e',
};

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
  let paused = false;
  let endedAt = 0; // won/over 出现时刻，防连点误触

  function doMove(dir: L.Dir): void {
    if (paused) return;
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
    }
  }

  function doUndo(): void {
    if (paused) return;
    if (L.undo(state)) ctx?.audio.play('click');
  }

  /** 胜利界面 → 继续；终局界面 → 重开（带 400ms 防连点） */
  function primary(): boolean {
    if (state.status === 'playing') return false;
    if (performance.now() - endedAt < 400) return true;
    if (state.status === 'won') L.continueAfterWin(state);
    else state = L.createState();
    ctx?.audio.play('click');
    return true;
  }

  function tapAt(cssX: number, cssY: number): void {
    if (paused || !canvas) return;
    // CSS 像素 → 逻辑坐标（映射依赖 style.height 保持 auto、元素盒恒为 2:3，勿显式设高）
    const rect = canvas.getBoundingClientRect();
    const x = (cssX / rect.width) * W;
    const y = (cssY / rect.height) * H;
    // 撤销按钮位于覆盖层之外，必须先于 primary 判定，触屏用户才能从 won/over 撤销
    if (x >= UNDO_RECT.x && x <= UNDO_RECT.x + UNDO_RECT.w
      && y >= UNDO_RECT.y && y <= UNDO_RECT.y + UNDO_RECT.h) {
      doUndo();
      return;
    }
    primary();
  }

  function drawTile(x: number, y: number, v: number): void {
    if (!g) return;
    const px = BOARD_X + PAD + x * (CELL + PAD);
    const py = BOARD_Y + PAD + y * (CELL + PAD);
    if (v === 0) {
      g.fillStyle = CELL_EMPTY;
      g.fillRect(px, py, CELL, CELL);
      return;
    }
    g.fillStyle = TILE_COLORS[v] ?? TILE_SUPER;
    g.fillRect(px, py, CELL, CELL);
    g.fillStyle = v <= 4 ? TEXT_DARK : TEXT_LIGHT;
    const len = String(v).length;
    g.font = `bold ${len <= 2 ? 28 : len === 3 ? 24 : 18}px ${THEME.font}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(v), px + CELL / 2, py + CELL / 2 + 1);
  }

  function render(): void {
    if (!g) return;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, W, H);
    g.textBaseline = 'alphabetic';

    // 计分
    g.textAlign = 'left';
    g.fillStyle = THEME.text;
    g.font = `bold 20px ${THEME.font}`;
    g.fillText(`分数 ${state.score}`, 10, 44);
    g.textAlign = 'right';
    g.fillStyle = THEME.dim;
    g.font = `14px ${THEME.font}`;
    g.fillText(`BEST ${best}`, W - 10, 44);

    // 经典米棕色棋盘底板（与暗色页面强对比，"边界可见"规矩由底板本身满足）
    g.fillStyle = BOARD_BG;
    g.fillRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);

    for (let y = 0; y < L.SIZE; y++) {
      for (let x = 0; x < L.SIZE; x++) {
        drawTile(x, y, state.board[y * L.SIZE + x]);
      }
    }

    // 撤销按钮（drawTile 会把 textBaseline 设为 middle，此处显式复位防止文字下沉）
    g.textBaseline = 'alphabetic';
    g.strokeStyle = state.prev ? THEME.neonCyan : THEME.dim;
    g.strokeRect(UNDO_RECT.x, UNDO_RECT.y, UNDO_RECT.w, UNDO_RECT.h);
    g.fillStyle = state.prev ? THEME.neonCyan : THEME.dim;
    g.font = `14px ${THEME.font}`;
    g.textAlign = 'center';
    g.fillText('↩ 撤销 (Z)', W / 2, UNDO_RECT.y + 22);

    // 终局覆盖层（经典半透明米色遮罩 + 深棕文字）
    if (state.status !== 'playing') {
      g.fillStyle = 'rgba(238, 228, 218, 0.73)';
      g.fillRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);
      g.textAlign = 'center';
      g.fillStyle = TEXT_DARK;
      g.font = `bold 26px ${THEME.font}`;
      g.fillText(state.status === 'won' ? '达成 2048！' : 'GAME OVER', W / 2, BOARD_Y + BOARD_SIZE / 2 - 12);
      g.font = `14px ${THEME.font}`;
      g.fillText(
        state.status === 'won' ? '点按继续 · Z 撤销' : `BEST ${best} · 点按重来 · Z 撤销`,
        W / 2,
        BOARD_Y + BOARD_SIZE / 2 + 20,
      );
    }
  }

  return {
    meta: { id: 'g2048', name: '2048', icon: '🔢' },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      best = ctx.storage.get('best.g2048', 0);
      canvas = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`; // CSS 尺寸不变；backing store 按 DPR 放大保证高分屏清晰
      canvas.style.touchAction = 'none';
      container.appendChild(canvas);
      g = canvas.getContext('2d')!;
      g.scale(dpr, dpr);

      ctx.input.onSwipe(canvas, doMove);
      ctx.input.onTapAt(canvas, tapAt);
      ctx.input.onKey((code) => {
        if (paused) return;
        const dir = KEY_DIR[code];
        if (dir) doMove(dir);
        else if (code === 'KeyZ') doUndo();
        else if (code === 'Space' || code === 'Enter') primary();
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
      ctx = null; // 事件监听由 frame 的 InputService.dispose() 统一清理
    },
  };
}
