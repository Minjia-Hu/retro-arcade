import { esc } from './escape';

export interface PadButton {
  id: string;
  label: string;
  aria: string;
  /** Extra class, e.g. pad-btn-digit / pad-btn-wide */
  variant?: string;
}

/**
 * Render a row of buttons into the touch pad (or one of its rows) and wire their clicks.
 * Every click blurs — same convention as the top-bar wire(), so a lingering focus can't make
 * Space hit both the button and the game.
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
