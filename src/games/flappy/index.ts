import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { THEME } from '../../core/theme';
import * as L from './logic';

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

  function act(): void {
    if (paused) return;
    if (state.status === 'dead') {
      if (performance.now() - diedAt < 400) return; // 死亡瞬间常有连点，给 GAME OVER 一点展示时间
      state = L.createState();
      deadHandled = false;
      return;
    }
    L.flap(state);
    ctx?.audio.play('action');
  }

  function update(dt: number): void {
    const scored = L.tick(state, dt);
    if (scored) {
      ctx?.audio.play('score');
      if (state.score > best) {
        best = state.score;
        ctx?.storage.set('best.flappy', best);
      }
    }
    if (state.status === 'dead' && !deadHandled) {
      deadHandled = true;
      diedAt = performance.now();
      ctx?.audio.play('hit');
    }
  }

  function render(): void {
    if (!g) return;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, L.W, L.H);

    // 管道：霓虹绿
    g.fillStyle = THEME.neonGreen;
    g.shadowColor = THEME.neonGreen;
    g.shadowBlur = 8;
    for (const p of state.pipes) {
      g.fillRect(p.x, 0, L.PIPE_W, p.gapY - L.PIPE_GAP / 2);
      g.fillRect(p.x, p.gapY + L.PIPE_GAP / 2, L.PIPE_W, L.H - p.gapY - L.PIPE_GAP / 2);
    }

    // 小鸟：霓虹黄圆
    g.shadowColor = THEME.neonYellow;
    g.fillStyle = THEME.neonYellow;
    g.beginPath();
    g.arc(L.BIRD_X, state.birdY, L.BIRD_R, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;

    // 分数
    g.fillStyle = THEME.text;
    g.font = `bold 28px ${THEME.font}`;
    g.textAlign = 'center';
    g.fillText(String(state.score), L.W / 2, 48);

    // 状态提示
    g.font = `14px ${THEME.font}`;
    if (state.status === 'ready') {
      g.fillStyle = THEME.neonCyan;
      g.fillText('点按 / 空格 起飞', L.W / 2, L.H / 2 + 60);
    } else if (state.status === 'dead') {
      g.fillStyle = THEME.neonPink;
      g.font = `bold 24px ${THEME.font}`;
      g.fillText('GAME OVER', L.W / 2, L.H / 2 - 20);
      g.font = `14px ${THEME.font}`;
      g.fillText(`BEST ${best} · 点按重来`, L.W / 2, L.H / 2 + 12);
    }
  }

  return {
    meta: { id: 'flappy', name: 'FLAPPY BIRD', icon: '🐦' },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      best = ctx.storage.get('best.flappy', 0);
      canvas = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = L.W * dpr;
      canvas.height = L.H * dpr;
      canvas.style.width = `${L.W}px`; // CSS 尺寸不变；backing store 按 DPR 放大保证高分屏清晰
      canvas.style.touchAction = 'none';
      container.appendChild(canvas);
      g = canvas.getContext('2d')!;
      g.scale(dpr, dpr);

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
      ctx = null; // 事件监听由 frame 的 InputService.dispose() 统一清理
    },
  };
}
