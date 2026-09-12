import { describe, it, expect } from 'vitest';
import { pixelIconSvg, PIXELS } from '../src/shell/pixel-icons';
import { GAMES } from '../src/games/registry';

describe('pixelIconSvg', () => {
  it('every game id in the registry has pixel data', () => {
    for (const g of GAMES) {
      expect(PIXELS[g.meta.id], `missing pixel data for ${g.meta.id}`).toBeDefined();
      expect(PIXELS[g.meta.id].length).toBeGreaterThan(0);
    }
  });

  it('all pixel coordinates fall inside the 8x8 grid (0..7)', () => {
    for (const cells of Object.values(PIXELS)) {
      for (const [x, y] of cells) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(7);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(7);
      }
    }
  });

  it('renders an SVG with viewBox 8x8 and fill currentColor', () => {
    const svg = pixelIconSvg('snake');
    expect(svg).toContain('viewBox="0 0 8 8"');
    expect(svg).toContain('fill="currentColor"');
    expect(svg.match(/<rect /g)!.length).toBe(PIXELS.snake.length);
  });

  it('an unknown id returns an empty SVG instead of throwing', () => {
    const svg = pixelIconSvg('nope');
    expect(svg).toContain('viewBox="0 0 8 8"');
    expect(svg).not.toContain('<rect');
  });
});
