import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { THEME } from '../../core/theme';
import * as L from './logic';
import { AI_LEVELS, findBestMove, type AiLevel } from './ai';

const W = 320;
const H = 400;
const MENU_H = 400;
const MARGIN = 20;
const GAP = (W - 2 * MARGIN) / (L.SIZE - 1); // 交叉点间距
const STAR = [at(3, 3), at(11, 3), at(3, 11), at(11, 11), L.CENTER]; // 星位
const HUD_Y = 372;

function at(x: number, y: number): number { return y * L.SIZE + x; }
function px(c: number): number { return MARGIN + c * GAP; }

interface MenuButton { label: string; mode: 'pvp' | AiLevel['id']; x: number; y: number; w: number; h: number; }

export function createGomoku(): Game {
  let game: L.GomokuState | null = null; // null = 模式菜单
  let aiLevel: AiLevel | null = null; // null = 双人
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let loop: GameLoop | null = null;
  let ctx: GameContext | null = null;
  let paused = false;
  let endedAt = 0;
  let thinking = false;
  let worker: Worker | null = null;
  let token = 0; // 作废过期的 Worker 回复（重开/返回菜单后）

  const menuButtons: MenuButton[] = [
    { label: '双人对战', mode: 'pvp', x: 60, y: 120, w: 200, h: 46 },
    { label: 'AI · 简单', mode: 'easy', x: 60, y: 178, w: 200, h: 46 },
    { label: 'AI · 中等', mode: 'medium', x: 60, y: 236, w: 200, h: 46 },
    { label: 'AI · 困难', mode: 'hard', x: 60, y: 294, w: 200, h: 46 },
  ];

  function ensureWorker(): Worker | null {
    if (worker) return worker;
    try {
      worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent) => {
        const myToken = token;
        if (paused || !game || game.status !== 'playing') { thinking = false; return; }
        if (myToken !== token) return; // 过期回复
        applyAiMove(e.data as number);
      };
      return worker;
    } catch {
      worker = null; // 环境不支持 Worker 时降级为主线程计算
      return null;
    }
  }

  function requestAi(): void {
    if (!game || !aiLevel || game.status !== 'playing') return;
    thinking = true;
    const w = ensureWorker();
    if (w) {
      w.postMessage({ board: game.board.slice(), player: game.turn, depth: aiLevel.depth });
    } else {
      // 无 Worker：主线程直接算（仍可玩，只是可能瞬卡）
      const idx = findBestMove(game.board.slice(), game.turn, aiLevel.depth, Math.random);
      applyAiMove(idx);
    }
  }

  function applyAiMove(idx: number): void {
    thinking = false;
    if (!game || game.status !== 'playing') return;
    if (L.playMove(game, idx)) afterMove();
  }

  function afterMove(): void {
    if (!game) return;
    if (game.status === 'won' || game.status === 'draw') {
      endedAt = performance.now();
      ctx?.audio.play(game.status === 'won' ? 'win' : 'over');
    } else {
      ctx?.audio.play('action');
    }
  }

  function startGame(mode: MenuButton['mode']): void {
    game = L.createGame();
    aiLevel = mode === 'pvp' ? null : (AI_LEVELS.find((l) => l.id === mode) ?? null);
    token += 1;
    thinking = false;
    ctx?.audio.play('click');
    // 人执黑先手，AI 执白，无需首手请求
  }

  function backToMenu(): void {
    game = null;
    aiLevel = null;
    token += 1; // 作废在途 Worker 回复
    thinking = false;
    ctx?.audio.play('click');
  }

  function humanCanPlay(): boolean {
    if (!game || game.status !== 'playing' || thinking) return false;
    if (aiLevel && game.turn === L.WHITE) return false; // 轮到 AI
    return true;
  }

  function toLogical(cssX: number, cssY: number): [number, number] {
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    return [(cssX / rect.width) * W, (cssY / rect.height) * (game ? H : MENU_H)];
  }

  function tapAt(cssX: number, cssY: number): void {
    if (paused) return;
    const [x, y] = toLogical(cssX, cssY);
    if (!game) {
      for (const b of menuButtons) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { startGame(b.mode); return; }
      }
      return;
    }
    if (game.status !== 'playing') {
      if (performance.now() - endedAt < 400) return;
      backToMenu();
      return;
    }
    // HUD 菜单热区
    if (y > HUD_Y && x > W - 72) { backToMenu(); return; }
    if (!humanCanPlay()) return;
    // 最近交叉点
    const c = Math.round((x - MARGIN) / GAP);
    const r = Math.round((y - MARGIN) / GAP);
    if (c < 0 || c >= L.SIZE || r < 0 || r >= L.SIZE) return;
    const idx = r * L.SIZE + c;
    if (L.playMove(game, idx)) {
      afterMove();
      if (aiLevel && game.status === 'playing') requestAi();
    }
  }

  function drawStone(idx: number, player: number, marked: boolean): void {
    if (!g) return;
    const cx = px(idx % L.SIZE);
    const cy = px(Math.floor(idx / L.SIZE));
    g.beginPath();
    g.arc(cx, cy, GAP * 0.42, 0, Math.PI * 2);
    if (player === L.BLACK) {
      g.fillStyle = '#12101c';
      g.fill();
      g.strokeStyle = THEME.neonCyan;
      g.lineWidth = 1.5;
      g.stroke();
    } else {
      g.fillStyle = '#e8e6ff';
      g.fill();
    }
    if (marked) {
      g.fillStyle = player === L.BLACK ? THEME.neonYellow : THEME.neonPink;
      g.beginPath();
      g.arc(cx, cy, 2.5, 0, Math.PI * 2);
      g.fill();
    }
  }

  function renderMenu(): void {
    if (!g) return;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, W, MENU_H);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = THEME.neonYellow;
    g.font = `bold 30px ${THEME.font}`;
    g.fillText('五 子 棋', W / 2, 84);
    g.fillStyle = THEME.dim;
    g.font = `12px ${THEME.font}`;
    g.fillText('人执黑先手 · 15 路', W / 2, 108);
    for (const b of menuButtons) {
      g.strokeStyle = THEME.neonCyan;
      g.lineWidth = 2;
      g.strokeRect(b.x, b.y, b.w, b.h);
      g.fillStyle = THEME.neonCyan;
      g.font = `bold 17px ${THEME.font}`;
      g.fillText(b.label, W / 2, b.y + 29);
    }
  }

  function renderBoard(s: L.GomokuState): void {
    if (!g) return;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, W, H);

    // 外框（边界可见）+ 网格线
    g.strokeStyle = THEME.neonCyan;
    g.lineWidth = 2;
    g.strokeRect(MARGIN - 6, MARGIN - 6, W - 2 * MARGIN + 12, W - 2 * MARGIN + 12);
    g.strokeStyle = '#2a2438';
    g.lineWidth = 1;
    for (let k = 0; k < L.SIZE; k++) {
      g.beginPath();
      g.moveTo(px(0), px(k)); g.lineTo(px(L.SIZE - 1), px(k));
      g.moveTo(px(k), px(0)); g.lineTo(px(k), px(L.SIZE - 1));
      g.stroke();
    }
    // 星位
    g.fillStyle = THEME.dim;
    for (const sIdx of STAR) {
      g.beginPath();
      g.arc(px(sIdx % L.SIZE), px(Math.floor(sIdx / L.SIZE)), 3, 0, Math.PI * 2);
      g.fill();
    }
    // 棋子
    for (let i = 0; i < s.board.length; i++) {
      if (s.board[i] !== L.EMPTY) drawStone(i, s.board[i], i === s.last);
    }

    // HUD
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.font = `13px ${THEME.font}`;
    let hud: string;
    if (s.status === 'won') hud = s.winner === L.BLACK ? '⚫ 黑胜' : '⚪ 白胜';
    else if (s.status === 'draw') hud = '和棋';
    else if (thinking) hud = 'AI 思考中…';
    else hud = s.turn === L.BLACK ? '⚫ 黑方落子' : '⚪ 白方落子';
    g.fillStyle = s.status === 'playing' ? THEME.text : THEME.neonGreen;
    g.fillText(aiLevel ? `${hud}` : `双人 · ${hud}`, MARGIN, HUD_Y + 16);
    g.textAlign = 'right';
    g.fillStyle = THEME.neonCyan;
    g.fillText('☰ 菜单', W - MARGIN, HUD_Y + 16);

    // 终局横幅
    if (s.status !== 'playing') {
      g.textAlign = 'center';
      g.fillStyle = 'rgba(13, 13, 22, 0.82)';
      g.fillRect(0, H / 2 - 44, W, 88);
      g.fillStyle = THEME.neonGreen;
      g.font = `bold 26px ${THEME.font}`;
      const msg = s.status === 'draw' ? '和棋' : s.winner === L.BLACK ? '黑方胜！' : '白方胜！';
      g.fillText(msg, W / 2, H / 2);
      g.fillStyle = THEME.neonCyan;
      g.font = `13px ${THEME.font}`;
      g.fillText('点按返回模式选择', W / 2, H / 2 + 28);
    }
    g.textAlign = 'left';
  }

  function render(): void {
    if (!g) return;
    if (game) renderBoard(game);
    else renderMenu();
  }

  return {
    meta: { id: 'gomoku', name: '五子棋', icon: '⚫' },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
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

      ctx.input.onTapAt(canvas, tapAt);
      ctx.input.onKey((code) => {
        if (paused || !game) return;
        if (game.status !== 'playing' && (code === 'Enter' || code === 'Escape' || code === 'Space')
          && performance.now() - endedAt >= 400) backToMenu();
      });

      loop = new GameLoop(() => {}, render); // 无时间模拟，仅驱动渲染
      loop.start();
    },

    pause(): void { paused = true; loop?.pause(); },
    resume(): void { paused = false; loop?.resume(); },

    destroy(): void {
      loop?.stop();
      loop = null;
      token += 1; // 作废在途 Worker 回复
      worker?.terminate();
      worker = null;
      canvas?.remove();
      canvas = null;
      g = null;
      ctx = null; // 事件监听由 frame 的 InputService.dispose() 统一清理
    },
  };
}
