import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { SCREEN } from '../../core/theme';
import * as L from './logic';
import { padScore } from '../../core/format';
import { createScreenCanvas } from '../../core/screen';

const KEY_PADDLE_SPEED = 300; // paddle speed while a key is held, px/s
/** Brick rows top to bottom: pink / orange / gold / teal (mockup 2b) */
const ROW_TONES = ['pink', 'orange', 'gold', 'teal'] as const;


export function createBreakout(): Game {
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
  let bestAtStart = 0; // best before this game started, to detect a new record

  function primary(): void {
    if (paused) return;
    if (state.status === 'ready') {
      L.launch(state);
      ctx?.audio.play('action');
    } else if (state.status === 'over') {
      if (performance.now() - endedAt < 400) return;
      restart();
      ctx?.audio.play('click');
    }
  }

  /** Entry point for the overlay's RETRY button: shares the paused guard but not the 400ms debounce */
  function retry(): void {
    if (paused) return;
    restart();
  }

  function restart(): void {
    state = L.createState();
    bestAtStart = best;
    ctx?.overlay(null);
  }

  let cssWidth = 0; // cached canvas CSS width: pointermove fires hundreds of times a second, and getBoundingClientRect each time forces layout

  function dragBy(cssDx: number): void {
    if (paused || !canvas || state.status === 'over') return;
    if (!cssWidth) cssWidth = canvas.getBoundingClientRect().width;
    L.movePaddle(state, state.paddleX + (cssDx / cssWidth) * L.W);
  }

  function update(dt: number): void {
    if (heldLeft !== heldRight && state.status !== 'over') {
      L.movePaddle(state, state.paddleX + (heldRight ? 1 : -1) * KEY_PADDLE_SPEED * dt);
    }
    // Sub-stepping: cap each step at ≤12px so a fast ball on a long frame (dt capped at 50ms) can't tunnel through the paddle or a brick row
    const steps = Math.max(1, Math.ceil((L.speedFor(state.level) * dt) / 12));
    const ev: L.TickEvents = { broke: false, paddleHit: false, lost: false, cleared: false, over: false };
    for (let i = 0; i < steps; i++) {
      const e = L.tick(state, dt / steps);
      ev.broke = ev.broke || e.broke;
      ev.paddleHit = ev.paddleHit || e.paddleHit;
      ev.lost = ev.lost || e.lost;
      ev.cleared = ev.cleared || e.cleared;
      ev.over = ev.over || e.over;
    }
    if (ev.paddleHit) ctx?.audio.play('action');
    if (ev.broke) {
      ctx?.audio.play('score');
      if (state.score > best) {
        best = state.score;
        ctx?.storage.set('best.breakout', best);
      }
    }
    if (ev.cleared) ctx?.audio.play('win');
    if (ev.over) {
      endedAt = performance.now();
      ctx?.audio.play('over');
      const record = state.score > bestAtStart;
      ctx?.overlay({
        title: record ? 'NEW HIGH SCORE' : 'GAME OVER',
        tone: record ? 'record' : 'lose',
        lines: [`SCORE ${padScore(state.score, 6)}`, `LEVEL ${padScore(state.level, 2)}`, `BEST ${padScore(best, 6)}`],
        actions: [{ label: '▶ RETRY', onPress: retry }],
        hints: ['SPACE / TAP TO RETRY'],
      });
    } else if (ev.lost) {
      ctx?.audio.play('hit');
    }
  }

  function render(): void {
    if (!g) return;
    g.fillStyle = SCREEN.ground;
    g.fillRect(0, 0, L.W, L.H);
    g.textBaseline = 'alphabetic';

    // HUD: gold score top-left, pink lives top-right (mockup 2b).
    // The spec's (12,16) is the mockup's box position; canvas uses the alphabetic baseline, so y=16 would touch the top edge — hence (16,30)
    g.font = `700 15px ${SCREEN.mono}`;
    g.textAlign = 'left';
    g.fillStyle = SCREEN.gold;
    g.fillText(`SCORE ${padScore(state.score, 4)}`, 16, 30);
    g.textAlign = 'right';
    g.fillStyle = SCREEN.pink;
    const lives = Math.max(0, Math.min(3, state.lives));
    g.fillText('♥'.repeat(lives) + '♡'.repeat(3 - lives), L.W - 16, 30);
    // The mockup has no level indicator, but levels advance and the player needs to know — kept as dim small text
    g.textAlign = 'center';
    g.font = `12px ${SCREEN.mono}`;
    g.fillStyle = 'rgba(255, 250, 240, .45)';
    g.fillText(`LEVEL ${state.level}`, L.W / 2, 30);

    // Bricks: colour by row, bevel + same-colour glow
    for (const b of state.bricks) {
      if (!b.alive) continue;
      const tone = ROW_TONES[b.row % ROW_TONES.length];
      g.fillStyle = SCREEN[tone];
      g.shadowColor = SCREEN.glow[tone];
      g.shadowBlur = 8;
      g.beginPath();
      g.roundRect(b.x, b.y, b.w, b.h, 3);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(0, 0, 0, .3)';
      g.fillRect(b.x + b.w - 3, b.y, 3, b.h);
      g.fillRect(b.x, b.y + b.h - 3, b.w, 3);
      g.fillStyle = 'rgba(255, 255, 255, .25)';
      g.fillRect(b.x, b.y, b.w, 2);
    }

    // Paddle: teal, rounded
    g.fillStyle = SCREEN.teal;
    g.shadowColor = SCREEN.glow.teal;
    g.shadowBlur = 12;
    g.beginPath();
    g.roundRect(state.paddleX - L.PADDLE_W / 2, L.PADDLE_Y, L.PADDLE_W, L.PADDLE_H, 6);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(0, 0, 0, .25)';
    g.fillRect(state.paddleX - L.PADDLE_W / 2, L.PADDLE_Y + L.PADDLE_H - 2, L.PADDLE_W, 2);

    // Ball: white
    g.fillStyle = SCREEN.white;
    g.shadowColor = SCREEN.glow.white;
    g.shadowBlur = 12;
    g.beginPath();
    g.arc(state.ballX, state.ballY, L.BALL_R, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;

    // The start hint stays on the canvas; GAME OVER is the DOM overlay
    if (state.status === 'ready') {
      g.textAlign = 'center';
      g.font = `700 14px ${SCREEN.mono}`;
      g.fillStyle = SCREEN.gold;
      g.fillText('TAP / SPACE TO LAUNCH', L.W / 2, L.H / 2 + 40);
    }
    g.textAlign = 'left';
  }

  return {
    meta: {
      id: 'breakout',
      name: 'Breakout',
      icon: '🕹️',
      displayName: 'BREAKOUT',
      hints: ['←→ / MOUSE MOVE', 'SPACE LAUNCH'],
      screen: 'dark',
    },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      best = ctx.storage.get('best.breakout', 0);
      bestAtStart = best;
      ({ canvas, g } = createScreenCanvas(container, L.W, L.H));

      ctx.input.onDrag(canvas, dragBy);
      ctx.input.onTap(canvas, primary);
      ctx.input.onKey((code) => {
        if (code === 'ArrowLeft' || code === 'KeyA') heldLeft = true;
        else if (code === 'ArrowRight' || code === 'KeyD') heldRight = true;
        else if (code === 'Space' || code === 'Enter') primary();
      });
      ctx.input.onKeyUp((code) => {
        if (code === 'ArrowLeft' || code === 'KeyA') heldLeft = false;
        else if (code === 'ArrowRight' || code === 'KeyD') heldRight = false;
      });
      ctx.input.onBlur(() => { heldLeft = false; heldRight = false; }); // keyup is lost on window switch
      ctx.onResize(() => { cssWidth = 0; }); // re-measure after the container changes width

      loop = new GameLoop(update, render);
      loop.start();
    },

    pause(): void {
      paused = true;
      loop?.pause();
    },

    resume(): void {
      paused = false;
      heldLeft = false; // keyups during pause never arrive; reset so nothing auto-moves on resume
      heldRight = false;
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
