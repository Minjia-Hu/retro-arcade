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
}

export interface GameContext {
  audio: AudioFx;
  storage: ArcadeStorage;
  input: InputService;
  /** 注册容器尺寸变化回调，返回解除函数 */
  onResize(cb: () => void): () => void;
}

export interface Game {
  meta: GameMeta;
  mount(container: HTMLElement, ctx: GameContext): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
