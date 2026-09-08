import { esc } from './escape';

export interface PadButton {
  id: string;
  label: string;
  aria: string;
  /** 额外 class，如 pad-btn-digit / pad-btn-wide */
  variant?: string;
}

/**
 * 在控制垫（或其中一行）里渲染一排按钮并接上点击。
 * 点完统一 blur——与顶栏 wire() 同一约定，避免残留焦点让空格键既触发按钮又触发游戏逻辑。
 */
export function padButtons(
  host: HTMLElement,
  buttons: PadButton[],
  onPress: (id: string) => void,
): void {
  host.innerHTML = buttons
    .map((b) => `<button class="pad-btn${b.variant ? ` ${b.variant}` : ''}" data-pad="${esc(b.id)}" aria-label="${esc(b.aria)}">${esc(b.label)}</button>`)
    .join('');
  host.querySelectorAll<HTMLButtonElement>('[data-pad]').forEach((el) => {
    el.addEventListener('click', () => {
      el.blur();
      onPress(el.dataset.pad!);
    });
  });
}
