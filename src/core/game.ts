import type { AudioFx } from './audio';
import type { ArcadeStorage } from './storage';
import type { InputService } from './input';

export interface GameMeta {
  id: string;
  name: string;
  icon: string;
  /** 首页展示用的英文大写名；缺省时回退到 name */
  displayName?: string;
  /** 机柜底部的按键提示，用 · 分隔渲染 */
  hints?: string[];
  /** 屏幕井风格：深色屏或浅色纸盘，缺省 dark */
  screen?: 'dark' | 'paper';
  /** 需要屏幕井上方的一行 DOM 时置 true，内容由游戏自己填 */
  head?: boolean;
  /** 需要屏幕井右侧的侧栏时置 true，内容由游戏自己填 */
  side?: boolean;
  /** 需要屏幕下方的触屏控制垫时置 true，内容由游戏自己填 */
  pad?: boolean;
  /** 顶栏是否渲染暂停按钮，缺省 true。FLAPPY 按设计稿不显示 */
  pausable?: boolean;
  /** 顶栏右侧的额外按钮，排在 SND 之前 */
  tools?: { id: string; label: string; aria: string }[];
}

export interface OverlayAction {
  label: string;
  onPress: () => void;
  /** primary 为 accent 底色的主按钮，secondary 为描边按钮。缺省 primary */
  kind?: 'primary' | 'secondary';
}

export interface OverlayView {
  /** 标题文案，如 GAME OVER / SOLVED! / SELECT DIFFICULTY */
  title: string;
  /** 决定标题颜色：lose→magenta、win→teal、record→gold */
  tone: 'lose' | 'win' | 'record';
  /** 说明行，等宽字体渲染 */
  lines: string[];
  /** 一到多个操作按钮，按顺序纵向排列 */
  actions: OverlayAction[];
  /**
   * 浮层期间的底部按键提示，覆盖游戏当前设置的提示（`meta.hints` 或最近一次
   * `ctx.setHints`）。不给则沿用之。
   */
  hints?: string[];
  /** 是否显示 QUIT TO HUB，缺省 true */
  quit?: boolean;
}

export interface GameContext {
  audio: AudioFx;
  storage: ArcadeStorage;
  input: InputService;
  /** 注册容器尺寸变化回调，返回解除函数 */
  onResize(cb: () => void): () => void;
  /** 展示或收起浮层（开始菜单、结算卡片）；传 null 收起 */
  overlay(view: OverlayView | null): void;
  /** 上方栏容器；meta.head 为 true 时可用，否则为 null */
  head: HTMLElement | null;
  /** 侧栏容器；meta.side 为 true 时可用，否则为 null */
  side: HTMLElement | null;
  /** 控制垫容器；meta.pad 为 true 时可用，否则为 null */
  pad: HTMLElement | null;
  /** 替换底部按键提示条 */
  setHints(hints: string[]): void;
  /** 注册顶栏自定义按钮的点击处理；id 需与 meta.tools 中的一致 */
  onTool(id: string, handler: () => void): void;
  /** 改写游戏名右侧的药丸；传 null 隐藏 */
  setPill(text: string | null): void;
  /**
   * 浮层是否正开着。frame 是唯一知道这件事的一方，游戏据此决定要不要吃掉输入——
   * 有的游戏希望浮层期间 Space 仍能重开（结算态），有的希望完全冻结（开始菜单）。
   */
  overlayOpen(): boolean;
}

export interface Game {
  meta: GameMeta;
  mount(container: HTMLElement, ctx: GameContext): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
