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
  /** 需要屏幕井右侧的侧栏时置 true，内容由游戏自己填 */
  side?: boolean;
  /** 需要屏幕下方的触屏控制垫时置 true，内容由游戏自己填 */
  pad?: boolean;
  /** 顶栏是否渲染暂停按钮，缺省 true。FLAPPY 按设计稿不显示 */
  pausable?: boolean;
}

export interface SettleView {
  /** 标题文案，如 GAME OVER / SOLVED! / NEW HIGH SCORE */
  title: string;
  /** 决定标题颜色：lose→magenta、win→teal、record→gold */
  tone: 'lose' | 'win' | 'record';
  /** 分数行，等宽字体渲染 */
  lines: string[];
  /** 主操作按钮 */
  action: { label: string; onPress: () => void };
  /**
   * 结算态的底部按键提示，覆盖 meta.hints。设计稿 artboard 1b 的提示条与
   * 游戏态（1a）不同：游戏中是 "SPACE START"，结算时是 "SPACE / TAP TO RETRY"。
   * 不给则沿用 meta.hints。
   */
  hints?: string[];
}

export interface GameContext {
  audio: AudioFx;
  storage: ArcadeStorage;
  input: InputService;
  /** 注册容器尺寸变化回调，返回解除函数 */
  onResize(cb: () => void): () => void;
  /** 上报结算状态；传 null 收起浮层 */
  settle(view: SettleView | null): void;
}

export interface Game {
  meta: GameMeta;
  mount(container: HTMLElement, ctx: GameContext): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
