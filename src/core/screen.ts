/** DPR capped at 3: beyond that it only costs memory, not sharpness */
const MAX_DPR = 3;

/**
 * Set the canvas's display size and backing store.
 *
 * **Set style.width only, never height**: height follows the replaced element's intrinsic ratio,
 * which together with `.screen-body canvas { height: auto }` in arcade.css is what lets narrow
 * screens scale the canvas down without overflowing. An explicit height breaks that scaling
 * and bursts the cabinet.
 *
 * `setTransform` rather than `scale`: resetting canvas.width/height clears the transform, and a
 * stacked scale would multiply up on repeated calls.
 */
export function resizeScreenCanvas(
  canvas: HTMLCanvasElement,
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Create the game canvas and mount it. Games that change size at runtime call resizeScreenCanvas afterwards */
export function createScreenCanvas(
  host: HTMLElement,
  w: number,
  h: number,
): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  host.appendChild(canvas);
  const g = canvas.getContext('2d')!;
  resizeScreenCanvas(canvas, g, w, h);
  return { canvas, g };
}
