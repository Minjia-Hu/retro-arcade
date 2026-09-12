export type SwipeDir = 'up' | 'down' | 'left' | 'right';

export function swipeDirection(dx: number, dy: number, threshold = 24): SwipeDir | null {
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** Keys the games own: block the browser default, or arrows/Space scroll the page whenever the cabinet is taller than the viewport */
const GAME_KEYS = /^(Arrow(Up|Down|Left|Right)|Space)$/;

export class InputService {
  private disposers: (() => void)[] = [];

  /** Every on* method returns its own unsubscribe function; dispose() still clears everything */
  onKey(handler: (code: string) => void): () => void {
    const fn = (e: KeyboardEvent) => {
      if (GAME_KEYS.test(e.code)) e.preventDefault();
      handler(e.code);
    };
    window.addEventListener('keydown', fn);
    return this.track(() => window.removeEventListener('keydown', fn));
  }

  /**
   * Window blur. Cmd+Tab away while holding an arrow key and the keyup never arrives — games
   * that drive their own key repeat from held flags (TETRIS / BREAKOUT) must reset them here,
   * or the piece keeps sliding on its own after you come back.
   */
  onBlur(handler: () => void): () => void {
    const fn = () => handler();
    window.addEventListener('blur', fn);
    return this.track(() => window.removeEventListener('blur', fn));
  }

  onTap(el: HTMLElement, handler: () => void): () => void {
    const fn = (e: PointerEvent) => { e.preventDefault(); handler(); };
    el.addEventListener('pointerdown', fn);
    return this.track(() => el.removeEventListener('pointerdown', fn));
  }

  onSwipe(el: HTMLElement, handler: (dir: SwipeDir) => void): () => void {
    let sx = 0;
    let sy = 0;
    let tracking = false;
    const down = (e: PointerEvent) => {
      tracking = true;
      sx = e.clientX;
      sy = e.clientY;
      el.setPointerCapture?.(e.pointerId); // still receive the up when the finger leaves the element
    };
    const up = (e: PointerEvent) => {
      if (!tracking) return; // an up without a matching down would compute a bogus swipe from sx=0,sy=0
      tracking = false;
      const dir = swipeDirection(e.clientX - sx, e.clientY - sy);
      if (dir) handler(dir);
    };
    const cancel = () => {
      tracking = false;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    return this.track(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    });
  }

  /**
   * A tap is a press and release in place (movement < 10px, mutually exclusive with a swipe;
   * 10–24px is a dead band — the two thresholds must never overlap). The callback receives
   * element-relative coordinates in CSS pixels.
   * Do not attach together with onTap on the same element: onTap fires on pointerdown, so both would fire.
   */
  onTapAt(el: HTMLElement, handler: (x: number, y: number) => void): () => void {
    let sx = 0;
    let sy = 0;
    let tracking = false;
    const down = (e: PointerEvent) => {
      tracking = true;
      sx = e.clientX;
      sy = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (!tracking) return;
      tracking = false;
      if (Math.abs(e.clientX - sx) >= 10 || Math.abs(e.clientY - sy) >= 10) return;
      const rect = el.getBoundingClientRect();
      handler(e.clientX - rect.left, e.clientY - rect.top);
    };
    const cancel = () => {
      tracking = false;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    return this.track(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    });
  }

  /** Key up (pairs with onKey for hold-to-move controls) */
  onKeyUp(handler: (code: string) => void): () => void {
    const fn = (e: KeyboardEvent) => handler(e.code);
    window.addEventListener('keyup', fn);
    return this.track(() => window.removeEventListener('keyup', fn));
  }

  /**
   * Press-and-drag: after pointerdown, every move reports the horizontal delta dx (CSS px)
   * between consecutive pointer events. Reporting deltas rather than absolute positions means
   * a tap never makes the controlled object jump; can share an element with onTapAt.
   * Tracks only the first pointer down (filtered by pointerId, so multi-touch doesn't interfere).
   * Precondition: the consumer sets touch-action: none on the element, or touch drags scroll the page.
   */
  onDrag(el: HTMLElement, handler: (dx: number) => void): () => void {
    let lastX = 0;
    let dragging = false;
    let pid = -1;
    const down = (e: PointerEvent) => {
      if (dragging) return; // a pointer is already dragging; ignore later fingers
      dragging = true;
      pid = e.pointerId;
      lastX = e.clientX;
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pid) return;
      handler(e.clientX - lastX);
      lastX = e.clientX;
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId === pid) dragging = false;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    return this.track(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
    });
  }

  /**
   * Combined press gesture, three in one:
   * - tap: fires on a short press released in place (movement < 10px);
   * - long: fires after 450ms held without moving or releasing; that gesture then reports no tap;
   * - right: fires on a desktop right-click and suppresses the system context menu.
   * Coordinates are element-relative CSS pixels. Tracks only the first pointer down.
   * Do not attach together with onTap/onTapAt on the same element (double firing).
   * Precondition: the consumer sets touch-action: none on the element.
   */
  onPress(
    el: HTMLElement,
    h: { tap?: (x: number, y: number) => void; long?: (x: number, y: number) => void; right?: (x: number, y: number) => void },
  ): () => void {
    let sx = 0;
    let sy = 0;
    let pid = -1;
    let timer = 0;
    let tracking = false;
    let longFired = false;
    let moved = false;
    const rel = (clientX: number, clientY: number): [number, number] => {
      const r = el.getBoundingClientRect();
      return [clientX - r.left, clientY - r.top];
    };
    const clear = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = 0;
      }
    };
    const down = (e: PointerEvent) => {
      if (tracking || e.button !== 0) return;
      tracking = true;
      longFired = false;
      moved = false;
      pid = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      el.setPointerCapture?.(e.pointerId);
      if (h.long) {
        timer = window.setTimeout(() => {
          timer = 0;
          if (tracking && !moved) {
            longFired = true;
            h.long!(...rel(sx, sy));
          }
        }, 450);
      }
    };
    const move = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pid) return;
      if (Math.abs(e.clientX - sx) >= 10 || Math.abs(e.clientY - sy) >= 10) {
        moved = true;
        clear();
      }
    };
    const up = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pid) return;
      tracking = false;
      clear();
      if (!longFired && !moved) h.tap?.(...rel(e.clientX, e.clientY));
      longFired = false; // mouse path resets here; the touch-cancel path keeps it true to block the synthetic contextmenu that follows
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      tracking = false;
      clear();
      // Do not reset longFired here: Android's long-press sequence is down → cancel → contextmenu,
      // and longFired has to survive until the contextmenu guard
    };
    const ctxMenu = (e: MouseEvent) => {
      e.preventDefault();
      // Android Chrome/Firefox dispatch a synthetic contextmenu on touch long-press; the 450ms timer
      // has already reported long, so swallow it to avoid long+right double firing (two flag toggles = no-op)
      if (tracking || longFired) return;
      h.right?.(...rel(e.clientX, e.clientY));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('contextmenu', ctxMenu);
    return this.track(() => {
      clear();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('contextmenu', ctxMenu);
    });
  }

  dispose(): void {
    this.disposers.forEach((d) => d());
    this.disposers = [];
  }

  private track(off: () => void): () => void {
    this.disposers.push(off);
    return off;
  }
}
