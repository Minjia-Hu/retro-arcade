export type SwipeDir = 'up' | 'down' | 'left' | 'right';

export function swipeDirection(dx: number, dy: number, threshold = 24): SwipeDir | null {
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

export class InputService {
  private disposers: (() => void)[] = [];

  /** 各 on* 方法均返回单独的解绑函数；dispose() 仍可整体清理 */
  onKey(handler: (code: string) => void): () => void {
    const fn = (e: KeyboardEvent) => handler(e.code);
    window.addEventListener('keydown', fn);
    return this.track(() => window.removeEventListener('keydown', fn));
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
      el.setPointerCapture?.(e.pointerId); // 手指滑出元素外也能收到 up
    };
    const up = (e: PointerEvent) => {
      if (!tracking) return; // 无配对 down 的 up 会用 sx=0,sy=0 算出伪滑动
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
   * 原地按下并抬起才算点按（位移 < 10px，与滑动互斥；10–24px 为无操作缓冲带，
   * 两个阈值不可改到重叠）。回调收到元素内相对坐标（CSS 像素）。
   * 注意：不要与 onTap 共挂同一元素（onTap 在 pointerdown 即触发，会双触发）。
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

  /** 键盘抬起（与 onKey 配对，用于按住式控制） */
  onKeyUp(handler: (code: string) => void): () => void {
    const fn = (e: KeyboardEvent) => handler(e.code);
    window.addEventListener('keyup', fn);
    return this.track(() => window.removeEventListener('keyup', fn));
  }

  /**
   * 按住拖动：pointerdown 后每次移动回调相邻两次指针事件的水平位移 dx（CSS 像素）。
   * 报告相对位移而非绝对坐标，点按不会令被控对象跳位；可与 onTapAt 共挂。
   */
  onDrag(el: HTMLElement, handler: (dx: number) => void): () => void {
    let lastX = 0;
    let dragging = false;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      handler(e.clientX - lastX);
      lastX = e.clientX;
    };
    const end = () => {
      dragging = false;
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

  dispose(): void {
    this.disposers.forEach((d) => d());
    this.disposers = [];
  }

  private track(off: () => void): () => void {
    this.disposers.push(off);
    return off;
  }
}
