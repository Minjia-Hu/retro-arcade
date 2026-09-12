import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { createScreenCanvas, resizeScreenCanvas } from '../../core/screen';
import { DIFF_LABEL, padScore } from '../../core/format';
import { difficultyMenu } from '../../shell/difficulty-menu';
import * as L from './logic';

/** 纸盘配色（设计稿 2e） */
const PAPER = {
  hidden: '#fffaf0',
  revealed: '#efe5d3',
  line: '#ddd1bc',
  ink: '#2b2118',
  flag: '#d6336c',
  mine: 'rgba(214, 51, 108, .25)',
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/** 数字 1–8：1–5 按设计稿，6–8 沿用第 5 色系 */
const NUM_COLORS = ['', '#0b7285', '#5c940d', '#d6336c', '#7048e8', '#e8590c', '#e8590c', '#e8590c', '#e8590c'];

export function createMinesweeper(): Game {
  let state: L.MineState | null = null; // null = 难度菜单
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let loop: GameLoop | null = null;
  let ctx: GameContext | null = null;
  let paused = false;
  let viewW = 0;
  let viewH = 0;

  let head: { flags: HTMLElement; face: HTMLButtonElement; time: HTMLElement } | null = null;
  let startedAt = 0; // 首次点击才起表，扫雷惯例
  let stoppedAt = 0;
  let shownFlags = '';
  let shownTime = '';
  let shownFace = '';

  /** 由 difficultyMenu 在 mount 里赋值；☰ 与首次挂载共用 */
  // 默认值故意会抛：本轮踩过「赋值晚于调用」的坑，静默空桩只会变成
  // 「菜单不弹」的现场调试，抛出来能在开发期就定位
  let showMenu: () => void = () => { throw new Error('showMenu called before mount'); };

  function frozen(): boolean {
    return paused || Boolean(ctx?.overlayOpen());
  }

  function buildHead(host: HTMLElement): void {
    host.innerHTML = `
      <div class="head-card" data-ref="flags" aria-label="Mines left">⚑ 00</div>
      <button class="head-btn head-btn-accent" data-ref="face" aria-label="Restart this board">🙂</button>
      <div class="head-card" data-ref="time" aria-label="Time">00:00</div>`;
    const q = <T extends HTMLElement>(r: string) => host.querySelector<T>(`[data-ref="${r}"]`)!;
    head = { flags: q('flags'), face: q<HTMLButtonElement>('face'), time: q('time') };
    head.face.addEventListener('click', () => {
      head!.face.blur();
      // 头栏在 .screen 之外，☰ 菜单开着时这个按钮照样点得到。不挡的话玩家以为
      // 自己在选难度，实际上刚把进行中的盘面清了。结算浮层里的 ▶ NEW GAME
      // 直接调 replay()，不经过这里，不受影响
      if (frozen()) return;
      replay();
    });
    shownFlags = '';
    shownTime = '';
    shownFace = '';
  }

  /** 结算浮层期间 Space / 点画布 = ▶ NEW GAME（难度菜单不算）。返回是否已消费这次输入 */
  function restartIfEnded(): boolean {
    if (!ctx?.overlayOpen() || !state || (state.status !== 'won' && state.status !== 'lost')) return false;
    if (performance.now() - stoppedAt >= 400) replay(); // 踩雷瞬间常有连点
    return true;
  }

  /** 🙂 是重开本局（同难度）；返回难度菜单走顶栏 ☰ —— 这两件事语义不同 */
  function replay(): void {
    if (!state) return;
    startGame(state.diff);
  }

  function elapsed(): number {
    if (!startedAt) return 0;
    return Math.floor(((stoppedAt || performance.now()) - startedAt) / 1000);
  }

  /** 每帧同步；只在值变了才写 DOM（同 2048 的 shownScore/shownBest 做法） */
  function syncHead(): void {
    if (!head || !state) return;
    const flags = `⚑ ${padScore(Math.max(0, state.diff.mines - state.flags), 2)}`;
    if (flags !== shownFlags) {
      shownFlags = flags;
      head.flags.textContent = flags;
    }
    const s = elapsed();
    const time = `${padScore(Math.floor(s / 60), 2)}:${padScore(s % 60, 2)}`;
    if (time !== shownTime) {
      shownTime = time;
      head.time.textContent = time;
    }
    const face = state.status === 'lost' ? '💥' : state.status === 'won' ? '😎' : '🙂';
    if (face !== shownFace) {
      shownFace = face;
      head.face.textContent = face;
    }
  }

  function setCanvasSize(w: number, h: number): void {
    if (!canvas || !g) return;
    viewW = w;
    viewH = h;
    resizeScreenCanvas(canvas, g, w, h);
  }

  function startGame(diff: L.Difficulty): void {
    state = L.createState(diff);
    startedAt = 0;
    stoppedAt = 0;
    setCanvasSize(diff.cols * diff.cell, diff.rows * diff.cell);
    // 顶栏药丸显示当前难度：HUD 里没有别处能看出来，与 SUDOKU 保持一致
    ctx?.setPill(DIFF_LABEL[diff.id]);
    ctx?.overlay(null);
    // 不在这里发声：浮层按钮的 click 由 frame 统一负责，重复发声会响两下
  }

  function reportEnd(): void {
    if (!state) return;
    const won = state.status === 'won';
    const s = elapsed();
    ctx?.overlay({
      title: won ? 'CLEARED!' : 'BOOM',
      tone: won ? 'win' : 'lose',
      lines: [DIFF_LABEL[state.diff.id], `TIME ${padScore(Math.floor(s / 60), 2)}:${padScore(s % 60, 2)}`],
      actions: [{ label: '▶ NEW GAME', onPress: replay }],
      hints: ['SPACE / TAP TO PLAY AGAIN'],
    });
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
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return -1;
    return cy * cols + cx;
  }

  function onTapGesture(cssX: number, cssY: number): void {
    if (restartIfEnded()) return;
    if (frozen() || !state) return;
    const [x, y] = toLogical(cssX, cssY);
    const idx = cellAt(x, y);
    if (idx < 0) return;
    const wasReady = state.status === 'ready';
    const ev = L.reveal(state, idx);
    // 首次成功翻格才起表——插旗不算「首次点击」，符合扫雷惯例
    if (wasReady && ev.revealedSome && !startedAt) startedAt = performance.now();
    if (ev.exploded) {
      stoppedAt = performance.now();
      ctx?.audio.play('over');
      reportEnd();
    } else if (ev.won) {
      stoppedAt = performance.now();
      ctx?.audio.play('win');
      reportEnd();
    } else if (ev.revealedSome) {
      ctx?.audio.play('click');
    }
  }

  function onFlagGesture(cssX: number, cssY: number): void {
    if (frozen() || !state) return;
    const [x, y] = toLogical(cssX, cssY);
    const idx = cellAt(x, y);
    if (idx < 0) return;
    if (L.toggleFlag(state, idx)) ctx?.audio.play('action');
  }

  function renderMenu(): void {
    if (!g) return;
    g.fillStyle = PAPER.hidden;
    g.fillRect(0, 0, viewW, viewH);
  }

  function renderBoard(s: L.MineState): void {
    if (!g) return;
    const { cols, rows, cell } = s.diff;
    g.fillStyle = PAPER.hidden;
    g.fillRect(0, 0, viewW, viewH);

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < s.grid.length; i++) {
      const c = s.grid[i];
      const px = (i % cols) * cell;
      const py = Math.floor(i / cols) * cell;
      if (c.revealed) {
        g.fillStyle = PAPER.revealed;
        g.fillRect(px, py, cell, cell);
        if (c.mine) {
          g.fillStyle = PAPER.mine;
          g.beginPath();
          g.arc(px + cell / 2, py + cell / 2, cell * 0.28, 0, Math.PI * 2);
          g.fill();
        } else if (c.adj > 0) {
          g.fillStyle = NUM_COLORS[c.adj];
          g.font = `bold ${Math.floor(cell * 0.55)}px ${PAPER.mono}`;
          g.fillText(String(c.adj), px + cell / 2, py + cell / 2 + 1);
        }
      } else {
        g.fillStyle = PAPER.hidden;
        g.fillRect(px, py, cell, cell);
        // 未翻开格的凸起感：右下深描边 + 左上亮描边
        g.strokeStyle = 'rgba(0, 0, 0, .10)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(px + cell, py);
        g.lineTo(px + cell, py + cell);
        g.lineTo(px, py + cell);
        g.stroke();
        g.strokeStyle = 'rgba(255, 255, 255, .9)';
        g.beginPath();
        g.moveTo(px, py + cell);
        g.lineTo(px, py);
        g.lineTo(px + cell, py);
        g.stroke();
        if (c.flagged) {
          g.strokeStyle = PAPER.ink;
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(px + cell * 0.35, py + cell * 0.2);
          g.lineTo(px + cell * 0.35, py + cell * 0.8);
          g.stroke();
          g.fillStyle = PAPER.flag;
          g.beginPath();
          g.moveTo(px + cell * 0.35, py + cell * 0.2);
          g.lineTo(px + cell * 0.75, py + cell * 0.35);
          g.lineTo(px + cell * 0.35, py + cell * 0.5);
          g.closePath();
          g.fill();
        }
      }
    }

    // 格线
    g.strokeStyle = PAPER.line;
    g.lineWidth = 0.5;
    for (let c = 0; c <= cols; c++) {
      g.beginPath();
      g.moveTo(c * cell + 0.25, 0);
      g.lineTo(c * cell + 0.25, rows * cell);
      g.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      g.beginPath();
      g.moveTo(0, r * cell + 0.25);
      g.lineTo(cols * cell, r * cell + 0.25);
      g.stroke();
    }

    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  function render(): void {
    if (!g) return;
    if (state) renderBoard(state);
    else renderMenu();
    syncHead();
  }

  return {
    meta: {
      id: 'minesweeper',
      name: '扫雷',
      icon: '💣',
      displayName: 'MINES',
      hints: ['CLICK REVEAL', 'LONG-PRESS / RIGHT-CLICK FLAG'],
      screen: 'paper',
      head: true,
      pausable: false,
      tools: [{ id: 'menu', label: '☰', aria: 'Difficulty menu' }],
    },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      const first = L.DIFFICULTIES[0];
      ({ canvas, g } = createScreenCanvas(container, first.cols * first.cell, first.rows * first.cell));
      canvas.style.setProperty('-webkit-touch-callout', 'none'); // iOS 长按放大镜/呼出菜单兜底
      // createScreenCanvas 已按这个尺寸设过一次，这里只补记视图尺寸，不再重设 backing store
      viewW = first.cols * first.cell;
      viewH = first.rows * first.cell;

      if (ctx.head) buildHead(ctx.head);

      // 菜单必须先建：mount 末尾会立刻调它，晚赋值会调到空函数桩
      showMenu = difficultyMenu({
        ctx,
        difficulties: L.DIFFICULTIES,
        resumable: () => state !== null && state.status === 'playing',
        onPick: startGame,
      }).open;
      ctx.onTool('menu', () => showMenu());

      ctx.input.onPress(canvas, {
        tap: onTapGesture,
        long: onFlagGesture,
        right: onFlagGesture,
      });
      // 扫雷本身是纯指针游戏，键盘只承担结算态的重开
      ctx.input.onKey((code) => {
        if (code === 'Space' || code === 'Enter') restartIfEnded();
      });

      // 不存档：每次挂载都从难度菜单开始
      showMenu();

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
      ctx = null; // 事件监听（含 onPress 的长按定时器）由 frame 的 InputService.dispose() 统一清理
    },
  };
}
