import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { THEME } from '../../core/theme';
import * as L from './logic';

const W = 320;
const H = 540;
const CELL = 22;
const BOARD_X = 10;
const BOARD_Y = 10; // 棋盘 220×440，y 10..450
const SIDE_X = 240;
const REPEAT_DELAY = 0.11; // 按住左右/软降的重复间隔（秒）

// I O T S Z J L
const PIECE_COLORS = ['#00e5ff', '#ffe600', '#c084fc', '#6bcb77', '#ff6b6b', '#4d96ff', '#ffb86c'];

interface Btn {
  id: 'left' | 'right' | 'rotate' | 'soft' | 'hard' | 'hold';
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const BTN_Y = 464;
const BTNS: Btn[] = (['left', 'right', 'rotate', 'soft', 'hard', 'hold'] as const).map((id, i) => ({
  id,
  label: { left: '◀', right: '▶', rotate: '⟳', soft: '▼', hard: '⤓', hold: '⇄' }[id],
  x: 8 + i * 52,
  y: BTN_Y,
  w: 48,
  h: 60,
}));

export function createTetris(): Game {
  let state = L.createState();
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let loop: GameLoop | null = null;
  let ctx: GameContext | null = null;
  let best = 0;
  let paused = false;
  let endedAt = 0;
  let heldLeft = false;
  let heldRight = false;
  let heldSoft = false;
  let repeatTimer = 0;

  function saveBest(): void {
    if (state.score > best) {
      best = state.score;
      ctx?.storage.set('best.tetris', best);
    }
  }

  function afterEvents(ev: L.TetrisEvents): void {
    if (ev.locked) ctx?.audio.play('action');
    if (ev.cleared > 0) {
      ctx?.audio.play('score');
      saveBest();
    }
    if (ev.over) {
      endedAt = performance.now();
      saveBest();
      ctx?.audio.play('over');
    }
  }

  function primary(): void {
    if (paused) return;
    if (state.status === 'ready') {
      L.start(state);
      ctx?.audio.play('click');
    } else if (state.status === 'over') {
      if (performance.now() - endedAt < 400) return;
      state = L.createState();
      ctx?.audio.play('click');
    }
  }

  function act(id: Btn['id']): void {
    if (paused) return;
    if (state.status !== 'playing') {
      primary();
      return;
    }
    if (id === 'left') L.move(state, -1);
    else if (id === 'right') L.move(state, 1);
    else if (id === 'rotate') L.rotate(state);
    else if (id === 'soft') L.softDrop(state);
    else if (id === 'hard') afterEvents(L.hardDrop(state));
    else if (id === 'hold') doHold();
  }

  /** hold 也可能触发终局（换入的块出生即碰撞），必须补查 status */
  function doHold(): void {
    if (!L.holdPiece(state)) return;
    if (state.status === 'over') {
      endedAt = performance.now();
      saveBest();
      ctx?.audio.play('over');
    } else {
      ctx?.audio.play('click');
    }
  }

  function tapAt(cssX: number, cssY: number): void {
    if (paused || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (cssX / rect.width) * W;
    const y = (cssY / rect.height) * H;
    for (const b of BTNS) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        act(b.id);
        return;
      }
    }
    primary(); // 点棋盘区：开始 / 重开
  }

  function update(dt: number): void {
    // 按住重复（键盘）：左右互斥，软降独立
    if (state.status === 'playing' && (heldLeft !== heldRight || heldSoft)) {
      repeatTimer += dt;
      while (repeatTimer >= REPEAT_DELAY) {
        repeatTimer -= REPEAT_DELAY;
        if (heldLeft !== heldRight) L.move(state, heldRight ? 1 : -1);
        if (heldSoft) L.softDrop(state);
      }
    } else {
      repeatTimer = 0;
    }
    afterEvents(L.tick(state, dt));
  }

  function drawCell(px: number, py: number, size: number, type: number): void {
    if (!g) return;
    g.fillStyle = PIECE_COLORS[type];
    g.fillRect(px + 1, py + 1, size - 2, size - 2);
  }

  function drawMini(type: number | null, x0: number, y0: number): void {
    if (!g || type === null) return;
    const size = 12;
    const def = L.PIECE_DEFS[type];
    const off = (4 - def.size) * (size / 2); // 在 4×4 预览区内居中
    for (const [cx, cy] of L.rotatedCells(type, 0)) {
      drawCell(x0 + off + cx * size, y0 + off + cy * size, size, type);
    }
  }

  function render(): void {
    if (!g) return;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, W, H);
    g.textBaseline = 'alphabetic';

    // 棋盘边界（可见规矩）与已落块
    g.strokeStyle = THEME.neonCyan;
    g.lineWidth = 2;
    g.strokeRect(BOARD_X - 1, BOARD_Y - 1, L.COLS * CELL + 2, L.ROWS * CELL + 2);
    for (let y = 0; y < L.ROWS; y++) {
      for (let x = 0; x < L.COLS; x++) {
        const v = state.board[y * L.COLS + x];
        if (v !== 0) drawCell(BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, v - 1);
      }
    }

