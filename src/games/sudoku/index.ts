import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { THEME } from '../../core/theme';
import * as L from './logic';

const W = 320;
const H = 480;
const MENU_H = 480;
const GRID_X = 16;
const GRID_Y = 56;
const CELL = 32; // 9×32 = 288 棋盘
const GRID = 9 * CELL;
const PAD_Y = GRID_Y + GRID + 14; // 数字盘顶
const ROW2_Y = PAD_Y + 40; // 功能按钮行
const SAVE_KEY = 'sudoku.save';

interface MenuButton { diff: L.Difficulty; x: number; y: number; w: number; h: number; }

export function createSudoku(): Game {
  let state: L.SudokuState | null = null; // null = 难度菜单
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let loop: GameLoop | null = null;
  let ctx: GameContext | null = null;
  let paused = false;
  let endedAt = 0;
  let selected = -1;
  let notesMode = false;
  let showErrors = true;

  const menuButtons: MenuButton[] = L.DIFFICULTIES.map((d, i) => ({
    diff: d, x: 60, y: 150 + i * 78, w: 200, h: 54,
  }));

  function save(): void {
    if (state) ctx?.storage.set(SAVE_KEY, L.serialize(state));
  }
  function clearSave(): void {
    ctx?.storage.set(SAVE_KEY, null);
  }

  function startGame(diff: L.Difficulty): void {
    state = L.createState(diff);
    selected = -1;
    notesMode = false;
    ctx?.audio.play('click');
    save();
  }
  function backToMenu(): void {
    state = null;
    clearSave();
    ctx?.audio.play('click');
  }

  function toLogical(cssX: number, cssY: number): [number, number] {
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    return [(cssX / rect.width) * W, (cssY / rect.height) * (state ? H : MENU_H)];
  }

  function applyDigit(v: number): void {
    if (!state || selected < 0) return;
    const ok = notesMode ? L.toggleNote(state, selected, v) : L.setValue(state, selected, v);
    if (!ok) return;
    ctx?.audio.play('action');
    if (state.status === 'won') {
      endedAt = performance.now();
      clearSave();
      ctx?.audio.play('win');
    } else {
      save();
    }
  }

  function eraseSelected(): void {
    if (!state || selected < 0) return;
    if (L.clearCell(state, selected)) {
      ctx?.audio.play('click');
      save();
    }
  }

  function tapAt(cssX: number, cssY: number): void {
    if (paused) return;
    const [x, y] = toLogical(cssX, cssY);
    if (!state) {
      for (const b of menuButtons) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { startGame(b.diff); return; }
      }
      return;
    }
    if (state.status === 'won') {
      if (performance.now() - endedAt < 400) return;
      backToMenu();
      return;
    }
    // HUD 菜单热区
    if (y < GRID_Y && x > W - 72) { backToMenu(); return; }
    // 棋盘选格
    if (x >= GRID_X && x < GRID_X + GRID && y >= GRID_Y && y < GRID_Y + GRID) {
      const c = Math.floor((x - GRID_X) / CELL);
      const r = Math.floor((y - GRID_Y) / CELL);
      selected = r * 9 + c;
      return;
    }
    // 数字盘 1-9
    if (y >= PAD_Y && y < PAD_Y + 34) {
      const c = Math.floor((x - GRID_X) / CELL);
      if (c >= 0 && c < 9) applyDigit(c + 1);
      return;
    }
    // 功能按钮行：清除 / 笔记 / 检查
    if (y >= ROW2_Y && y < ROW2_Y + 40) {
      if (x < GRID_X + 92) eraseSelected();
      else if (x < GRID_X + 190) notesMode = !notesMode;
      else showErrors = !showErrors;
    }
  }

  function moveSel(dr: number, dc: number): void {
    if (!state) return;
    if (selected < 0) { selected = 40; return; }
    const r = Math.min(8, Math.max(0, Math.floor(selected / 9) + dr));
    const c = Math.min(8, Math.max(0, (selected % 9) + dc));
    selected = r * 9 + c;
  }

  function renderMenu(): void {
    if (!g) return;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, W, MENU_H);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = THEME.neonCyan;
    g.font = `bold 30px ${THEME.font}`;
    g.fillText('数 独', W / 2, 92);
    g.fillStyle = THEME.dim;
    g.font = `12px ${THEME.font}`;
    g.fillText('唯一解 · 笔记 · 错误提示', W / 2, 118);
    for (const b of menuButtons) {
      g.strokeStyle = THEME.neonCyan;
      g.lineWidth = 2;
      g.strokeRect(b.x, b.y, b.w, b.h);
      g.fillStyle = THEME.neonCyan;
      g.font = `bold 18px ${THEME.font}`;
      g.fillText(b.diff.name, W / 2, b.y + 24);
      g.fillStyle = THEME.dim;
      g.font = `11px ${THEME.font}`;
      g.fillText(`${b.diff.clues} 提示`, W / 2, b.y + 42);
    }
  }

  function renderBoard(s: L.SudokuState): void {
    if (!g) return;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, W, H);

    // HUD
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = THEME.neonCyan;
    g.font = `bold 16px ${THEME.font}`;
    g.fillText(`数独 · ${s.diff.name}`, GRID_X, 36);
    g.textAlign = 'right';
    g.fillStyle = THEME.neonCyan;
    g.font = `13px ${THEME.font}`;
    g.fillText('☰ 菜单', W - GRID_X, 36);

    const bad = showErrors ? L.conflicts(s.values) : new Set<number>();
    const selVal = selected >= 0 ? s.values[selected] : 0;

    // 格背景高亮
    for (let i = 0; i < 81; i++) {
      const cx = GRID_X + (i % 9) * CELL;
      const cy = GRID_Y + Math.floor(i / 9) * CELL;
      if (i === selected) g.fillStyle = 'rgba(0, 229, 255, 0.22)';
      else if (selVal !== 0 && s.values[i] === selVal) g.fillStyle = 'rgba(0, 229, 255, 0.10)';
      else continue;
      g.fillRect(cx, cy, CELL, CELL);
    }

    // 数字与笔记
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < 81; i++) {
      const cx = GRID_X + (i % 9) * CELL;
      const cy = GRID_Y + Math.floor(i / 9) * CELL;
      const v = s.values[i];
      if (v !== 0) {
        if (showErrors && bad.has(i)) g.fillStyle = THEME.neonPink;
        else if (L.isGiven(s, i)) g.fillStyle = THEME.text;
        else g.fillStyle = THEME.neonCyan;
        g.font = `${L.isGiven(s, i) ? 'bold ' : ''}20px ${THEME.font}`;
        g.fillText(String(v), cx + CELL / 2, cy + CELL / 2 + 1);
      } else if (s.notes[i].length > 0) {
        g.fillStyle = THEME.dim;
        g.font = `9px ${THEME.font}`;
        for (const n of s.notes[i]) {
          const nx = cx + 6 + ((n - 1) % 3) * 10;
          const ny = cy + 7 + Math.floor((n - 1) / 3) * 10;
          g.fillText(String(n), nx, ny);
        }
      }
    }

    // 网格线：细线 + 3×3 粗线 + 外框（边界可见）
    g.strokeStyle = '#2a2438';
    g.lineWidth = 1;
    for (let k = 1; k < 9; k++) {
      if (k % 3 === 0) continue;
      g.beginPath();
      g.moveTo(GRID_X + k * CELL, GRID_Y); g.lineTo(GRID_X + k * CELL, GRID_Y + GRID);
      g.moveTo(GRID_X, GRID_Y + k * CELL); g.lineTo(GRID_X + GRID, GRID_Y + k * CELL);
      g.stroke();
    }
    g.strokeStyle = THEME.neonCyan;
    g.lineWidth = 2;
    for (let k = 0; k <= 9; k += 3) {
      g.beginPath();
      g.moveTo(GRID_X + k * CELL, GRID_Y); g.lineTo(GRID_X + k * CELL, GRID_Y + GRID);
      g.moveTo(GRID_X, GRID_Y + k * CELL); g.lineTo(GRID_X + GRID, GRID_Y + k * CELL);
      g.stroke();
    }

    // 数字盘 1-9
    g.textBaseline = 'middle';
    for (let d = 1; d <= 9; d++) {
      const bx = GRID_X + (d - 1) * CELL;
      g.strokeStyle = THEME.dim;
      g.lineWidth = 1;
      g.strokeRect(bx, PAD_Y, CELL, 34);
      g.fillStyle = THEME.text;
      g.font = `16px ${THEME.font}`;
      g.fillText(String(d), bx + CELL / 2, PAD_Y + 18);
    }

    // 功能按钮：清除 / 笔记 / 检查
    const drawBtn = (x: number, w: number, label: string, active: boolean): void => {
      g!.strokeStyle = active ? THEME.neonGreen : THEME.dim;
      g!.lineWidth = 1.5;
      g!.strokeRect(x, ROW2_Y, w, 34);
      g!.fillStyle = active ? THEME.neonGreen : THEME.text;
      g!.font = `13px ${THEME.font}`;
      g!.fillText(label, x + w / 2, ROW2_Y + 18);
    };
    drawBtn(GRID_X, 88, '⌫ 清除', false);
    drawBtn(GRID_X + 96, 94, notesMode ? '✎ 笔记 ✓' : '✎ 笔记', notesMode);
    drawBtn(GRID_X + 196, 92, showErrors ? '⚑ 检查 ✓' : '⚑ 检查', showErrors);

    // 胜利横幅
    if (s.status === 'won') {
      const cy = GRID_Y + GRID / 2;
      g.fillStyle = 'rgba(13, 13, 22, 0.86)';
      g.fillRect(GRID_X, cy - 44, GRID, 88);
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillStyle = THEME.neonGreen;
      g.font = `bold 26px ${THEME.font}`;
      g.fillText('完成！', W / 2, cy);
      g.fillStyle = THEME.neonCyan;
      g.font = `13px ${THEME.font}`;
      g.fillText('点按返回难度选择', W / 2, cy + 28);
    }
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  function render(): void {
    if (!g) return;
    if (state) renderBoard(state);
    else renderMenu();
  }

  return {
    meta: { id: 'sudoku', name: '数独', icon: '✏️' },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
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

      // 恢复进行中盘面（若有）
      const restored = L.deserialize(ctx.storage.get(SAVE_KEY, null));
      if (restored) state = restored;

      ctx.input.onTapAt(canvas, tapAt);
      ctx.input.onKey((code) => {
        if (paused || !state) return;
        if (state.status === 'won') {
          // 胜利横幅：纯键盘用户也能返回难度菜单（带 400ms 防误触）
          if ((code === 'Enter' || code === 'Escape' || code === 'Space')
            && performance.now() - endedAt >= 400) backToMenu();
          return;
        }
        if (code.startsWith('Digit') || code.startsWith('Numpad')) {
          const d = Number(code.replace('Digit', '').replace('Numpad', ''));
          if (d >= 1 && d <= 9) applyDigit(d);
          else if (d === 0) eraseSelected();
        } else if (code === 'Backspace' || code === 'Delete') eraseSelected();
        else if (code === 'KeyN') notesMode = !notesMode;
        else if (code === 'ArrowUp') moveSel(-1, 0);
        else if (code === 'ArrowDown') moveSel(1, 0);
        else if (code === 'ArrowLeft') moveSel(0, -1);
        else if (code === 'ArrowRight') moveSel(0, 1);
      });

      loop = new GameLoop(() => {}, render); // 无时间模拟，仅驱动渲染
      loop.start();
    },

    pause(): void { paused = true; loop?.pause(); },
    resume(): void { paused = false; loop?.resume(); },

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
