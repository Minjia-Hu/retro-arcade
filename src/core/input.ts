export type SwipeDir = 'up' | 'down' | 'left' | 'right';

export function swipeDirection(dx: number, dy: number, threshold = 24): SwipeDir | null {
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

export class InputService {
  private disposers: (() => void)[] = [];

  onKey(handler: (code: string) => void): void {
    const fn = (e: KeyboardEvent) => handler(e.code);
    window.addEventListener('keydown', fn);
    this.disposers.push(() => window.removeEventListener('keydown', fn));
  }

  onTap(el: HTMLElement, handler: () => void): void {
    const fn = (e: PointerEvent) => { e.preventDefault(); handler(); };
    el.addEventListener('pointerdown', fn);
    this.disposers.push(() => el.removeEventListener('pointerdown', fn));
  }

  onSwipe(el: HTMLElement, handler: (dir: SwipeDir) => void): void {
    let sx = 0;
    let sy = 0;
    const down = (e: PointerEvent) => { sx = e.clientX; sy = e.clientY; };
    const up = (e: PointerEvent) => {
      const dir = swipeDirection(e.clientX - sx, e.clientY - sy);
      if (dir) handler(dir);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    this.disposers.push(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
    });
  }

  dispose(): void {
    this.disposers.forEach((d) => d());
    this.disposers = [];
  }
}
