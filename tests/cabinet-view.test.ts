import { describe, it, expect } from 'vitest';
import { cabinetHtml, hintsBarHtml, settleHtml } from '../src/shell/cabinet-view';
import type { GameMeta, SettleView } from '../src/core/game';

const snake: GameMeta = {
  id: 'snake', name: '贪吃蛇', icon: '🐍', displayName: 'SNAKE',
  hints: ['↑↓←→ / WASD MOVE', 'SPACE START'], screen: 'dark',
};

const settle: SettleView = {
  title: 'GAME OVER', tone: 'lose',
  lines: ['SCORE 0042', 'BEST 003840'],
  action: { label: '▶ RETRY', onPress: () => {} },
};

describe('cabinetHtml 顶栏', () => {
  it('三个操作按钮各一个', () => {
    const html = cabinetHtml(snake, false);
    for (const act of ['back', 'pause', 'mute']) {
      expect(html.match(new RegExp(`data-act="${act}"`, 'g'))!.length).toBe(1);
    }
  });

  it('优先用 displayName，缺省回退 name', () => {
    expect(cabinetHtml(snake, false)).toContain('>SNAKE<');
    expect(cabinetHtml({ id: 'x', name: '数独', icon: '✏️' }, false)).toContain('>数独<');
  });

  it('机柜根节点带该游戏的 accent 色调 class', () => {
    expect(cabinetHtml(snake, false)).toContain('class="cabinet accent-teal"');
    expect(cabinetHtml({ id: 'tetris', name: 'T', icon: 't' }, false)).toContain('accent-magenta');
  });

  it('静音时 SND 按钮带 is-off', () => {
    expect(cabinetHtml(snake, true)).toContain('class="cab-btn is-off" data-act="mute"');
    expect(cabinetHtml(snake, false)).toContain('class="cab-btn" data-act="mute"');
  });
});

describe('cabinetHtml 屏幕井', () => {
  it('游戏挂载点、玻璃层、浮层容器齐全', () => {
    const html = cabinetHtml(snake, false);
    expect(html).toContain('class="screen-body"');
    expect(html).toContain('class="screen-glass"');
    expect(html).toMatch(/class="settle"[^>]*\shidden/);
  });

  it('screen 风格由 meta 决定，缺省 dark', () => {
    expect(cabinetHtml(snake, false)).toContain('screen screen-dark');
    expect(cabinetHtml({ ...snake, screen: 'paper' }, false)).toContain('screen screen-paper');
    expect(cabinetHtml({ id: 'x', name: 'X', icon: 'x' }, false)).toContain('screen screen-dark');
  });
});

describe('cabinetHtml 无障碍', () => {
  it('SND 按钮用 aria-pressed 承载静音状态', () => {
    expect(cabinetHtml(snake, true)).toContain('aria-pressed="true"');
    expect(cabinetHtml(snake, false)).toContain('aria-pressed="false"');
  });

  it('浮层容器是 live region —— 刻意不自动聚焦，靠它播报结算结果', () => {
    const html = cabinetHtml(snake, false);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });
});

describe('hintsBarHtml', () => {
  it('多条用中点分隔', () => {
    expect(hintsBarHtml(['A', 'B'])).toBe(
      '<p class="cab-hints"><span>A</span><span class="cab-dot">·</span><span>B</span></p>',
    );
  });

  it('空数组返回空串，调用方据此不渲染该条', () => {
    expect(hintsBarHtml([])).toBe('');
  });

  it('提示文案被转义', () => {
    expect(hintsBarHtml(['<b>X</b>'])).toContain('&lt;b&gt;X&lt;/b&gt;');
  });
});

describe('cabinetHtml 按键提示', () => {
  it('多条提示用中点分隔', () => {
    const html = cabinetHtml(snake, false);
    expect(html).toContain('<span>↑↓←→ / WASD MOVE</span><span class="cab-dot">·</span><span>SPACE START</span>');
  });

  it('没有提示时不渲染提示条', () => {
    expect(cabinetHtml({ id: 'x', name: 'X', icon: 'x' }, false)).not.toContain('cab-hints');
  });
});

describe('settleHtml', () => {
  it('三种 tone 对应三种标题 class', () => {
    expect(settleHtml(settle)).toContain('settle-title settle-title-lose');
    expect(settleHtml({ ...settle, tone: 'win' })).toContain('settle-title-win');
    expect(settleHtml({ ...settle, tone: 'record' })).toContain('settle-title-record');
  });

  it('分数行逐行渲染', () => {
    const html = settleHtml(settle);
    expect(html.match(/class="settle-line"/g)!.length).toBe(2);
    expect(html).toContain('>SCORE 0042<');
    expect(html).toContain('>BEST 003840<');
  });

  it('两个按钮各带自己的 data-act', () => {
    const html = settleHtml(settle);
    expect(html).toContain('data-act="settle-action"');
    expect(html).toContain('data-act="settle-quit"');
    expect(html).toContain('>▶ RETRY<');
    expect(html).toContain('>QUIT TO HUB<');
  });
});

describe('转义', () => {
  it('机柜里的游戏名被转义', () => {
    expect(cabinetHtml({ id: 'x', name: '<b>PWN</b>', icon: 'x' }, false))
      .toContain('&lt;b&gt;PWN&lt;/b&gt;');
  });

  it('浮层里的标题与分数行被转义', () => {
    const html = settleHtml({ ...settle, title: '<script>x</script>', lines: ['A & B'] });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('A &amp; B');
  });
});

describe('cabinetHtml 可选暂停', () => {
  it('缺省渲染暂停按钮', () => {
    expect(cabinetHtml(snake, false)).toContain('data-act="pause"');
  });

  it('pausable 为 false 时不渲染暂停按钮', () => {
    const html = cabinetHtml({ ...snake, pausable: false }, false);
    expect(html).not.toContain('data-act="pause"');
    expect(html).toContain('data-act="mute"'); // 静音按钮仍在
  });
});

describe('cabinetHtml 插槽', () => {
  it('缺省不渲染侧栏与控制垫', () => {
    const html = cabinetHtml(snake, false);
    expect(html).not.toContain('cab-side');
    expect(html).not.toContain('cab-pad');
  });

  it('side 为 true 时在屏幕井里渲染空侧栏', () => {
    expect(cabinetHtml({ ...snake, side: true }, false)).toContain('<div class="cab-side"></div>');
  });

  it('pad 为 true 时在屏幕井之后渲染空控制垫', () => {
    expect(cabinetHtml({ ...snake, pad: true }, false)).toContain('<div class="cab-pad"></div>');
  });

  it('控制垫排在提示条之前', () => {
    const html = cabinetHtml({ ...snake, pad: true }, false);
    expect(html.indexOf('cab-pad')).toBeLessThan(html.indexOf('cab-hints'));
  });
});