    // 当前块（y<0 的部分不画）
    if (state.status !== 'over') {
      for (const [cx, cy] of L.rotatedCells(state.current.type, state.current.rot)) {
        const y = state.current.y + cy;
        if (y >= 0) drawCell(BOARD_X + (state.current.x + cx) * CELL, BOARD_Y + y * CELL, CELL, state.current.type);
      }
    }

    // 侧栏：NEXT / HOLD / 分数
    g.fillStyle = THEME.dim;
    g.font = `11px ${THEME.font}`;
    g.textAlign = 'left';
    g.fillText('NEXT', SIDE_X, 24);
    drawMini(state.next, SIDE_X, 32);
    g.fillStyle = THEME.dim;
    g.fillText('HOLD', SIDE_X, 108);
    drawMini(state.hold, SIDE_X, 116);
    g.fillStyle = THEME.text;
    g.font = `bold 14px ${THEME.font}`;
    g.fillText(`${state.score}`, SIDE_X, 196);
    g.fillStyle = THEME.dim;
    g.font = `11px ${THEME.font}`;
    g.fillText(`行 ${state.lines}`, SIDE_X, 216);
    g.fillText(`级 ${L.levelOf(state.lines)}`, SIDE_X, 232);
    g.fillText(`BEST`, SIDE_X, 260);
    g.fillText(`${best}`, SIDE_X, 276);

    // 按键条
    for (const b of BTNS) {
      g.strokeStyle = THEME.neonCyan;
      g.lineWidth = 1.5;
      g.strokeRect(b.x, b.y, b.w, b.h);
      g.fillStyle = THEME.neonCyan;
      g.font = `20px ${THEME.font}`;
      g.textAlign = 'center';
      g.fillText(b.label, b.x + b.w / 2, b.y + 38);
    }
    g.textAlign = 'left';

    // 覆盖提示
    g.textAlign = 'center';
    g.font = `14px ${THEME.font}`;
    if (state.status === 'ready') {
      g.fillStyle = 'rgba(13, 13, 22, 0.75)';
      g.fillRect(BOARD_X, BOARD_Y + 160, L.COLS * CELL, 80);
      g.fillStyle = THEME.neonCyan;
      g.fillText('点按棋盘 / 回车 开始', BOARD_X + (L.COLS * CELL) / 2, BOARD_Y + 205);
    } else if (state.status === 'over') {
      g.fillStyle = 'rgba(13, 13, 22, 0.85)';
      g.fillRect(BOARD_X, BOARD_Y + 140, L.COLS * CELL, 110);
      g.fillStyle = THEME.neonPink;
      g.font = `bold 24px ${THEME.font}`;
      g.fillText('GAME OVER', BOARD_X + (L.COLS * CELL) / 2, BOARD_Y + 185);
      g.fillStyle = THEME.neonCyan;
      g.font = `13px ${THEME.font}`;
      g.fillText(`BEST ${best} · 点按重来`, BOARD_X + (L.COLS * CELL) / 2, BOARD_Y + 215);
    }
    g.textAlign = 'left';
  }

  return {
    meta: { id: 'tetris', name: '俄罗斯方块', icon: '🧱' },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      best = ctx.storage.get('best.tetris', 0);
      canvas = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`; // CSS 尺寸不变；backing store 按 DPR 放大保证高分屏清晰
      canvas.style.touchAction = 'none';
      canvas.style.userSelect = 'none';
      container.appendChild(canvas);
      g = canvas.getContext('2d')!;
      g.scale(dpr, dpr);

      ctx.input.onTapAt(canvas, tapAt);
      ctx.input.onKey((code) => {
        if (paused) return;
        if (state.status !== 'playing') {
          if (code === 'Enter' || code === 'Space') primary();
          return;
        }
        if (code === 'ArrowLeft' || code === 'KeyA') {
          heldLeft = true;
          L.move(state, -1);
        } else if (code === 'ArrowRight' || code === 'KeyD') {
          heldRight = true;
          L.move(state, 1);
        } else if (code === 'ArrowDown' || code === 'KeyS') {
          heldSoft = true;
          L.softDrop(state);
        } else if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyX') {
          L.rotate(state);
        } else if (code === 'Space') {
          afterEvents(L.hardDrop(state));
        } else if (code === 'KeyC') {
          doHold();
        }
      });
      ctx.input.onKeyUp((code) => {
        if (code === 'ArrowLeft' || code === 'KeyA') heldLeft = false;
        else if (code === 'ArrowRight' || code === 'KeyD') heldRight = false;
        else if (code === 'ArrowDown' || code === 'KeyS') heldSoft = false;
      });

      loop = new GameLoop(update, render);
      loop.start();
    },

    pause(): void {
      paused = true;
      loop?.pause();
    },

    resume(): void {
      paused = false;
      heldLeft = false; // 暂停期间的按键抬起收不到，复位防止恢复后自走
      heldRight = false;
      heldSoft = false;
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
