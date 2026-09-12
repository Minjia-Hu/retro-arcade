import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { createScreenCanvas } from '../../core/screen';
import { DIFF_LABEL } from '../../core/format';
import { padButtons } from '../../shell/pad';
import { difficultyMenu } from '../../shell/difficulty-menu';
import * as L from './logic';

const CELL = 32;
const W = 9 * CELL; // 288: the canvas is just the board; border and radius come from .screen
const H = W;
const SAVE_KEY = 'sudoku.save';

/** Paper palette (mockup 1c). Mirrors the same-named variables in arcade.css; change both together */
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

export function createSudoku(): Game {
  let state: L.SudokuState | null = null; // null = difficulty menu
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
    // No sound here: frame plays the click for overlay buttons, a second one would double up
    save();
  }

  function backToMenu(): void {
    state = null;
    clearSave();
    ctx?.setPill(null);
    showMenu();
  }

  /** Assigned by difficultyMenu in mount; shared by backToMenu and onTool */
  // The default throws on purpose: "assigned after it was called" bit us once, and a silent
  // stub only turns into "the menu doesn't open" debugging; throwing pins it down in dev
  let showMenu: () => void = () => { throw new Error('showMenu called before mount'); };

  function reportSolved(): void {
    if (!state) return;
    ctx?.overlay({
      title: 'SOLVED!',
      tone: 'win',
      // The mockup also shows time and mistakes, but SudokuState has no source for either; don't fake them
      lines: [DIFF_LABEL[state.diff.id]],
      actions: [{ label: '▶ NEW PUZZLE', onPress: backToMenu }],
      hints: ['SPACE / TAP FOR A NEW PUZZLE'],
    });
  }

  function buildPad(host: HTMLElement): void {
    host.classList.add('cab-pad-rows');
    host.innerHTML = '<div class="pad-row" data-row="digits"></div><div class="pad-row" data-row="fns"></div>';
    const row = (n: string) => host.querySelector<HTMLElement>(`[data-row="${n}"]`)!;

    padButtons(
      row('digits'),
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => ({
        id: String(d), label: String(d), aria: `Enter ${d}`, variant: 'pad-btn-digit',
      })),
      (id) => applyDigit(Number(id)),
    );

    padButtons(row('fns'), [
      { id: 'erase', label: '⌫ ERASE', aria: 'Erase', variant: 'pad-btn-wide' },
      { id: 'notes', label: '✎ NOTES', aria: 'Notes mode', variant: 'pad-btn-wide' },
      { id: 'check', label: '⚑ CHECK', aria: 'Highlight conflicts', variant: 'pad-btn-wide' },
    ], (id) => {
      // eraseSelected has its own frozen guard; this one is for the notes/check toggles
      if (frozen()) return;
      if (id === 'erase') eraseSelected();
      else if (id === 'notes') { notesMode = !notesMode; syncPad(); }
      else if (id === 'check') { showErrors = !showErrors; syncPad(); }
    });

    const fns = row('fns');
    padRefs = {
      notes: fns.querySelector('[data-pad="notes"]')!,
      check: fns.querySelector('[data-pad="check"]')!,
    };
    syncPad();
  }

  /** Active state of the two toggle buttons. The keyboard path must call it too, or the DOM state drifts */
  function syncPad(): void {
    padRefs?.notes.classList.toggle('is-on', notesMode);
    padRefs?.check.classList.toggle('is-on', showErrors);
  }

  /**
   * While an overlay covers the board, the whole pad should freeze.
   * The overlay only covers .screen; .cab-pad sits outside and stays clickable, and the keyboard goes straight through.
   */
  function frozen(): boolean {
    return paused || Boolean(ctx?.overlayOpen());
  }

  function applyDigit(v: number): void {
    // !state stays here rather than inside frozen(): otherwise TS can't narrow state's type
    if (!state || selected < 0 || frozen()) return;
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
    if (!state || selected < 0 || frozen()) return;
    if (L.clearCell(state, selected)) {
      ctx?.audio.play('click');
      save();
    }
  }

  function tapAt(cssX: number, cssY: number): void {
    if (paused || !state || !canvas) return;
    if (state.status === 'won') {
      if (performance.now() - endedAt >= 400) backToMenu(); // same exit as the keyboard
      return;
    }
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

  /** Draws only the 9×9 board; HUD, digit pad, function buttons and difficulty menu are DOM */
  function renderBoard(): void {
    if (!g) return;
    g.fillStyle = PAPER.ground;
    g.fillRect(0, 0, W, H);

    const s = state;
    const bad = s && showErrors ? L.conflicts(s.values) : new Set<number>();
    const selVal = s && selected >= 0 ? s.values[selected] : 0;

    // Selected cell and same-digit highlight, conflict background
    for (let i = 0; i < 81; i++) {
      const cx = (i % 9) * CELL;
      const cy = Math.floor(i / 9) * CELL;
      if (bad.has(i)) g.fillStyle = PAPER.errorBg;
      else if (i === selected) g.fillStyle = PAPER.selected;
      else if (s && selVal !== 0 && s.values[i] === selVal) g.fillStyle = 'rgba(11, 114, 133, .08)';
      else continue;
      g.fillRect(cx, cy, CELL, CELL);
    }

    // Digits and notes
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

    // Thin grid lines
    g.strokeStyle = PAPER.line;
    g.lineWidth = 1;
    for (let k = 1; k < 9; k++) {
      if (k % 3 === 0) continue;
      g.beginPath();
      g.moveTo(k * CELL + .5, 0); g.lineTo(k * CELL + .5, H);
      g.moveTo(0, k * CELL + .5); g.lineTo(W, k * CELL + .5);
      g.stroke();
    }
    // 3×3 box lines
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
      name: 'Sudoku',
      icon: '✏️',
      displayName: 'SUDOKU',
      hints: ['TAP CELL', 'THEN A NUMBER'],
      screen: 'paper',
      pad: true,
      pausable: false, // turn-based, pausing is meaningless
      tools: [{ id: 'menu', label: '☰', aria: 'Difficulty menu' }],
    },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      ({ canvas, g } = createScreenCanvas(container, W, H));

      // The menu must exist first: the else branch below calls it immediately, and a late assignment hits the stub
      showMenu = difficultyMenu({
        ctx,
        difficulties: L.DIFFICULTIES,
        resumable: () => state !== null && state.status === 'playing',
        onPick: startGame,
      }).open;
      ctx.onTool('menu', () => showMenu());
      if (ctx.pad) buildPad(ctx.pad);

      // Restore a board in progress; only without a save does the difficulty menu open
      const restored = L.deserialize(ctx.storage.get(SAVE_KEY, null));
      if (restored) {
        state = restored;
        ctx.setPill(DIFF_LABEL[restored.diff.id]);
      } else {
        ctx.setPill(null);
        showMenu();
      }

      ctx.input.onTapAt(canvas, tapAt);
      ctx.input.onKey((code) => {
        if (paused || !state) return;
        if (state.status === 'won') {
          // Win banner (an overlay is necessarily open, so this must precede the overlayOpen early
          // return): keyboard-only players can get back to the difficulty menu (400ms debounce)
          if ((code === 'Enter' || code === 'Escape' || code === 'Space')
            && performance.now() - endedAt >= 400) backToMenu();
          return;
        }
        if (ctx?.overlayOpen()) {
          // The keyboard stops while the menu is open; Escape mirrors ✕ RESUME for a game in progress
          if (code === 'Escape' && state.status === 'playing') ctx.overlay(null);
          return;
        }
        if (code.startsWith('Digit') || code.startsWith('Numpad')) {
          const d = Number(code.replace('Digit', '').replace('Numpad', ''));
          if (d >= 1 && d <= 9) applyDigit(d);
          else if (d === 0) eraseSelected();
        } else if (code === 'Backspace' || code === 'Delete') eraseSelected();
        else if (code === 'KeyN') { notesMode = !notesMode; syncPad(); } // past the frozen gate by here
        else if (code === 'ArrowUp') moveSel(-1, 0);
        else if (code === 'ArrowDown') moveSel(1, 0);
        else if (code === 'ArrowLeft') moveSel(0, -1);
        else if (code === 'ArrowRight') moveSel(0, 1);
      });

      loop = new GameLoop(() => {}, render); // no simulation, just drives rendering
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
      ctx = null; // listeners are cleaned up by frame's InputService.dispose()
    },
  };
}
