// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { swipeDirection, InputService } from '../src/core/input';

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

function keydown(code: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { code, cancelable: true });
  window.dispatchEvent(e);
  return e;
}

describe('onKey', () => {
  it('方向键与空格阻止默认行为（否则机柜高于视口时页面会跟着滚）', () => {
    const input = new InputService();
    input.onKey(() => {});
    expect(keydown('ArrowDown').defaultPrevented).toBe(true);
    expect(keydown('Space').defaultPrevented).toBe(true);
    input.dispose();
  });

  it('字母键不阻止默认行为（Cmd+R 之类的浏览器快捷键要放行）', () => {
    const input = new InputService();
    input.onKey(() => {});
    expect(keydown('KeyR').defaultPrevented).toBe(false);
    input.dispose();
  });
});

describe('onBlur', () => {
  it('窗口失焦时触发，dispose 后不再触发', () => {
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
