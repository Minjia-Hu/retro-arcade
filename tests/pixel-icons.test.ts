import { describe, it, expect } from 'vitest';
import { pixelIconSvg, PIXELS } from '../src/shell/pixel-icons';
import { GAMES } from '../src/games/registry';

describe('pixelIconSvg', () => {
  it('registry 里每个游戏 id 都有像素数据', () => {
    for (const g of GAMES) {
      expect(PIXELS[g.meta.id], `缺少 ${g.meta.id} 的像素数据`).toBeDefined();
      expect(PIXELS[g.meta.id].length).toBeGreaterThan(0);
    }
  });

  it('所有像素坐标都落在 0..7 的 8x8 网格内', () => {
    for (const cells of Object.values(PIXELS)) {
      for (const [x, y] of cells) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(7);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(7);
      }
    }
  });

  it('渲染成 viewBox 8x8、fill 跟随 currentColor 的 SVG', () => {
    const svg = pixelIconSvg('snake');
    expect(svg).toContain('viewBox="0 0 8 8"');
    expect(svg).toContain('fill="currentColor"');
    expect(svg.match(/<rect /g)!.length).toBe(PIXELS.snake.length);
  });

  it('未知 id 返回空 SVG 而不是抛错', () => {
    const svg = pixelIconSvg('nope');
    expect(svg).toContain('viewBox="0 0 8 8"');
    expect(svg).not.toContain('<rect');
  });
});
