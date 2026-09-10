import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { SCREEN } from '../../core/theme';
import * as L from './logic';
import { padScore } from '../../core/format';
import { createScreenCanvas } from '../../core/screen';

/** 与 arcade.css 的 --ink 对应，改一处要同步另一处（canvas 读不到 CSS 变量） */
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
      if (performance.now() - diedAt < 400) return; // 死亡瞬间常有连点，给结算浮层一点展示时间
      restart();
      ctx?.audio.play('click');
      return;
    }
    L.flap(state);
    ctx?.audio.play('action');
  }

  /** 浮层 RETRY 按钮的入口：共用 paused 卫语句，但不继承 400ms 防连点 */
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
        ctx?.setHints([`BEST ${padScore(best, 6)}`]); // 设计稿 2c 的提示条显示实时最高分
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
    // 背景：竖向渐变（设计稿 2c）
    const sky = g.createLinearGradient(0, 0, 0, L.H);
    sky.addColorStop(0, SCREEN.ground);
    sky.addColorStop(0.6, SCREEN.ground);
    sky.addColorStop(1, '#241a12');
    g.fillStyle = sky;
    g.fillRect(0, 0, L.W, L.H);
    g.textBaseline = 'alphabetic';

    // 管道：teal 填充 + 深色描边 + 左侧高光
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

    // 地面：条纹 + 墨色顶边
    const gy = L.H - L.GROUND_H; // 地面高度由 logic 持有：致死线就画在这条边上
    for (let x = 0; x < L.W; x += 36) {
      g.fillStyle = '#3a2c1c';
      g.fillRect(x, gy, 18, L.GROUND_H);
      g.fillStyle = '#2e2316';
      g.fillRect(x + 18, gy, 18, L.GROUND_H);
    }
    g.fillStyle = INK;
    g.fillRect(0, gy, L.W, 3);

    // 小鸟：gold 身 + orange 喙 + 深色眼
    const bx = L.BIRD_X;
    const by = state.birdY;
    g.fillStyle = SCREEN.gold;
    g.shadowColor = SCREEN.glow.gold;
    g.shadowBlur = 12;
    g.beginPath();
    g.roundRect(bx - L.BIRD_R, by - L.BIRD_RY, L.BIRD_R * 2, L.BIRD_RY * 2, 5); // 与判定盒同尺寸
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = SCREEN.orange;
    g.fillRect(bx + 10, by - 4, 8, 6);
    g.fillStyle = SCREEN.ground;
    g.beginPath();
    g.arc(bx + 2, by - 4, 2.5, 0, Math.PI * 2);
    g.fill();

    // 分数：Bungee 大字 + 墨色投影
    g.textAlign = 'center';
    g.fillStyle = INK;
    g.font = `34px 'Bungee', ${SCREEN.mono}`;
    g.fillText(padScore(state.score, 2), L.W / 2 + 3, 55 + 3);
    g.fillStyle = SCREEN.white;
    g.fillText(padScore(state.score, 2), L.W / 2, 55);

    // 开局提示留在画布内；GAME OVER 走 ctx.settle 的 DOM 浮层
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
      hints: ['BEST 000000'], // 挂载时由 setHints 覆写为真实值
      screen: 'dark',
      pausable: false, // 设计稿 2c 的顶栏只有 SND
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
      ctx = null; // 事件监听由 frame 的 InputService.dispose() 统一清理
    },
  };
}
