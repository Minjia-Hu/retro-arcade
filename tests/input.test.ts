// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { swipeDirection, InputService } from '../src/core/input';

describe('swipeDirection', () => {
  it('movement below the threshold returns null', () => {
    expect(swipeDirection(10, 10)).toBeNull();
  });
  it('larger horizontal movement means left/right', () => {
    expect(swipeDirection(80, 20)).toBe('right');
    expect(swipeDirection(-80, 20)).toBe('left');
  });
  it('larger vertical movement means up/down', () => {
    expect(swipeDirection(20, 80)).toBe('down');
    expect(swipeDirection(20, -80)).toBe('up');
  });
});

function keydown(code: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { code, cancelable: true });
  window.dispatchEvent(e);
  return e;
}

describe('onKey', () => {
  it('arrows and Space prevent the default (or the page scrolls when the cabinet is taller than the viewport)', () => {
    const input = new InputService();
    input.onKey(() => {});
    expect(keydown('ArrowDown').defaultPrevented).toBe(true);
    expect(keydown('Space').defaultPrevented).toBe(true);
    input.dispose();
  });

  it('letter keys keep the default (browser shortcuts like Cmd+R must pass)', () => {
    const input = new InputService();
    input.onKey(() => {});
    expect(keydown('KeyR').defaultPrevented).toBe(false);
    input.dispose();
  });
});

describe('onBlur', () => {
  it('fires on window blur, not after dispose', () => {
    const input = new InputService();
    let hit = 0;
    input.onBlur(() => { hit += 1; });
    window.dispatchEvent(new Event('blur'));
    expect(hit).toBe(1);
    input.dispose();
    window.dispatchEvent(new Event('blur'));
    expect(hit).toBe(1);
  });
});
