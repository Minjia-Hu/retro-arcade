import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { createScreenCanvas } from '../../core/screen';
import * as L from './logic';
import { AI_LEVELS, findBestMove, type AiLevel } from './ai';

const W = 320;
const H = 320;
const MARGIN = 20;
const GAP = (W - 2 * MARGIN) / (L.SIZE - 1); // 交叉点间距
const STONE_R = 11; // 棋子直径 22

function at(x: number, y: number): number { return y * L.SIZE + x; }
function px(c: number): number { return MARGIN + c * GAP; }

const STAR = [at(3, 3), at(11, 3), at(3, 11), at(11, 11), L.CENTER]; // 星位

/** 纸盘配色（设计稿 2f） */
const PAPER = {
  board: '#efe0c3',
  line: '#b5a88f',
  ink: '#2b2118',
  black: '#2b2118',
  white: '#fffaf0',
  whiteShade: '#ddd1bc',
  hover: '#d6336c',
  shadow: 'rgba(43, 33, 24, .3)',
} as const;

const MODES: { id: 'pvp' | AiLevel['id']; label: string }[] = [
  { id: 'pvp', label: '2 PLAYERS' },
  { id: 'easy', label: 'AI EASY' },
  { id: 'medium', label: 'AI MEDIUM' },
  { id: 'hard', label: 'AI HARD' },
];

/**
 * 顶栏药丸用的短标签：cab-pill 不换行，实测 MODES 里带空格的两词标签
 * （如 "2 PLAYERS"）会在 GOMOKU 这种较长的 displayName 旁挤到换行，
 * 把游戏名挤成省略号。药丸只需单词，浮层按钮仍用 MODES 的完整标签。
 */
const PILL_LABEL: Record<'pvp' | AiLevel['id'], string> = {
  pvp: 'PVP', easy: 'EASY', medium: 'MEDIUM', hard: 'HARD',
};

