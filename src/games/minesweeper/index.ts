import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { createScreenCanvas, resizeScreenCanvas } from '../../core/screen';
import { DIFF_LABEL, padScore } from '../../core/format';
import { difficultyMenu } from '../../shell/difficulty-menu';
import * as L from './logic';

/** Paper palette (mockup 2e) */
const PAPER = {
  hidden: '#fffaf0',
  revealed: '#efe5d3',
  line: '#ddd1bc',
  ink: '#2b2118',
  flag: '#d6336c',
  mine: 'rgba(214, 51, 108, .25)',
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/** Digits 1–8: 1–5 per the mockup, 6–8 reuse the fifth colour */
const NUM_COLORS = ['', '#0b7285', '#5c940d', '#d6336c', '#7048e8', '#e8590c', '#e8590c', '#e8590c', '#e8590c'];

export function createMinesweeper(): Game {
  let state: L.MineState | null = null; // null = difficulty menu
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let loop: GameLoop | null = null;
  let ctx: GameContext | null = null;
  let paused = false;
  let viewW = 0;
  let viewH = 0;

  let head: { flags: HTMLElement; face: HTMLButtonElement; time: HTMLElement } | null = null;
  let startedAt = 0; // the clock starts on the first click, as in classic Minesweeper
  let stoppedAt = 0;
  let shownFlags = '';
  let shownTime = '';
  let shownFace = '';

  /** Assigned by difficultyMenu in mount; shared by ☰ and the initial mount */
  // The default throws on purpose: "assigned after it was called" bit us once, and a silent
  // stub only turns into "the menu doesn't open" debugging; throwing pins it down in dev
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
      // The head bar sits outside .screen, so this button is clickable while the ☰ menu is open.
      // Unguarded, a player who thinks they're picking a difficulty has just wiped the board in
      // progress. The overlay's ▶ NEW GAME calls replay() directly and is unaffected
      if (frozen()) return;
      replay();
    });
    shownFlags = '';
    shownTime = '';
    shownFace = '';
  }

  /** While the result overlay is up, Space / a canvas tap = ▶ NEW GAME (not for the difficulty menu). Returns whether the input was consumed */
  function restartIfEnded(): boolean {
    if (!ctx?.overlayOpen() || !state || (state.status !== 'won' && state.status !== 'lost')) return false;
    if (performance.now() - stoppedAt >= 400) replay(); // clicks pile up at the moment of the explosion
    return true;
  }

  /** 🙂 restarts at the same difficulty; the difficulty menu is the top-bar ☰ — two different things */
  function replay(): void {
    if (!state) return;
    startGame(state.diff);
  }

  function elapsed(): number {
    if (!startedAt) return 0;
    return Math.floor(((stoppedAt || performance.now()) - startedAt) / 1000);
  }

  /** Synced every frame; writes the DOM only when a value changed (same as 2048's shownScore/shownBest) */
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
    // The top-bar pill shows the difficulty: nothing else in the HUD does, and it matches SUDOKU
    ctx?.setPill(DIFF_LABEL[diff.id]);
    ctx?.overlay(null);
    // No sound here: frame plays the click for overlay buttons, a second one would double up
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

  /** CSS coordinates → logic coordinates of the current view */
  function toLogical(cssX: number, cssY: number): [number, number] {
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    return [(cssX / rect.width) * viewW, (cssY / rect.height) * viewH];
  }

  /** Logic coordinates → cell index; -1 when outside the board */
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
    // The clock starts on the first successful reveal — flagging doesn't count, as in classic Minesweeper
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
        // Raised look for hidden cells: dark stroke bottom-right, light stroke top-left
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

    // Grid lines
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
      name: 'Minesweeper',
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
      canvas.style.setProperty('-webkit-touch-callout', 'none'); // guards against iOS's long-press magnifier / callout
      // createScreenCanvas already sized it; just record the view size, don't reset the backing store
      viewW = first.cols * first.cell;
      viewH = first.rows * first.cell;

      if (ctx.head) buildHead(ctx.head);

      // The menu must exist first: the end of mount calls it immediately, and a late assignment hits the stub
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
      // Minesweeper is pointer-only; the keyboard only handles restarting from the result screen
      ctx.input.onKey((code) => {
        if (code === 'Space' || code === 'Enter') restartIfEnded();
      });

      // No save: every mount starts at the difficulty menu
      showMenu();

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
      ctx = null; // listeners (including onPress's long-press timer) are cleaned up by frame's InputService.dispose()
    },
  };
}
