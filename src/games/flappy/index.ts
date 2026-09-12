import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { SCREEN } from '../../core/theme';
import * as L from './logic';
import { padScore } from '../../core/format';
import { createScreenCanvas } from '../../core/screen';

/** Mirrors --ink in arcade.css; change both together (canvas can't read CSS variables) */
const INK = '#2b2118';


export function createFlappy(): Game {
  let state = L.createState();
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let loop: GameLoop | null = null;
  let ctx: GameContext | null = null;
  let best = 0;
  let deadHandled = false;
  let paused = false;
  let diedAt = 0;
  let bestAtStart = 0;

  function act(): void {
    if (paused) return;
    if (state.status === 'dead') {
      if (performance.now() - diedAt < 400) return; // taps pile up at the moment of death; give the overlay a moment on screen
      restart();
      ctx?.audio.play('click');
      return;
    }
    L.flap(state);
    ctx?.audio.play('action');
  }

  /** Entry point for the overlay's RETRY button: shares the paused guard but not the 400ms debounce */
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

  function update(dt: number): void {
    const scored = L.tick(state, dt);
    if (scored) {
      ctx?.audio.play('score');
      if (state.score > best) {
        best = state.score;
        ctx?.storage.set('best.flappy', best);
        ctx?.setHints([`BEST ${padScore(best, 6)}`]); // mockup 2c shows the live best in the hint bar
      }
    }
    if (state.status === 'dead' && !deadHandled) {
      deadHandled = true;
      diedAt = performance.now();
      ctx?.audio.play('hit');
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
    // Background: vertical gradient (mockup 2c)
    const sky = g.createLinearGradient(0, 0, 0, L.H);
    sky.addColorStop(0, SCREEN.ground);
    sky.addColorStop(0.6, SCREEN.ground);
    sky.addColorStop(1, '#241a12');
    g.fillStyle = sky;
    g.fillRect(0, 0, L.W, L.H);
    g.textBaseline = 'alphabetic';

    // Pipes: teal fill + dark stroke + highlight on the left
    for (const p of state.pipes) {
      const top = p.gapY - L.PIPE_GAP / 2;
      const bottomY = p.gapY + L.PIPE_GAP / 2;
      for (const [y, h] of [[0, top], [bottomY, L.H - bottomY]] as const) {
        g.fillStyle = '#0b7285';
        g.fillRect(p.x, y, L.PIPE_W, h);
        g.strokeStyle = '#075a68';
        g.lineWidth = 3;
        g.strokeRect(p.x + 1.5, y + 1.5, L.PIPE_W - 3, h - 3);
        g.fillStyle = 'rgba(255, 255, 255, .12)';
        g.fillRect(p.x + 3, y + 3, 4, h - 6);
      }
    }

    // Ground: stripes + ink top edge
    const gy = L.H - L.GROUND_H; // logic owns the ground height: the death line is drawn exactly on this edge
    for (let x = 0; x < L.W; x += 36) {
      g.fillStyle = '#3a2c1c';
      g.fillRect(x, gy, 18, L.GROUND_H);
      g.fillStyle = '#2e2316';
      g.fillRect(x + 18, gy, 18, L.GROUND_H);
    }
    g.fillStyle = INK;
    g.fillRect(0, gy, L.W, 3);

    // Bird: gold body + orange beak + dark eye
    const bx = L.BIRD_X;
    const by = state.birdY;
    g.fillStyle = SCREEN.gold;
    g.shadowColor = SCREEN.glow.gold;
    g.shadowBlur = 12;
    g.beginPath();
    g.roundRect(bx - L.BIRD_R, by - L.BIRD_RY, L.BIRD_R * 2, L.BIRD_RY * 2, 5); // same size as the hitbox
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = SCREEN.orange;
    g.fillRect(bx + 10, by - 4, 8, 6);
    g.fillStyle = SCREEN.ground;
    g.beginPath();
    g.arc(bx + 2, by - 4, 2.5, 0, Math.PI * 2);
    g.fill();

    // Score: big Bungee digits + ink shadow
    g.textAlign = 'center';
    g.fillStyle = INK;
    g.font = `34px 'Bungee', ${SCREEN.mono}`;
    g.fillText(padScore(state.score, 2), L.W / 2 + 3, 55 + 3);
    g.fillStyle = SCREEN.white;
    g.fillText(padScore(state.score, 2), L.W / 2, 55);

    // The start hint stays on the canvas; GAME OVER is the DOM overlay
    if (state.status === 'ready') {
      g.fillStyle = SCREEN.gold;
      g.font = `700 14px ${SCREEN.mono}`;
      g.fillText('TAP / SPACE TO FLAP', L.W / 2, L.H / 2 + 60);
    }
    g.textAlign = 'left';
  }

  return {
    meta: {
      id: 'flappy',
      name: 'FLAPPY BIRD',
      icon: '🐦',
      displayName: 'FLAPPY',
      hints: ['BEST 000000'], // overwritten with the real value by setHints on mount
      screen: 'dark',
      pausable: false, // mockup 2c's top bar has only SND
    },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      best = ctx.storage.get('best.flappy', 0);
      bestAtStart = best;
      ctx.setHints([`BEST ${padScore(best, 6)}`]);
      ({ canvas, g } = createScreenCanvas(container, L.W, L.H));

      ctx.input.onTap(canvas, act);
      ctx.input.onKey((code) => {
        if (code === 'Space' || code === 'ArrowUp') act();
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
