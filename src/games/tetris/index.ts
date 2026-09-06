import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { SCREEN } from '../../core/theme';
import * as L from './logic';
import { padScore } from '../../core/format';

const CELL = 22;
const W = L.COLS * CELL; // 220：画布只剩棋盘，边框圆角由 .screen 提供
const H = L.ROWS * CELL; // 440
const REPEAT_DELAY = 0.11; // 按住左右/软降的重复间隔（秒）

/** 七种方块循环取暖霓虹四色（设计稿 2a 的 NE 对象就是这四色） */
const PIECE_TONES = ['teal', 'gold', 'pink', 'orange'] as const;
const pieceFill = (type: number): string => SCREEN[PIECE_TONES[type % PIECE_TONES.length]];
const pieceGlow = (type: number): string => SCREEN.glow[PIECE_TONES[type % PIECE_TONES.length]];

type PadId = 'left' | 'right' | 'rotate' | 'soft' | 'hard' | 'hold';

const PAD: { id: PadId; label: string; aria: string }[] = [
  { id: 'left', label: '◀', aria: '左移' },
  { id: 'right', label: '▶', aria: '右移' },
  { id: 'rotate', label: '⟳', aria: '旋转' },
  { id: 'soft', label: '▼', aria: '软降' },
  { id: 'hard', label: '⤓', aria: '硬降' },
  { id: 'hold', label: '⇄', aria: '暂存' },
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
  let bestAtStart = 0; // 本局开始前的最高分，用来判断是否刷新纪录
  let side: {
    next: HTMLElement; hold: HTMLElement;
    score: HTMLElement; level: HTMLElement; best: HTMLElement;
  } | null = null;
  let shownNext: number | null = -1; // 侧栏迷你块的重绘节流：仅在换块时改 innerHTML
  let shownHold: number | null = -1;

  function saveBest(): void {
    if (state.score > best) {
      best = state.score;
      ctx?.storage.set('best.tetris', best);
    }
  }

  function reportOver(): void {
    const record = state.score > bestAtStart;
    ctx?.settle({
      title: record ? 'NEW HIGH SCORE' : 'GAME OVER',
      tone: record ? 'record' : 'lose',
      lines: [`SCORE ${padScore(state.score, 6)}`, `LINES ${padScore(state.lines, 3)}`, `BEST ${padScore(best, 6)}`],
      action: { label: '▶ RETRY', onPress: retry },
      hints: ['SPACE / TAP TO RETRY'],
    });
  }

  function afterEvents(ev: L.TetrisEvents): void {
    if (ev.locked) ctx?.audio.play('action');
    if (ev.cleared > 0) {
      ctx?.audio.play('score');
      saveBest();
    }
    if (ev.over) {
      endedAt = performance.now();
      saveBest();
      ctx?.audio.play('over');
      reportOver();
    }
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

  /** 浮层 RETRY 按钮的入口：共用 paused 卫语句，但不继承 primary 的 400ms 防连点 */
  function retry(): void {
    if (paused) return;
    restart();
  }

  function restart(): void {
    state = L.createState();
    bestAtStart = best;
    ctx?.settle(null);
    // 不在这里发声：浮层 RETRY 的 click 由 frame 统一负责，重复发声会响两下
  }

  function act(id: PadId): void {
    if (paused) return;
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

  /** hold 也可能触发终局（换入的块出生即碰撞），必须补查 status */
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
    // 按住重复（键盘）：左右互斥，软降独立
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

  /** 单格：填充 + 同色辉光 + 设计稿的斜面（右下暗、左上亮） */
  function drawCell(px: number, py: number, size: number, type: number): void {
    if (!g) return;
    g.fillStyle = pieceFill(type);
    g.shadowColor = pieceGlow(type);
    g.shadowBlur = 8;
    g.fillRect(px, py, size, size);
    g.shadowBlur = 0;
    const b = Math.max(2, Math.round(size / 7)); // 22px 格对应 3px 斜面
    g.fillStyle = 'rgba(0, 0, 0, .3)';
    g.fillRect(px + size - b, py, b, size);
    g.fillRect(px, py + size - b, size, b);
    g.fillStyle = 'rgba(255, 255, 255, .25)';
    g.fillRect(px, py, size, b);
    g.fillRect(px, py, b, size);
  }

  /**
   * 迷你块用 DOM 小方块拼，按**实际包围盒**居中于 44×30。
   * 不能拿 def.size 当高度：rotation 0 下没有方块真占满 def.size 行
   * （I 只有 1 行、其余 2 行），照 def.size 算出的 oy 会是负数，
   * T/S/Z/J/L 会越出卡片上沿顶到 NEXT 标签底下。宽高都参与 size 约束。
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
    host.innerHTML = PAD
      .map((b) => `<button class="pad-btn" data-pad="${b.id}" aria-label="${b.aria}">${b.label}</button>`)
      .join('');
    host.querySelectorAll<HTMLButtonElement>('[data-pad]').forEach((el) => {
      el.addEventListener('click', () => {
        act(el.dataset.pad as PadId);
        el.blur();
      });
    });
  }

  /** 每帧同步侧栏；迷你块只在换块时重绘，避免 60fps 反复写 innerHTML */
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

    // 当前块（y<0 的部分不画）
    if (state.status !== 'over') {
      for (const [cx, cy] of L.rotatedCells(state.current.type, state.current.rot)) {
        const y = state.current.y + cy;
        if (y >= 0) drawCell((state.current.x + cx) * CELL, y * CELL, CELL, state.current.type);
      }
    }

    // 开局提示留在画布内；GAME OVER 走 ctx.settle 的 DOM 浮层
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
      name: '俄罗斯方块',
      icon: '🧱',
      displayName: 'TETRIS',
      hints: ['←→ MOVE', '↑ ROTATE', '↓ DROP', 'SPACE HARD DROP'],
      screen: 'dark',
      side: true,
      pad: true,
    },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      best = ctx.storage.get('best.tetris', 0);
      bestAtStart = best;
      canvas = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`; // CSS 尺寸不变；backing store 按 DPR 放大保证高分屏清晰
      canvas.style.touchAction = 'none';
      canvas.style.userSelect = 'none';
      container.appendChild(canvas);
      g = canvas.getContext('2d')!;
      g.scale(dpr, dpr);

      if (ctx.side) buildSide(ctx.side);
      if (ctx.pad) buildPad(ctx.pad);

      ctx.input.onTap(canvas, tapBoard);
      ctx.input.onKey((code) => {
        if (paused) return;
        if (state.status !== 'playing') {
          if (code === 'Enter' || code === 'Space') {
            if (code === 'Space') heldSpace = true; // 防止重开后按住的空格立即硬降
            primary();
          }
          return;
        }
        // held 标志双重职责：驱动自建重复定时器，并吸收 OS 键盘自动重复
        //（keydown 会以系统重复率反复触发，不滤会叠加成不可控的移动/连续硬降）
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
      heldSoft = false;
      heldRotate = false;
      heldSpace = false;
      heldHold = false;
      loop?.resume();
    },

    destroy(): void {
      loop?.stop();
      loop = null;
      canvas?.remove();
      canvas = null;
      g = null;
      // 与 frame.close() 的 clearSettle() 同构：路由切换到下次 open 之间隔着
      // await entry.load()，不清会在这个窗口里留下一排可点的死按钮
      if (ctx?.pad) ctx.pad.innerHTML = '';
      side = null;
      ctx = null; // 事件监听由 frame 的 InputService.dispose() 统一清理
    },
  };
}
