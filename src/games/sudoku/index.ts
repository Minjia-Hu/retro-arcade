import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { createScreenCanvas } from '../../core/screen';
import * as L from './logic';

const CELL = 32;
const W = 9 * CELL; // 288：画布只剩棋盘，边框圆角由 .screen 提供
const H = W;
const SAVE_KEY = 'sudoku.save';

/** 纸盘配色（设计稿 1c）。与 arcade.css 的同名变量对应，改一处要同步另一处 */
const PAPER = {
  ground: '#f6efe3',
  ink: '#2b2118',
  line: '#ddd1bc',
  entry: '#0b7285',
  note: '#b5a88f',
  selected: 'rgba(11, 114, 133, .18)',
  errorFg: '#d6336c',
  errorBg: 'rgba(214, 51, 108, .12)',
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/** 难度药丸文案：logic 里的 name 是中文，顶栏按设计稿用英文 */
const DIFF_LABEL: Record<L.Difficulty['id'], string> = {
  easy: 'EASY', medium: 'MEDIUM', hard: 'HARD',
};

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
  let padRefs: { notes: HTMLButtonElement; check: HTMLButtonElement } | null = null;

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
    syncPad();
    ctx?.setPill(DIFF_LABEL[diff.id]);
    ctx?.overlay(null);
    ctx?.audio.play('click');
    save();
  }

  function backToMenu(): void {
    state = null;
    clearSave();
    ctx?.setPill(null);
    ctx?.audio.play('click');
    showMenu();
  }

  function showMenu(): void {
    ctx?.overlay({
      title: 'SELECT DIFFICULTY',
      tone: 'win',
      lines: [],
      actions: L.DIFFICULTIES.map((d) => ({
        label: DIFF_LABEL[d.id],
        kind: 'secondary' as const,
        onPress: () => startGame(d),
      })),
      hints: ['PICK A DIFFICULTY TO BEGIN'],
    });
  }

  function reportSolved(): void {
    if (!state) return;
    ctx?.overlay({
      title: 'SOLVED!',
      tone: 'win',
      // 设计稿还写了用时与失误数，但 SudokuState 里没有这两项数据源，不造假
      lines: [DIFF_LABEL[state.diff.id]],
      actions: [{ label: '▶ NEW PUZZLE', onPress: showMenu }],
      hints: ['SPACE / TAP FOR A NEW PUZZLE'],
    });
  }

  function buildPad(host: HTMLElement): void {
    host.classList.add('cab-pad-rows');
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map((d) => `<button class="pad-btn pad-btn-digit" data-digit="${d}" aria-label="填入 ${d}">${d}</button>`)
      .join('');
    host.innerHTML = `
      <div class="pad-row">${digits}</div>
      <div class="pad-row">
        <button class="pad-btn pad-btn-wide" data-fn="erase" aria-label="清除">⌫ ERASE</button>
        <button class="pad-btn pad-btn-wide" data-fn="notes" aria-label="笔记模式">✎ NOTES</button>
        <button class="pad-btn pad-btn-wide" data-fn="check" aria-label="检查冲突">⚑ CHECK</button>
      </div>`;

    host.querySelectorAll<HTMLButtonElement>('[data-digit]').forEach((el) => {
      el.addEventListener('click', () => {
        applyDigit(Number(el.dataset.digit));
        el.blur();
      });
    });
    const fn = (name: string) => host.querySelector<HTMLButtonElement>(`[data-fn="${name}"]`)!;
    fn('erase').addEventListener('click', () => { eraseSelected(); fn('erase').blur(); });
    fn('notes').addEventListener('click', () => { notesMode = !notesMode; syncPad(); fn('notes').blur(); });
    fn('check').addEventListener('click', () => { showErrors = !showErrors; syncPad(); fn('check').blur(); });
    padRefs = { notes: fn('notes'), check: fn('check') };
    syncPad();
  }

  /** 两个开关按钮的激活态。键盘路径改了状态也要调，否则 DOM 上的激活态会失真 */
  function syncPad(): void {
    padRefs?.notes.classList.toggle('is-on', notesMode);
    padRefs?.check.classList.toggle('is-on', showErrors);
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
      reportSolved();
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
    if (paused || !state || state.status === 'won' || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor(((cssX / rect.width) * W) / CELL);
    const r = Math.floor(((cssY / rect.height) * H) / CELL);
    if (c < 0 || c > 8 || r < 0 || r > 8) return;
    selected = r * 9 + c;
  }

  function moveSel(dr: number, dc: number): void {
    if (!state) return;
    if (selected < 0) { selected = 40; return; }
    const r = Math.min(8, Math.max(0, Math.floor(selected / 9) + dr));
    const c = Math.min(8, Math.max(0, (selected % 9) + dc));
    selected = r * 9 + c;
  }

  /** 只画 9×9 棋盘；HUD、数字盘、功能按钮、难度菜单都在 DOM 里 */
  function renderBoard(): void {
    if (!g) return;
    g.fillStyle = PAPER.ground;
    g.fillRect(0, 0, W, H);

    const s = state;
    const bad = s && showErrors ? L.conflicts(s.values) : new Set<number>();
    const selVal = s && selected >= 0 ? s.values[selected] : 0;

    // 选中格与同数高亮、冲突格底色
    for (let i = 0; i < 81; i++) {
      const cx = (i % 9) * CELL;
      const cy = Math.floor(i / 9) * CELL;
      if (bad.has(i)) g.fillStyle = PAPER.errorBg;
      else if (i === selected) g.fillStyle = PAPER.selected;
      else if (s && selVal !== 0 && s.values[i] === selVal) g.fillStyle = 'rgba(11, 114, 133, .08)';
      else continue;
      g.fillRect(cx, cy, CELL, CELL);
    }

    // 数字与笔记
    if (s) {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (let i = 0; i < 81; i++) {
        const cx = (i % 9) * CELL;
        const cy = Math.floor(i / 9) * CELL;
        const v = s.values[i];
        if (v !== 0) {
          const given = L.isGiven(s, i);
          g.fillStyle = bad.has(i) ? PAPER.errorFg : given ? PAPER.ink : PAPER.entry;
          g.font = `${given ? '700' : '500'} 17px ${PAPER.mono}`;
          g.fillText(String(v), cx + CELL / 2, cy + CELL / 2 + 1);
        } else if (s.notes[i].length > 0) {
          g.fillStyle = PAPER.note;
          g.font = `9px ${PAPER.mono}`;
          for (const n of s.notes[i]) {
            g.fillText(String(n), cx + 7 + ((n - 1) % 3) * 9, cy + 8 + Math.floor((n - 1) / 3) * 9);
          }
        }
      }
    }

    // 细格线
    g.strokeStyle = PAPER.line;
    g.lineWidth = 1;
    for (let k = 1; k < 9; k++) {
      if (k % 3 === 0) continue;
      g.beginPath();
      g.moveTo(k * CELL + .5, 0); g.lineTo(k * CELL + .5, H);
      g.moveTo(0, k * CELL + .5); g.lineTo(W, k * CELL + .5);
      g.stroke();
    }
    // 3×3 分隔线
    g.strokeStyle = PAPER.ink;
    g.lineWidth = 2;
    for (let k = 3; k < 9; k += 3) {
      g.beginPath();
      g.moveTo(k * CELL, 0); g.lineTo(k * CELL, H);
      g.moveTo(0, k * CELL); g.lineTo(W, k * CELL);
      g.stroke();
    }

    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  function render(): void {
    renderBoard();
  }

  return {
    meta: {
      id: 'sudoku',
      name: '数独',
      icon: '✏️',
      displayName: 'SUDOKU',
      hints: ['TAP CELL', 'THEN A NUMBER'],
      screen: 'paper',
      pad: true,
      pausable: false, // 回合制，暂停无意义
      tools: [{ id: 'menu', label: '☰', aria: '难度菜单' }],
    },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      ({ canvas, g } = createScreenCanvas(container, W, H));

      // 恢复进行中盘面；没有存档才弹难度菜单
      const restored = L.deserialize(ctx.storage.get(SAVE_KEY, null));
      if (restored) {
        state = restored;
        ctx.setPill(DIFF_LABEL[restored.diff.id]);
      } else {
        ctx.setPill(null);
        showMenu();
      }

      if (ctx.pad) buildPad(ctx.pad);
      ctx.onTool('menu', showMenu);

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
        else if (code === 'KeyN') { notesMode = !notesMode; syncPad(); }
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
      padRefs = null;
      ctx = null; // 事件监听由 frame 的 InputService.dispose() 统一清理
    },
  };
}
