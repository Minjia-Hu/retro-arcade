import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { SCREEN } from '../../core/theme';
import * as L from './logic';
import { padScore } from '../../core/format';
import { createScreenCanvas } from '../../core/screen';

const CELL = 16; // COLS×16 = 320, ROWS×16 = 480, one-to-one with the logic grid
const W = L.COLS * CELL;
const H = L.ROWS * CELL;

const KEY_DIR: Record<string, L.Dir> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export function createSnake(): Game {
  let state = L.createState();
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let loop: GameLoop | null = null;
  let ctx: GameContext | null = null;
  let best = 0;
  let deadHandled = false;
  let paused = false;
  let diedAt = 0;
  let bestAtStart = 0; // best before this game started, to detect a new record

  function handleDir(dir: L.Dir): void {
    if (paused || state.status === 'dead') return;
    L.setDirection(state, dir);
  }


  /**
   * Entry point for the overlay's RETRY button. Shares the paused guard with the keyboard/tap
   * paths but does NOT go through tapAction's 400ms debounce — that exists for accidental
   * canvas taps, and a deliberate button click must not be swallowed.
   */
  function retry(): void {
    if (paused) return;
    restart();
  }

  function restart(): void {
    state = L.createState();
    deadHandled = false;
    bestAtStart = best;
    ctx?.overlay(null);
  }

  function tapAction(): void {
    if (paused) return;
    if (state.status === 'dead') {
      if (performance.now() - diedAt < 400) return; // taps often pile up at the moment of death
      restart();
      return;
    }
    if (state.status === 'ready') {
      L.setDirection(state, state.dir); // a tap starts the game in the current direction
    }
  }

  function update(dt: number): void {
    const ev = L.tick(state, dt);
    if (ev.ate) {
      ctx?.audio.play('score');
      if (state.score > best) {
        best = state.score;
        ctx?.storage.set('best.snake', best);
      }
    }
    if (ev.died && !deadHandled) {
      deadHandled = true;
      diedAt = performance.now();
      ctx?.audio.play('over');
      const record = state.score > bestAtStart;
      ctx?.overlay({
        title: record ? 'NEW HIGH SCORE' : 'GAME OVER',
        tone: record ? 'record' : 'lose',
        lines: [`SCORE ${padScore(state.score, 4)}`, `BEST ${padScore(best, 6)}`],
        actions: [{ label: '▶ RETRY', onPress: retry }],
        hints: ['SPACE / TAP TO RETRY'],
      });
    }
  }

  function render(): void {
    if (!g) return;
    g.fillStyle = SCREEN.ground;
    g.fillRect(0, 0, W, H);

    // Boundary wall: hitting it kills, so it must be visible (the canvas matches the well colour; without this stroke the edge is invisible)
    g.strokeStyle = SCREEN.teal;
    g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, H - 2);

    // Food: warm neon pink, radius 3
    g.fillStyle = SCREEN.pink;
    g.shadowColor = SCREEN.glow.pink;
    g.shadowBlur = 10;
    g.beginPath();
    g.roundRect(state.food.x * CELL + 2, state.food.y * CELL + 2, CELL - 4, CELL - 4, 3);
    g.fill();

    // Body: teal, head: gold
    g.shadowBlur = 8;
    for (let i = state.snake.length - 1; i >= 0; i--) {
      const c = state.snake[i];
      const head = i === 0;
      g.fillStyle = head ? SCREEN.gold : SCREEN.teal;
      g.shadowColor = head ? SCREEN.glow.gold : SCREEN.glow.teal;
      g.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2);
    }

    // Score: zero-padded to 4 digits per the mockups
    g.fillStyle = SCREEN.gold;
    g.shadowColor = SCREEN.glow.gold;
    g.shadowBlur = 10;
    g.font = `700 24px ${SCREEN.mono}`;
    g.textAlign = 'center';
    g.fillText(padScore(state.score, 4), W / 2, 40);
    g.shadowBlur = 0;

    // GAME OVER and the start hint are no longer drawn on the canvas: the former is the DOM
    // overlay, the latter lives in the cabinet's bottom hint bar
  }

  return {
    meta: {
      id: 'snake',
      name: 'Snake',
      icon: '🐍',
      displayName: 'SNAKE',
      hints: ['↑↓←→ / WASD MOVE', 'SPACE START'],
      screen: 'dark',
    },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      best = ctx.storage.get('best.snake', 0);
      bestAtStart = best;
      ({ canvas, g } = createScreenCanvas(container, W, H));

      ctx.input.onSwipe(canvas, handleDir);
      ctx.input.onTap(canvas, tapAction);
      ctx.input.onKey((code) => {
        const dir = KEY_DIR[code];
        if (dir) handleDir(dir);
        else if (code === 'Space') tapAction();
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
      loop?.resume();
    },

    destroy(): void {
      loop?.stop();
      loop = null;
      canvas?.remove();
      canvas = null;
      g = null;
      ctx = null; // listeners are cleaned up by frame's InputService.dispose()
    },
  };
}
