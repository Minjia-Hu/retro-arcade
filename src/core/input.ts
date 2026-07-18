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

  /** 原地按下并抬起才算点按（位移 < 10px，与滑动互斥）；回调收到元素内相对坐标（CSS 像素） */
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

  dispose(): void {
    this.disposers.forEach((d) => d());
    this.disposers = [];
  }

  private track(off: () => void): () => void {
    this.disposers.push(off);
    return off;
  }
}
