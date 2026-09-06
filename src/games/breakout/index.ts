import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { SCREEN } from '../../core/theme';
import * as L from './logic';
import { padScore } from '../../core/format';
import { createScreenCanvas } from '../../core/screen';

const KEY_PADDLE_SPEED = 300; // 键盘按住移动速度 px/s
/** 砖块四行由上至下：pink / orange / gold / teal（设计稿 2b） */
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
  let bestAtStart = 0; // 本局开始前的最高分，用来判断是否刷新纪录

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

  /** 浮层 RETRY 按钮的入口：共用 paused 卫语句，但不继承 400ms 防连点 */
  function retry(): void {
    if (paused) return;
    restart();
  }

  function restart(): void {
    state = L.createState();
    bestAtStart = best;
    ctx?.settle(null);
  }

  function dragBy(cssDx: number): void {
    if (paused || !canvas || state.status === 'over') return;
    const rect = canvas.getBoundingClientRect();
    L.movePaddle(state, state.paddleX + (cssDx / rect.width) * L.W);
  }

  function update(dt: number): void {
    if (heldLeft !== heldRight && state.status !== 'over') {
      L.movePaddle(state, state.paddleX + (heldRight ? 1 : -1) * KEY_PADDLE_SPEED * dt);
    }
    // 子步进：把单步位移压到 ≤12px，防止高关卡球速在长帧（dt 上限 50ms）下穿过挡板/砖行
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
      ctx?.settle({
        title: record ? 'NEW HIGH SCORE' : 'GAME OVER',
        tone: record ? 'record' : 'lose',
        lines: [`SCORE ${padScore(state.score, 6)}`, `LEVEL ${padScore(state.level, 2)}`, `BEST ${padScore(best, 6)}`],
        action: { label: '▶ RETRY', onPress: retry },
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

    // HUD：分数金色左上、生命粉色右上（设计稿 2b）。
    // spec 写的 (12,16) 是设计稿的盒坐标；canvas 用 alphabetic 基线，y=16 会顶到上沿，故取 (16,30)
    g.font = `700 15px ${SCREEN.mono}`;
    g.textAlign = 'left';
    g.fillStyle = SCREEN.gold;
    g.fillText(`SCORE ${padScore(state.score, 4)}`, 16, 30);
    g.textAlign = 'right';
    g.fillStyle = SCREEN.pink;
    const lives = Math.max(0, Math.min(3, state.lives));
    g.fillText('♥'.repeat(lives) + '♡'.repeat(3 - lives), L.W - 16, 30);
    // 关卡设计稿没画，但游戏会升级，不显示玩家就无从得知，故保留为暗色小字
    g.textAlign = 'center';
    g.font = `12px ${SCREEN.mono}`;
    g.fillStyle = 'rgba(255, 250, 240, .45)';
    g.fillText(`LEVEL ${state.level}`, L.W / 2, 30);

    // 砖块：按行取色，斜面 + 同色辉光
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

    // 挡板：teal 圆角
    g.fillStyle = SCREEN.teal;
    g.shadowColor = SCREEN.glow.teal;
    g.shadowBlur = 12;
    g.beginPath();
    g.roundRect(state.paddleX - L.PADDLE_W / 2, L.PADDLE_Y, L.PADDLE_W, L.PADDLE_H, 6);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(0, 0, 0, .25)';
    g.fillRect(state.paddleX - L.PADDLE_W / 2, L.PADDLE_Y + L.PADDLE_H - 2, L.PADDLE_W, 2);

    // 球：白色
    g.fillStyle = SCREEN.white;
    g.shadowColor = SCREEN.glow.white;
    g.shadowBlur = 12;
    g.beginPath();
    g.arc(state.ballX, state.ballY, L.BALL_R, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;

    // 开局提示留在画布内；GAME OVER 走 ctx.settle 的 DOM 浮层
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
      name: '打砖块',
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

      loop = new GameLoop(update, render);
      loop.start();
    },

    pause(): void {
      paused = true;
      loop?.pause();
    },

    resume(): void {
      paused = false;
      heldLeft = false; // 暂停期间的按键抬起收不到，复位防止恢复后自走
      heldRight = false;
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
