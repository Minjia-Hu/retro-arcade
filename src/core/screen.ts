/**
 * 建立游戏画布并挂到容器上。
 *
 * 两个不显眼但要紧的约定：
 * - **只设 style.width，不设 height**：高度靠替换元素的内在比例推导，配合
 *   arcade.css 的 `.screen-body canvas { height: auto }`，窄屏才能等比缩小不溢出。
 *   显式设高会让缩放失效并撑破机柜。
 * - **dpr 上限 3**：再高只增显存不增观感。
 */
export function createScreenCanvas(
  host: HTMLElement,
  w: number,
  h: number,
): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  host.appendChild(canvas);
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  return { canvas, g };
}