export function createGomoku(): Game {
  let game: L.GomokuState | null = null; // null = 尚未开局（模式菜单开着）
  let mode: 'pvp' | AiLevel['id'] = 'pvp';
  let aiLevel: AiLevel | null = null; // null = 双人
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let loop: GameLoop | null = null;
  let ctx: GameContext | null = null;
  let paused = false;
  let thinking = false;
  let worker: Worker | null = null;
  let token = 0; // 作废过期的 Worker 回复（重开/返回菜单后）
  let endedAt = 0; // 结算时刻；0 表示结算浮层已被消费（回到菜单）
  let hover = -1; // 悬停中的交叉点 idx，-1 = 无
  let hoverCleanup: (() => void) | null = null;

  let head: { black: HTMLElement; white: HTMLElement } | null = null;
  let shownAi: boolean | null = null; // 回合筹文案的缓存；buildHead 里重置

  function buildHead(host: HTMLElement): void {
    host.innerHTML = `
      <div class="chip" data-ref="black" aria-label="Black">● BLACK</div>
      <div class="chip" data-ref="white" aria-label="White">○ WHITE</div>`;
    const q = (r: string) => host.querySelector<HTMLElement>(`[data-ref="${r}"]`)!;
    head = { black: q('black'), white: q('white') };
    shownAi = false; // 与上面写死的 BLACK/WHITE 默认文案对应
  }

  /** 文案随模式变：AI 局是 YOU/CPU，双人局是 BLACK/WHITE（设计稿只画了 AI 那种） */
  function syncHead(): void {
    if (!head || !game) return;
    // 文案只在切模式时变，却每帧都写会反复重建文本节点——与 2048/MINES 同样做缓存
    const ai = mode !== 'pvp';
    if (ai !== shownAi) {
      shownAi = ai;
      head.black.textContent = ai ? '● YOU' : '● BLACK';
      head.white.textContent = ai ? '○ CPU' : '○ WHITE';
    }
    const turn = game.turn;
    head.black.classList.toggle('is-turn', turn === L.BLACK && game.status === 'playing');
    head.white.classList.toggle('is-turn', turn === L.WHITE && game.status === 'playing');
  }

  /** 浮层盖住棋盘时，输入整体冻结（照 SUDOKU 的 frozen() 写法） */
  function frozen(): boolean {
    return paused || Boolean(ctx?.overlayOpen());
  }

  function humanCanPlay(): boolean {
    if (!game || game.status !== 'playing' || thinking) return false;
    if (aiLevel && game.turn === L.WHITE) return false; // 轮到 AI
    return true;
  }

  function canInteract(): boolean {
    return !frozen() && humanCanPlay();
  }

  function ensureWorker(): Worker | null {
    if (worker) return worker;
    try {
      worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent) => {
        const { idx, token: replyToken } = e.data as { idx: number; token: number };
        if (replyToken !== token) return; // 过期回复：玩家已返回菜单或另开新局。先判过期再复位 thinking，否则旧局的回复会解冻新局
        thinking = false;
        if (paused || !game || game.status !== 'playing') return;
        applyAiMove(idx);
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
      w.postMessage({ board: game.board.slice(), player: game.turn, depth: aiLevel.depth, token });
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
      ctx?.audio.play(game.status === 'won' ? 'win' : 'over');
      reportEnd();
    } else {
      ctx?.audio.play('action');
      if (aiLevel && game.turn === L.WHITE) requestAi();
    }
  }

  function startGame(m: 'pvp' | AiLevel['id']): void {
    mode = m;
    game = L.createGame();
    aiLevel = m === 'pvp' ? null : (AI_LEVELS.find((l) => l.id === m) ?? null);
    token += 1;
    thinking = false;
    hover = -1;
    ctx?.overlay(null);
    ctx?.setPill(PILL_LABEL[m]);
    ctx?.audio.play('click');
    // 人执黑先手，AI 执白，无需首手请求
  }

  function showMenu(): void {
    const resumable = game !== null && game.status === 'playing';
    ctx?.overlay({
      title: 'GOMOKU',
      tone: 'win',
      lines: [],
      actions: [
        ...(resumable
          ? [{ label: '✕ RESUME', kind: 'secondary' as const, onPress: () => ctx?.overlay(null) }]
          : []),
        ...MODES.map((m) => ({
          label: m.label, kind: 'secondary' as const, onPress: () => startGame(m.id),
        })),
      ],
      hints: [resumable ? 'RESUME OR PICK A MODE' : 'PICK A MODE TO BEGIN'],
    });
  }

  /** 结算浮层期间 Space / 点画布 = ▶ NEW GAME（模式菜单不算）。返回是否已消费这次输入 */
  function restartIfEnded(): boolean {
    if (!ctx?.overlayOpen() || !game || game.status === 'playing' || !endedAt) return false;
    if (performance.now() - endedAt >= 400) { // 落子瞬间常有连点
      endedAt = 0; // 菜单开着时再按不会反复重开菜单
      showMenu();
    }
    return true;
  }

  function reportEnd(): void {
    if (!game) return;
    endedAt = performance.now();
    const draw = game.status === 'draw';
    const humanWon = mode === 'pvp' || game.winner === L.BLACK;
    ctx?.overlay({
      title: draw ? 'DRAW' : game.winner === L.BLACK ? 'BLACK WINS' : 'WHITE WINS',
      tone: draw ? 'win' : humanWon ? 'win' : 'lose',
      lines: [MODES.find((m) => m.id === mode)!.label],
      actions: [{ label: '▶ NEW GAME', onPress: showMenu }],
      hints: ['SPACE / TAP FOR A NEW GAME'],
    });
  }

  /** CSS 坐标 → 逻辑坐标（画布固定 320×320，无需按当前视图换算） */
  function toLogical(cssX: number, cssY: number): [number, number] {
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    return [(cssX / rect.width) * W, (cssY / rect.height) * H];
  }

  /** 最近交叉点；落在棋盘外返回 -1 */
  function intersectionAt(cssX: number, cssY: number): number {
    const [x, y] = toLogical(cssX, cssY);
    const c = Math.round((x - MARGIN) / GAP);
    const r = Math.round((y - MARGIN) / GAP);
    if (c < 0 || c >= L.SIZE || r < 0 || r >= L.SIZE) return -1;
    return r * L.SIZE + c;
  }

  function placeStone(cssX: number, cssY: number): void {
    if (restartIfEnded()) return;
    if (!canInteract() || !game) return;
    const idx = intersectionAt(cssX, cssY);
    if (idx < 0 || game.board[idx] !== L.EMPTY) return;
    if (L.playMove(game, idx)) {
      hover = -1;
      afterMove();
    }
  }

  function updateHover(cssX: number, cssY: number): void {
    if (!canInteract() || !game) { hover = -1; return; }
    const idx = intersectionAt(cssX, cssY);
    hover = idx >= 0 && game.board[idx] === L.EMPTY ? idx : -1;
  }

  function clearHover(): void {
    hover = -1;
  }

  function drawBoardBase(): void {
    if (!g) return;
    g.fillStyle = PAPER.board;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = PAPER.line;
    g.lineWidth = 1;
    for (let k = 0; k < L.SIZE; k++) {
      g.beginPath();
      g.moveTo(px(0), px(k)); g.lineTo(px(L.SIZE - 1), px(k));
      g.moveTo(px(k), px(0)); g.lineTo(px(k), px(L.SIZE - 1));
      g.stroke();
    }
    g.fillStyle = PAPER.ink;
    for (const sIdx of STAR) {
      g.beginPath();
      g.arc(px(sIdx % L.SIZE), px(Math.floor(sIdx / L.SIZE)), 3, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawStone(idx: number, player: number): void {
    if (!g) return;
    const cx = px(idx % L.SIZE);
    const cy = px(Math.floor(idx / L.SIZE));
    // 投影
    g.beginPath();
    g.arc(cx + 1, cy + 2, STONE_R, 0, Math.PI * 2);
    g.fillStyle = PAPER.shadow;
    g.fill();
    // 棋子本体 + ink 描边
    g.beginPath();
    g.arc(cx, cy, STONE_R, 0, Math.PI * 2);
    g.fillStyle = player === L.BLACK ? PAPER.black : PAPER.white;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = PAPER.ink;
    g.stroke();
    // 内侧高光（黑）/ 阴影（白）
    g.beginPath();
    g.arc(cx - STONE_R * 0.3, cy - STONE_R * 0.3, STONE_R * 0.4, 0, Math.PI * 2);
    g.fillStyle = player === L.BLACK ? 'rgba(255, 255, 255, .2)' : PAPER.whiteShade;
    g.fill();
  }

  function drawHoverGhost(): void {
    if (!g || hover < 0) return;
    const cx = px(hover % L.SIZE);
    const cy = px(Math.floor(hover / L.SIZE));
    g.save();
    g.setLineDash([4, 3]);
    g.lineWidth = 2;
    g.strokeStyle = PAPER.hover;
    g.beginPath();
    g.arc(cx, cy, STONE_R, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  function render(): void {
    if (!g) return;
    drawBoardBase();
    if (game) {
      for (let i = 0; i < game.board.length; i++) {
        if (game.board[i] !== L.EMPTY) drawStone(i, game.board[i]);
      }
      if (canInteract()) drawHoverGhost();
    }
    syncHead();
  }

  return {
    meta: {
      id: 'gomoku',
      name: '五子棋',
      icon: '⚫',
      displayName: 'GOMOKU',
      hints: ['CLICK TO PLACE', 'FIVE IN A ROW WINS'],
      screen: 'paper',
      head: true,
      pausable: false,
      // ☰（同 MINES/SUDOKU）而非 "↺ NEW"：这颗按钮开的是模式菜单，不是直接重开一局；
      // 实测 "↺ NEW" + 长名 GOMOKU + 模式药丸三者会挤到顶栏换行（NEW 折成两行、
      // GOMOKU 被省略号截断），换回单字符按钮后腾出的空间正好够用。
      tools: [{ id: 'menu', label: '☰', aria: 'Mode menu' }],
    },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      ({ canvas, g } = createScreenCanvas(container, W, H));

      if (ctx.head) buildHead(ctx.head);
      ctx.onTool('menu', () => showMenu());

      ctx.input.onTapAt(canvas, placeStone);
      ctx.input.onKey((code) => {
        if (code === 'Space' || code === 'Enter') restartIfEnded();
      });

      // 悬停虚影需要移动坐标，InputService 没有对应方法，直接在画布上挂原生监听
      const onMove = (e: PointerEvent) => {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        updateHover(e.clientX - rect.left, e.clientY - rect.top);
      };
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerleave', clearHover);
      canvas.addEventListener('pointercancel', clearHover);
      hoverCleanup = () => {
        canvas?.removeEventListener('pointermove', onMove);
        canvas?.removeEventListener('pointerleave', clearHover);
        canvas?.removeEventListener('pointercancel', clearHover);
      };

      // 不存档：每次挂载都从模式菜单开始
      showMenu();

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
      hoverCleanup?.();
      hoverCleanup = null;
      canvas?.remove();
      canvas = null;
      g = null;
      head = null;
      ctx = null; // 事件监听由 frame 的 InputService.dispose() 统一清理
    },
  };
}
