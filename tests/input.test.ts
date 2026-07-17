import { describe, it, expect } from 'vitest';
import { swipeDirection } from '../src/core/input';

describe('swipeDirection', () => {
  it('位移小于阈值返回 null', () => {
    expect(swipeDirection(10, 10)).toBeNull();
  });
  it('水平位移大则判左右', () => {
    expect(swipeDirection(80, 20)).toBe('right');
    expect(swipeDirection(-80, 20)).toBe('left');
  });
  it('垂直位移大则判上下', () => {
    expect(swipeDirection(20, 80)).toBe('down');
    expect(swipeDirection(20, -80)).toBe('up');
  });
});
