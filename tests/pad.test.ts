// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { padButtons } from '../src/shell/pad';

const host = () => document.createElement('div');

describe('padButtons', () => {
  it('renders one button per definition, with aria and optional variant', () => {
    const el = host();
    padButtons(el, [
      { id: 'a', label: 'A', aria: 'Alpha' },
      { id: 'b', label: 'B', aria: 'Beta', variant: 'pad-btn-wide' },
    ], () => {});
    const btns = el.querySelectorAll('button');
    expect(btns).toHaveLength(2);
    expect(btns[0].className).toBe('pad-btn');
    expect(btns[0].getAttribute('aria-label')).toBe('Alpha');
    expect(btns[1].className).toBe('pad-btn pad-btn-wide');
  });

  it('click reports the id', () => {
    const el = host();
    const hit: string[] = [];
    padButtons(el, [{ id: 'x', label: 'X', aria: 'X' }], (id) => hit.push(id));
    el.querySelector('button')!.click();
    expect(hit).toEqual(['x']);
  });

  it('blurs after click — same convention as the top-bar wire()', () => {
    const el = host();
    document.body.appendChild(el);
    padButtons(el, [{ id: 'x', label: 'X', aria: 'X' }], () => {});
    const b = el.querySelector('button')!;
    b.focus();
    expect(document.activeElement).toBe(b);
    b.click();
    expect(document.activeElement).not.toBe(b);
  });

  it('labels are escaped', () => {
    const el = host();
    padButtons(el, [{ id: 'x', label: '<b>X</b>', aria: 'X' }], () => {});
    expect(el.innerHTML).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(el.querySelector('b')).toBeNull();
  });
});
