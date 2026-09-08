// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { padButtons } from '../src/shell/pad';

const host = () => document.createElement('div');

describe('padButtons', () => {
  it('每个定义渲染一个按钮，带 aria 与可选 variant', () => {
    const el = host();
    padButtons(el, [
      { id: 'a', label: 'A', aria: '甲' },
      { id: 'b', label: 'B', aria: '乙', variant: 'pad-btn-wide' },
    ], () => {});
    const btns = el.querySelectorAll('button');
    expect(btns).toHaveLength(2);
    expect(btns[0].className).toBe('pad-btn');
    expect(btns[0].getAttribute('aria-label')).toBe('甲');
    expect(btns[1].className).toBe('pad-btn pad-btn-wide');
  });

  it('点击回传 id', () => {
    const el = host();
    const hit: string[] = [];
    padButtons(el, [{ id: 'x', label: 'X', aria: 'X' }], (id) => hit.push(id));
    el.querySelector('button')!.click();
    expect(hit).toEqual(['x']);
  });

  it('点完就 blur —— 与顶栏 wire() 同一约定', () => {
    const el = host();
    document.body.appendChild(el);
    padButtons(el, [{ id: 'x', label: 'X', aria: 'X' }], () => {});
    const b = el.querySelector('button')!;
    b.focus();
    expect(document.activeElement).toBe(b);
    b.click();
    expect(document.activeElement).not.toBe(b);
  });

  it('标签会被转义', () => {
    const el = host();
    padButtons(el, [{ id: 'x', label: '<b>X</b>', aria: 'X' }], () => {});
    expect(el.innerHTML).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(el.querySelector('b')).toBeNull();
  });
});
