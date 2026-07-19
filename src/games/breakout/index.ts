import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { THEME } from '../../core/theme';
import * as L from './logic';

const KEY_PADDLE_SPEED = 300; // 键盘按住移动速度 px/s
const ROW_COLORS = [THEME.neonPink, '#ff7a2f', THEME.neonYellow, THEME.neonGreen, THEME.neonCyan];

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

  function primary(): void {
    if (paused) return;
    if (state.status === 'ready') {
      L.launch(state);
      ctx?.audio.play('action');
    } else if (state.status === 'over') {
      if (performance.now() - endedAt < 400) return;
      state = L.createState();
      ctx?.audio.play('click');
    }
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
    } else if (ev.lost) {
      ctx?.audio.play('hit');
    }
  }

  function render(): void {
    if (!g) return;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, L.W, L.H);

    // 三面反弹墙（青）+ 底部致死线（粉色虚线）——边界可见规矩
    g.strokeStyle = THEME.neonCyan;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(1, L.H);
    g.lineTo(1, 1);
    g.lineTo(L.W - 1, 1);
    g.lineTo(L.W - 1, L.H);
    g.stroke();
    g.strokeStyle = THEME.neonPink;
    g.setLineDash([6, 6]);
    g.beginPath();
    g.moveTo(0, L.H - 1);
    g.lineTo(L.W, L.H - 1);
    g.stroke();
    g.setLineDash([]);

    // HUD
    g.fillStyle = THEME.text;
    g.font = `bold 16px ${THEME.font}`;
    g.textAlign = 'left';
    g.fillText(`${state.score}`, 10, 40);
    g.textAlign = 'center';
    g.fillStyle = THEME.dim;
    g.font = `12px ${THEME.font}`;
    g.fillText(`LEVEL ${state.level}`, L.W / 2, 40);
    g.textAlign = 'right';
    g.fillStyle = THEME.neonPink;
    g.fillText('♥'.repeat(Math.max(0, state.lives)), L.W - 10, 40);

    // 砖块（按行配色）
    for (const b of state.bricks) {
      if (!b.alive) continue;
      const row = Math.floor((b.y - 60) / 18);
      g.fillStyle = ROW_COLORS[row] ?? THEME.neonCyan;
      g.fillRect(b.x, b.y, b.w, b.h);
    }

    // 挡板与球
    g.fillStyle = THEME.neonCyan;
    g.shadowColor = THEME.neonCyan;
    g.shadowBlur = 8;
    g.fillRect(state.paddleX - L.PADDLE_W / 2, L.PADDLE_Y, L.PADDLE_W, L.PADDLE_H);
    g.shadowColor = THEME.neonYellow;
    g.fillStyle = THEME.neonYellow;
    g.beginPath();
    g.arc(state.ballX, state.ballY, L.BALL_R, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;

    // 状态提示
    g.textAlign = 'center';
    g.font = `14px ${THEME.font}`;
    if (state.status === 'ready') {
      g.fillStyle = THEME.neonCyan;
      g.fillText('拖动移板 · 点按/空格 发球', L.W / 2, L.H / 2 + 40);
    } else if (state.status === 'over') {
      g.fillStyle = THEME.neonPink;
      g.font = `bold 24px ${THEME.font}`;
      g.fillText('GAME OVER', L.W / 2, L.H / 2 - 20);
      g.fillStyle = THEME.neonCyan;
      g.font = `14px ${THEME.font}`;
      g.fillText(`BEST ${best} · 点按重来`, L.W / 2, L.H / 2 + 12);
    }
  }

  return {
    meta: { id: 'breakout', name: '打砖块', icon: '🕹️' },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      best = ctx.storage.get('best.breakout', 0);
      canvas = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = L.W * dpr;
      canvas.height = L.H * dpr;
      canvas.style.width = `${L.W}px`; // CSS 尺寸不变；backing store 按 DPR 放大保证高分屏清晰
      canvas.style.touchAction = 'none';
      container.appendChild(canvas);
      g = canvas.getContext('2d')!;
      g.scale(dpr, dpr);

      ctx.input.onDrag(canvas, dragBy);
      ctx.input.onTapAt(canvas, () => primary());
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
