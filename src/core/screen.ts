/** dpr 上限 3：再高只增显存不增观感 */
const MAX_DPR = 3;

/**
 * 设定画布的显示尺寸与 backing store。
 *
 * **只设 style.width，不设 height**：高度靠替换元素的内在比例推导，配合 arcade.css 的
 * `.screen-body canvas { height: auto }`，窄屏才能等比缩小不溢出。显式设高会让缩放失效
 * 并撑破机柜。
 *
 * 用 `setTransform` 而非 `scale`：重设 canvas.width/height 会清空变换，叠加 scale 在
 * 反复调用时会累乘。
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

/** 建立游戏画布并挂到容器上。运行时要改尺寸的游戏之后再调 resizeScreenCanvas */
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
