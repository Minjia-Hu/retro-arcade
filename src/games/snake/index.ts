import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { THEME } from '../../core/theme';
import * as L from './logic';

const CELL = 16; // COLS×16 = 320，ROWS×16 = 480，与逻辑网格一一对应
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

  function handleDir(dir: L.Dir): void {
    if (paused || state.status === 'dead') return;
    L.setDirection(state, dir);
  }

  function tapAction(): void {
    if (paused) return;
    if (state.status === 'dead') {
      if (performance.now() - diedAt < 400) return; // 死亡瞬间常有连点
      state = L.createState();
      deadHandled = false;
      return;
    }
    if (state.status === 'ready') {
      L.setDirection(state, state.dir); // 点按沿当前方向开局
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
    }
  }

  function render(): void {
    if (!g) return;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, W, H);

    // 食物：霓虹粉方块
    g.fillStyle = THEME.neonPink;
    g.shadowColor = THEME.neonPink;
    g.shadowBlur = 8;
    g.fillRect(state.food.x * CELL + 2, state.food.y * CELL + 2, CELL - 4, CELL - 4);

    // 蛇身：霓虹绿，蛇头：霓虹黄
    g.shadowColor = THEME.neonGreen;
    for (let i = state.snake.length - 1; i >= 0; i--) {
      const c = state.snake[i];
      g.fillStyle = i === 0 ? THEME.neonYellow : THEME.neonGreen;
      if (i === 0) g.shadowColor = THEME.neonYellow;
      g.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2);
    }
    g.shadowBlur = 0;

    // 分数
    g.fillStyle = THEME.text;
    g.font = `bold 24px ${THEME.font}`;
    g.textAlign = 'center';
    g.fillText(String(state.score), W / 2, 36);

    g.font = `14px ${THEME.font}`;
    if (state.status === 'ready') {
      g.fillStyle = THEME.neonCyan;
      g.fillText('滑动 / 方向键 开始', W / 2, H / 2 + 60);
    } else if (state.status === 'dead') {
      g.fillStyle = THEME.neonPink;
      g.font = `bold 24px ${THEME.font}`;
      g.fillText('GAME OVER', W / 2, H / 2 - 20);
      g.font = `14px ${THEME.font}`;
      g.fillText(`BEST ${best} · 点按重来`, W / 2, H / 2 + 12);
    }
  }

  return {
    meta: { id: 'snake', name: '贪吃蛇', icon: '🐍' },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      best = ctx.storage.get('best.snake', 0);
      canvas = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`; // CSS 尺寸不变；backing store 按 DPR 放大保证高分屏清晰
      canvas.style.touchAction = 'none';
      container.appendChild(canvas);
      g = canvas.getContext('2d')!;
      g.scale(dpr, dpr);

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
      ctx = null; // 事件监听由 frame 的 InputService.dispose() 统一清理
    },
  };
}
