import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { SCREEN } from '../../core/theme';
import * as L from './logic';
import { padScore } from '../../core/format';
import { createScreenCanvas } from '../../core/screen';

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
  let bestAtStart = 0; // 本局开始前的最高分，用来判断是否刷新纪录

  function handleDir(dir: L.Dir): void {
    if (paused || state.status === 'dead') return;
    L.setDirection(state, dir);
  }


  /**
   * 浮层 RETRY 按钮的入口。与键盘/点按路径共用 paused 卫语句，但**不**走 tapAction
   * 的 400ms 防连点去抖——那是给画布误触准备的，一次明确的按钮点击不该被吞掉。
   */
  function retry(): void {
    if (paused) return;
    restart();
  }

  function restart(): void {
    state = L.createState();
    deadHandled = false;
    bestAtStart = best;
    ctx?.settle(null);
  }

  function tapAction(): void {
    if (paused) return;
    if (state.status === 'dead') {
      if (performance.now() - diedAt < 400) return; // 死亡瞬间常有连点
      restart();
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
      const record = state.score > bestAtStart;
      ctx?.settle({
        title: record ? 'NEW HIGH SCORE' : 'GAME OVER',
        tone: record ? 'record' : 'lose',
        lines: [`SCORE ${padScore(state.score, 4)}`, `BEST ${padScore(best, 6)}`],
        action: { label: '▶ RETRY', onPress: retry },
        hints: ['SPACE / TAP TO RETRY'],
      });
    }
  }

  function render(): void {
    if (!g) return;
    g.fillStyle = SCREEN.ground;
    g.fillRect(0, 0, W, H);

    // 边界墙：撞上即死，必须肉眼可见（画布背景与屏幕井同色，无此描边则边界隐形）
    g.strokeStyle = SCREEN.teal;
    g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, H - 2);

    // 食物：暖霓虹粉，圆角 3
    g.fillStyle = SCREEN.pink;
    g.shadowColor = SCREEN.glow.pink;
    g.shadowBlur = 10;
    g.beginPath();
    g.roundRect(state.food.x * CELL + 2, state.food.y * CELL + 2, CELL - 4, CELL - 4, 3);
    g.fill();

    // 蛇身：teal，蛇头：gold
    g.shadowBlur = 8;
    for (let i = state.snake.length - 1; i >= 0; i--) {
      const c = state.snake[i];
      const head = i === 0;
      g.fillStyle = head ? SCREEN.gold : SCREEN.teal;
      g.shadowColor = head ? SCREEN.glow.gold : SCREEN.glow.teal;
      g.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2);
    }

    // 分数：设计稿补零到 4 位
    g.fillStyle = SCREEN.gold;
    g.shadowColor = SCREEN.glow.gold;
    g.shadowBlur = 10;
    g.font = `700 24px ${SCREEN.mono}`;
    g.textAlign = 'center';
    g.fillText(padScore(state.score, 4), W / 2, 40);
    g.shadowBlur = 0;

    // GAME OVER 与开局提示不再画在画布里：前者走 ctx.settle 的 DOM 浮层，
    // 后者放在机柜底部的按键提示条
  }

  return {
    meta: {
      id: 'snake',
      name: '贪吃蛇',
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
      ctx = null; // 事件监听由 frame 的 InputService.dispose() 统一清理
    },
  };
}
