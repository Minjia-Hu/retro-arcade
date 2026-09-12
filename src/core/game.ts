import type { AudioFx } from './audio';
import type { ArcadeStorage } from './storage';
import type { InputService } from './input';

export interface GameMeta {
  id: string;
  name: string;
  icon: string;
  /** Upper-case English name for the hub; falls back to `name` */
  displayName?: string;
  /** Key hints in the cabinet's bottom bar, rendered separated by · */
  hints?: string[];
  /** Screen-well style: dark screen or paper board, default dark */
  screen?: 'dark' | 'paper';
  /** true to get a DOM row above the screen well; the game fills it */
  head?: boolean;
  /** true to get a side panel right of the screen well; the game fills it */
  side?: boolean;
  /** true to get a touch pad below the screen; the game fills it */
  pad?: boolean;
  /** Whether the top bar renders a pause button, default true. FLAPPY hides it per the mockups */
  pausable?: boolean;
  /** Extra buttons on the right of the top bar, placed before SND */
  tools?: { id: string; label: string; aria: string }[];
}

export interface OverlayAction {
  label: string;
  onPress: () => void;
  /** primary is the accent-filled main button, secondary is outlined. Default primary */
  kind?: 'primary' | 'secondary';
}

export interface OverlayView {
  /** Title text, e.g. GAME OVER / SOLVED! / SELECT DIFFICULTY */
  title: string;
  /** Picks the title colour: lose → magenta, win → teal, record → gold */
  tone: 'lose' | 'win' | 'record';
  /** Detail lines, rendered in the monospace font */
  lines: string[];
  /** One or more action buttons, stacked vertically in order */
  actions: OverlayAction[];
  /**
   * Bottom-bar key hints while the overlay is open, overriding whatever the game set
   * (`meta.hints` or the latest `ctx.setHints`). Omit to keep the current hints.
   */
  hints?: string[];
  /** Whether to show QUIT TO HUB, default true */
  quit?: boolean;
}

export interface GameContext {
  audio: AudioFx;
  storage: ArcadeStorage;
  input: InputService;
  /** Register a container-resize callback; returns the unsubscribe function */
  onResize(cb: () => void): () => void;
  /** Show or dismiss the overlay (start menu, result card); pass null to dismiss */
  overlay(view: OverlayView | null): void;
  /** Head-bar container; available when meta.head is true, otherwise null */
  head: HTMLElement | null;
  /** Side-panel container; available when meta.side is true, otherwise null */
  side: HTMLElement | null;
  /** Touch-pad container; available when meta.pad is true, otherwise null */
  pad: HTMLElement | null;
  /** Replace the bottom key-hint bar */
  setHints(hints: string[]): void;
  /** Register a click handler for a custom top-bar button; id must match one in meta.tools */
  onTool(id: string, handler: () => void): void;
  /** Set the pill next to the game name; pass null to hide it */
  setPill(text: string | null): void;
  /**
   * Whether an overlay is open. The frame is the only party that knows; games use it to
   * decide whether to swallow input — some want Space to restart while the result card is
   * up, others want a complete freeze while the start menu is up.
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
