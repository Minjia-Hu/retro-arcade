import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { THEME } from '../../core/theme';
import * as L from './logic';
import { createScreenCanvas, resizeScreenCanvas } from '../../core/screen';

const MENU_W = 320;
const MENU_H = 480;
const MARGIN = 16; // board 左右留白：cols×cell 恒为 288，288+32=320
const HUD_H = 56;

// 1-8 数字的经典风配色（映射到霓虹主题）
const NUM_COLORS = ['', '#4d96ff', '#6bcb77', '#ff6b6b', '#c084fc', '#ffb86c', '#00e5ff', '#ff2fd6', '#e8e6ff'];

interface MenuButton {
  diff: L.Difficulty;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function createMinesweeper(): Game {
  let state: L.MineState | null = null; // null = 难度菜单
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let loop: GameLoop | null = null;
  let ctx: GameContext | null = null;
  let paused = false;
  let endedAt = 0;
  let viewW = MENU_W;
  let viewH = MENU_H;

  const menuButtons: MenuButton[] = L.DIFFICULTIES.map((d, i) => ({
    diff: d,
    x: 60,
    y: 160 + i * 80,
    w: 200,
    h: 56,
  }));

  function setCanvasSize(w: number, h: number): void {
    if (!canvas || !g) return;
    viewW = w;
    viewH = h;
    resizeScreenCanvas(canvas, g, w, h);
  }

  function startGame(diff: L.Difficulty): void {
    state = L.createState(diff);
    setCanvasSize(MENU_W, HUD_H + diff.rows * diff.cell + MARGIN);
    ctx?.audio.play('click');
  }

  function backToMenu(): void {
    state = null;
    setCanvasSize(MENU_W, MENU_H);
    ctx?.audio.play('click');
  }

  /** CSS 坐标 → 当前视图逻辑坐标 */
  function toLogical(cssX: number, cssY: number): [number, number] {
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    return [(cssX / rect.width) * viewW, (cssY / rect.height) * viewH];
  }

  /** 逻辑坐标 → 格子下标；不在棋盘内返回 -1 */
  function cellAt(x: number, y: number): number {
    if (!state) return -1;
    const { cols, rows, cell } = state.diff;
    const cx = Math.floor((x - MARGIN) / cell);
    const cy = Math.floor((y - HUD_H) / cell);
    if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return -1;
    return cy * cols + cx;
  }

  function onTapGesture(cssX: number, cssY: number): void {
    if (paused) return;
    const [x, y] = toLogical(cssX, cssY);
    if (!state) {
      for (const b of menuButtons) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          startGame(b.diff);
          return;
        }
      }
      return;
    }
    if (state.status === 'won' || state.status === 'lost') {
      if (performance.now() - endedAt < 400) return;
      backToMenu();
      return;
    }
    // HUD 右侧"菜单"热区
    if (y < HUD_H && x > viewW - 72) {
      backToMenu();
      return;
    }
    const idx = cellAt(x, y);
    if (idx < 0) return;
    const ev = L.reveal(state, idx);
    if (ev.exploded) {
      endedAt = performance.now();
      ctx?.audio.play('over');
    } else if (ev.won) {
      endedAt = performance.now();
      ctx?.audio.play('win');
    } else if (ev.revealedSome) {
      ctx?.audio.play('click');
    }
  }

  function onFlagGesture(cssX: number, cssY: number): void {
    if (paused || !state) return;
    const [x, y] = toLogical(cssX, cssY);
    const idx = cellAt(x, y);
    if (idx < 0) return;
    if (L.toggleFlag(state, idx)) ctx?.audio.play('action');
  }

  function renderMenu(): void {
    if (!g) return;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, viewW, viewH);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = THEME.neonYellow;
    g.font = `bold 30px ${THEME.font}`;
    g.fillText('扫 雷', viewW / 2, 90);
    g.fillStyle = THEME.dim;
    g.font = `12px ${THEME.font}`;
    g.fillText('点开格子 · 长按/右键插旗', viewW / 2, 118);
    for (const b of menuButtons) {
      g.strokeStyle = THEME.neonCyan;
      g.lineWidth = 2;
      g.strokeRect(b.x, b.y, b.w, b.h);
      g.fillStyle = THEME.neonCyan;
      g.font = `bold 18px ${THEME.font}`;
      g.fillText(b.diff.name, viewW / 2, b.y + 24);
      g.fillStyle = THEME.dim;
      g.font = `11px ${THEME.font}`;
      g.fillText(`${b.diff.cols}×${b.diff.rows} · ${b.diff.mines} 雷`, viewW / 2, b.y + 44);
    }
  }

  function renderBoard(s: L.MineState): void {
    if (!g) return;
    const { cols, rows, cell, mines, name } = s.diff;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, viewW, viewH);

    // HUD
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = THEME.neonPink;
    g.font = `bold 16px ${THEME.font}`;
    g.fillText(`💣 ${Math.max(0, mines - s.flags)}`, MARGIN, 36);
    g.textAlign = 'center';
    g.fillStyle = THEME.dim;
    g.font = `12px ${THEME.font}`;
    g.fillText(name, viewW / 2, 36);
    g.textAlign = 'right';
    g.fillStyle = THEME.neonCyan;
    g.fillText('☰ 菜单', viewW - MARGIN, 36);

    // 格子
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < s.grid.length; i++) {
      const c = s.grid[i];
      const px = MARGIN + (i % cols) * cell;
      const py = HUD_H + Math.floor(i / cols) * cell;
      if (c.revealed) {
        g.fillStyle = c.mine ? '#5e0b0b' : '#141220';
        g.fillRect(px, py, cell - 1, cell - 1);
        if (c.mine) {
          g.fillStyle = THEME.neonPink;
          g.beginPath();
          g.arc(px + cell / 2, py + cell / 2, cell * 0.28, 0, Math.PI * 2);
          g.fill();
        } else if (c.adj > 0) {
          g.fillStyle = NUM_COLORS[c.adj];
          g.font = `bold ${Math.floor(cell * 0.55)}px ${THEME.font}`;
          g.fillText(String(c.adj), px + cell / 2, py + cell / 2 + 1);
        }
      } else {
        g.fillStyle = '#242038';
        g.fillRect(px, py, cell - 1, cell - 1);
        if (c.flagged) {
          // 小旗：粉色三角 + 旗杆
          g.strokeStyle = THEME.text;
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(px + cell * 0.35, py + cell * 0.2);
          g.lineTo(px + cell * 0.35, py + cell * 0.8);
          g.stroke();
          g.fillStyle = THEME.neonPink;
          g.beginPath();
          g.moveTo(px + cell * 0.35, py + cell * 0.2);
          g.lineTo(px + cell * 0.75, py + cell * 0.35);
          g.lineTo(px + cell * 0.35, py + cell * 0.5);
          g.closePath();
          g.fill();
        }
      }
    }

    // 终局横幅
    if (s.status === 'won' || s.status === 'lost') {
      const cy = HUD_H + (rows * cell) / 2;
      g.fillStyle = 'rgba(13, 13, 22, 0.85)';
      g.fillRect(0, cy - 44, viewW, 88);
      g.textBaseline = 'alphabetic';
      g.fillStyle = s.status === 'won' ? THEME.neonGreen : THEME.neonPink;
      g.font = `bold 24px ${THEME.font}`;
      g.fillText(s.status === 'won' ? '扫雷成功！' : '💥 踩雷了', viewW / 2, cy);
      g.fillStyle = THEME.neonCyan;
      g.font = `13px ${THEME.font}`;
      g.fillText('点按返回难度选择', viewW / 2, cy + 28);
    }
  }

  function render(): void {
    if (!g) return;
    if (state) renderBoard(state);
    else renderMenu();
  }

  return {
    meta: { id: 'minesweeper', name: '扫雷', icon: '💣' },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      ({ canvas, g } = createScreenCanvas(container, MENU_W, MENU_H));
      canvas.style.setProperty('-webkit-touch-callout', 'none'); // iOS 长按放大镜/呼出菜单兜底
      // createScreenCanvas 已按这个尺寸设过一次，这里只补记视图尺寸，不再重设 backing store
      viewW = MENU_W;
      viewH = MENU_H;

      ctx.input.onPress(canvas, {
        tap: onTapGesture,
        long: onFlagGesture,
        right: onFlagGesture,
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
      ctx = null; // 事件监听（含 onPress 的长按定时器）由 frame 的 InputService.dispose() 统一清理
    },
  };
}
