import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { SCREEN } from '../../core/theme';
import * as L from './logic';
import { padScore } from '../../core/format';
import { createScreenCanvas } from '../../core/screen';
import { padButtons } from '../../shell/pad';

const CELL = 22;
const W = L.COLS * CELL; // 220: the canvas is just the board; border and radius come from .screen
const H = L.ROWS * CELL; // 440
const REPEAT_DELAY = 0.11; // repeat interval (s) while holding left/right/soft drop

/** The seven pieces cycle through the four warm neon colours (the NE object in mockup 2a) */
const PIECE_TONES = ['teal', 'gold', 'pink', 'orange'] as const;
const pieceFill = (type: number): string => SCREEN[PIECE_TONES[type % PIECE_TONES.length]];
const pieceGlow = (type: number): string => SCREEN.glow[PIECE_TONES[type % PIECE_TONES.length]];

type PadId = 'left' | 'right' | 'rotate' | 'soft' | 'hard' | 'hold';

const PAD: { id: PadId; label: string; aria: string }[] = [
  { id: 'left', label: '◀', aria: 'Move left' },
  { id: 'right', label: '▶', aria: 'Move right' },
  { id: 'rotate', label: '⟳', aria: 'Rotate' },
  { id: 'soft', label: '▼', aria: 'Soft drop' },
  { id: 'hard', label: '⤓', aria: 'Hard drop' },
  { id: 'hold', label: '⇄', aria: 'Hold' },
];


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
  let heldRotate = false;
  let heldSpace = false;
  let heldHold = false;
  let repeatTimer = 0;
  let bestAtStart = 0; // best before this game started, to detect a new record
  let side: {
    next: HTMLElement; hold: HTMLElement;
    score: HTMLElement; level: HTMLElement; best: HTMLElement;
  } | null = null;
  let shownNext: number | null = -1; // throttles the side-panel mini piece: innerHTML changes only when the piece changes
  let shownHold: number | null = -1;

  function saveBest(): void {
    if (state.score > best) {
      best = state.score;
      ctx?.storage.set('best.tetris', best);
    }
  }

  function reportOver(): void {
    const record = state.score > bestAtStart;
    ctx?.overlay({
      title: record ? 'NEW HIGH SCORE' : 'GAME OVER',
      tone: record ? 'record' : 'lose',
      lines: [`SCORE ${padScore(state.score, 6)}`, `LINES ${padScore(state.lines, 3)}`, `BEST ${padScore(best, 6)}`],
      actions: [{ label: '▶ RETRY', onPress: retry }],
      hints: ['SPACE / TAP TO RETRY'],
    });
  }

  function afterEvents(ev: L.TetrisEvents): void {
    if (ev.locked) ctx?.audio.play('action');
    if (ev.cleared > 0) ctx?.audio.play('score');
    if (ev.over) {
      endedAt = performance.now();
      ctx?.audio.play('over');
      reportOver();
    }
    // Always persist: soft drop +1 and hard drop +2/cell don't go through a line clear, and saving only on clear/game over lost those points on BACK
    saveBest();
  }

  function primary(): void {
    if (paused) return;
    if (state.status === 'ready') {
      L.start(state);
      ctx?.audio.play('click');
    } else if (state.status === 'over') {
      if (performance.now() - endedAt < 400) return;
      restart();
      ctx?.audio.play('click');
    }
  }

  /** Entry point for the overlay's RETRY button: shares the paused guard but not primary's 400ms debounce */
  function retry(): void {
    if (paused) return;
    restart();
  }

  function restart(): void {
    state = L.createState();
    bestAtStart = best;
    ctx?.overlay(null);
    // No sound here: frame plays the click for the overlay's RETRY, a second one would double up
  }

  function releaseAll(): void {
    heldLeft = false;
    heldRight = false;
    heldSoft = false;
    heldRotate = false;
    heldSpace = false;
    heldHold = false;
  }

  function act(id: PadId): void {
    if (paused) return;
    // The pad sits outside the overlay and stays clickable during the result screen; restarting goes through primary only (Space / RETRY)
    if (ctx?.overlayOpen()) return;
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

  /** hold can end the game too (the swapped-in piece may collide on spawn), so re-check status */
  function doHold(): void {
    if (!L.holdPiece(state)) return;
    if (state.status === 'over') {
      endedAt = performance.now();
      saveBest();
      ctx?.audio.play('over');
      reportOver();
    } else {
      ctx?.audio.play('click');
    }
  }

  function tapBoard(): void {
    if (paused) return;
    primary();
  }

  function update(dt: number): void {
    // Key repeat: left/right are exclusive, soft drop is independent
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

  /** One cell: fill + same-colour glow + the mockup's bevel (dark bottom-right, light top-left) */
  function drawCell(px: number, py: number, size: number, type: number): void {
    if (!g) return;
    g.fillStyle = pieceFill(type);
    g.shadowColor = pieceGlow(type);
    g.shadowBlur = 8;
    g.fillRect(px, py, size, size);
    g.shadowBlur = 0;
    const b = Math.max(2, Math.round(size / 7)); // a 22px cell gets a 3px bevel
    g.fillStyle = 'rgba(0, 0, 0, .3)';
    g.fillRect(px + size - b, py, b, size);
    g.fillRect(px, py + size - b, size, b);
    g.fillStyle = 'rgba(255, 255, 255, .25)';
    g.fillRect(px, py, size, b);
    g.fillRect(px, py, b, size);
  }

  /**
   * The mini piece is built from DOM squares, centred in 44×30 by its ACTUAL bounding box.
   * def.size can't be the height: at rotation 0 no piece fills def.size rows (I uses 1, the
   * rest 2), so an oy computed from def.size goes negative and T/S/Z/J/L poke out of the card's
   * top edge under the NEXT label. Both width and height are constrained by size.
   */
  function miniHtml(type: number | null): string {
    if (type === null) return '';
    const cells = L.rotatedCells(type, 0);
    const xs = cells.map(([cx]) => cx);
    const ys = cells.map(([, cy]) => cy);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const cw = Math.max(...xs) - minX + 1;
    const ch = Math.max(...ys) - minY + 1;
    const size = Math.min(13, Math.floor(44 / cw), Math.floor(30 / ch));
    const ox = (44 - cw * size) / 2;
    const oy = (30 - ch * size) / 2;
    return cells
      .map(([cx, cy]) =>
        `<i style="left:${ox + (cx - minX) * size}px;top:${oy + (cy - minY) * size}px;` +
        `width:${size}px;height:${size}px;background:${pieceFill(type)}"></i>`)
      .join('');
  }

  function buildSide(host: HTMLElement): void {
    host.innerHTML = `
      <div class="side-card"><span class="side-label">NEXT</span><span class="side-piece" data-ref="next"></span></div>
      <div class="side-card"><span class="side-label">HOLD</span><span class="side-piece" data-ref="hold"></span></div>
      <div class="side-card"><span class="side-label">SCORE</span><span class="side-value" data-ref="score">000000</span></div>
      <div class="side-card"><span class="side-label">LEVEL</span><span class="side-value side-value-accent" data-ref="level">01</span></div>
      <div class="side-card"><span class="side-label">BEST</span><span class="side-value side-value-dim" data-ref="best">000000</span></div>`;
    const q = (ref: string) => host.querySelector<HTMLElement>(`[data-ref="${ref}"]`)!;
    side = { next: q('next'), hold: q('hold'), score: q('score'), level: q('level'), best: q('best') };
    shownNext = -1;
    shownHold = -1;
  }

  function buildPad(host: HTMLElement): void {
    // PAD's fields match PadButton; pass it straight through, no extra map
    padButtons(host, PAD, (id) => act(id as PadId));
  }

  /** Sync the side panel every frame; the mini piece redraws only when it changes, not at 60fps */
  function syncSide(): void {
    if (!side) return;
    if (state.next !== shownNext) {
      shownNext = state.next;
      side.next.innerHTML = miniHtml(state.next);
    }
    if (state.hold !== shownHold) {
      shownHold = state.hold;
      side.hold.innerHTML = miniHtml(state.hold);
    }
    side.score.textContent = padScore(state.score, 6);
    side.level.textContent = padScore(L.levelOf(state.lines), 2);
    side.best.textContent = padScore(best, 6);
  }

  function render(): void {
    if (!g) return;
    g.fillStyle = SCREEN.ground;
    g.fillRect(0, 0, W, H);

    for (let y = 0; y < L.ROWS; y++) {
      for (let x = 0; x < L.COLS; x++) {
        const v = state.board[y * L.COLS + x];
        if (v !== 0) drawCell(x * CELL, y * CELL, CELL, v - 1);
      }
    }

    // Current piece (the part above y<0 is not drawn)
    if (state.status !== 'over') {
      for (const [cx, cy] of L.rotatedCells(state.current.type, state.current.rot)) {
        const y = state.current.y + cy;
        if (y >= 0) drawCell((state.current.x + cx) * CELL, y * CELL, CELL, state.current.type);
      }
    }

    // The start hint stays on the canvas; GAME OVER is the DOM overlay
    if (state.status === 'ready') {
      g.fillStyle = 'rgba(26, 20, 16, .75)';
      g.fillRect(0, H / 2 - 40, W, 80);
      g.fillStyle = SCREEN.gold;
      g.font = `700 14px ${SCREEN.mono}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('TAP / ENTER TO START', W / 2, H / 2);
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
    }

    syncSide();
  }

  return {
    meta: {
      id: 'tetris',
      name: 'Tetris',
      icon: '🧱',
      displayName: 'TETRIS',
      hints: ['←→ MOVE', '↑ ROTATE', '↓ DROP', 'SPACE HARD DROP', 'C HOLD'],
      screen: 'dark',
      side: true,
      pad: true,
    },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      best = ctx.storage.get('best.tetris', 0);
      bestAtStart = best;
      ({ canvas, g } = createScreenCanvas(container, W, H));

      if (ctx.side) buildSide(ctx.side);
      if (ctx.pad) buildPad(ctx.pad);

      ctx.input.onTap(canvas, tapBoard);
      ctx.input.onKey((code) => {
        if (paused) return;
        if (state.status !== 'playing') {
          if (code === 'Enter' || code === 'Space') {
            if (code === 'Space') heldSpace = true; // a Space still held after restart must not hard-drop immediately
            primary();
          }
          return;
        }
        // The held flags do two jobs: drive our own repeat timer, and absorb the OS key repeat
        // (keydown fires at the system rate; unfiltered it stacks into runaway moves / repeated hard drops)
        if (code === 'ArrowLeft' || code === 'KeyA') {
          if (!heldLeft) {
            heldLeft = true;
            L.move(state, -1);
          }
        } else if (code === 'ArrowRight' || code === 'KeyD') {
          if (!heldRight) {
            heldRight = true;
            L.move(state, 1);
          }
        } else if (code === 'ArrowDown' || code === 'KeyS') {
          if (!heldSoft) {
            heldSoft = true;
            L.softDrop(state);
          }
        } else if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyX') {
          if (!heldRotate) {
            heldRotate = true;
            L.rotate(state);
          }
        } else if (code === 'Space') {
          if (!heldSpace) {
            heldSpace = true;
            afterEvents(L.hardDrop(state));
          }
        } else if (code === 'KeyC') {
          if (!heldHold) {
            heldHold = true;
            doHold();
          }
        }
      });
      ctx.input.onKeyUp((code) => {
        if (code === 'ArrowLeft' || code === 'KeyA') heldLeft = false;
        else if (code === 'ArrowRight' || code === 'KeyD') heldRight = false;
        else if (code === 'ArrowDown' || code === 'KeyS') heldSoft = false;
        else if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyX') heldRotate = false;
        else if (code === 'Space') heldSpace = false;
        else if (code === 'KeyC') heldHold = false;
      });

      ctx.input.onBlur(releaseAll); // keyup is lost on window switch; reset here too

      loop = new GameLoop(update, render);
      loop.start();
    },

    pause(): void {
      paused = true;
      loop?.pause();
    },

    resume(): void {
      paused = false;
      releaseAll(); // keyups during pause never arrive; reset so nothing auto-moves on resume
      loop?.resume();
    },

    destroy(): void {
      loop?.stop();
      loop = null;
      canvas?.remove();
      canvas = null;
      g = null;
      side = null; // pad / side DOM is cleared by frame.close()
      ctx = null; // listeners are cleaned up by frame's InputService.dispose()
    },
  };
}
