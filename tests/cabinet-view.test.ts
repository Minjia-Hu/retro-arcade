import { describe, it, expect } from 'vitest';
import { cabinetHtml, hintsBarHtml, overlayHtml } from '../src/shell/cabinet-view';
import type { GameMeta, OverlayView } from '../src/core/game';

const snake: GameMeta = {
  id: 'snake', name: 'Snake', icon: '🐍', displayName: 'SNAKE',
  hints: ['↑↓←→ / WASD MOVE', 'SPACE START'], screen: 'dark',
};

const settle: OverlayView = {
  title: 'GAME OVER', tone: 'lose',
  lines: ['SCORE 0042', 'BEST 003840'],
  actions: [{ label: '▶ RETRY', onPress: () => {} }],
};

describe('cabinetHtml top bar', () => {
  it('one of each of the three action buttons', () => {
    const html = cabinetHtml(snake, false);
    for (const act of ['back', 'pause', 'mute']) {
      expect(html.match(new RegExp(`data-act="${act}"`, 'g'))!.length).toBe(1);
    }
  });

  it('prefers displayName, falls back to name', () => {
    expect(cabinetHtml(snake, false)).toContain('>SNAKE<');
    expect(cabinetHtml({ id: 'x', name: 'Sudoku', icon: '✏️' }, false)).toContain('>Sudoku<');
  });

  it('the cabinet root carries the game\'s accent tone class', () => {
    expect(cabinetHtml(snake, false)).toContain('class="cabinet accent-teal"');
    expect(cabinetHtml({ id: 'tetris', name: 'T', icon: 't' }, false)).toContain('accent-magenta');
  });

  it('SND carries is-off while muted', () => {
    expect(cabinetHtml(snake, true)).toContain('class="cab-btn is-off" data-act="mute"');
    expect(cabinetHtml(snake, false)).toContain('class="cab-btn" data-act="mute"');
  });
});

describe('cabinetHtml screen well', () => {
  it('mount point, glass layer and overlay container are all present', () => {
    const html = cabinetHtml(snake, false);
    expect(html).toContain('class="screen-body"');
    expect(html).toContain('class="screen-glass"');
    expect(html).toMatch(/class="settle"[^>]*\shidden/);
  });

  it('screen style comes from meta, default dark', () => {
    expect(cabinetHtml(snake, false)).toContain('screen screen-dark');
    expect(cabinetHtml({ ...snake, screen: 'paper' }, false)).toContain('screen screen-paper');
    expect(cabinetHtml({ id: 'x', name: 'X', icon: 'x' }, false)).toContain('screen screen-dark');
  });
});

describe('cabinetHtml accessibility', () => {
  it('SND exposes the mute state via aria-pressed', () => {
    expect(cabinetHtml(snake, true)).toContain('aria-pressed="true"');
    expect(cabinetHtml(snake, false)).toContain('aria-pressed="false"');
  });

  it('the overlay container is a live region — deliberately not auto-focused; it announces the result', () => {
    const html = cabinetHtml(snake, false);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });
});

describe('hintsBarHtml', () => {
  it('multiple entries are separated by a middle dot', () => {
    expect(hintsBarHtml(['A', 'B'])).toBe(
      '<p class="cab-hints"><span>A</span><span class="cab-dot">·</span><span>B</span></p>',
    );
  });

  it('an empty array returns \'\', so the caller skips the bar', () => {
    expect(hintsBarHtml([])).toBe('');
  });

  it('hint text is escaped', () => {
    expect(hintsBarHtml(['<b>X</b>'])).toContain('&lt;b&gt;X&lt;/b&gt;');
  });
});

describe('cabinetHtml key hints', () => {
  it('multiple hints are separated by a middle dot', () => {
    const html = cabinetHtml(snake, false);
    expect(html).toContain('<span>↑↓←→ / WASD MOVE</span><span class="cab-dot">·</span><span>SPACE START</span>');
  });

  it('no hint bar without hints', () => {
    expect(cabinetHtml({ id: 'x', name: 'X', icon: 'x' }, false)).not.toContain('cab-hints');
  });
});

describe('overlayHtml', () => {
  it('three tones map to three title classes', () => {
    expect(overlayHtml(settle)).toContain('settle-title settle-title-lose');
    expect(overlayHtml({ ...settle, tone: 'win' })).toContain('settle-title-win');
    expect(overlayHtml({ ...settle, tone: 'record' })).toContain('settle-title-record');
  });

  it('score lines render one per line', () => {
    const html = overlayHtml(settle);
    expect(html.match(/class="settle-line"/g)!.length).toBe(2);
    expect(html).toContain('>SCORE 0042<');
    expect(html).toContain('>BEST 003840<');
  });

  it('both buttons carry their own data-act', () => {
    const html = overlayHtml(settle);
    expect(html).toContain('data-act="overlay:0"');
    expect(html).toContain('data-act="overlay-quit"');
    expect(html).toContain('>▶ RETRY<');
    expect(html).toContain('>QUIT TO HUB<');
  });
});

describe('overlayHtml multiple actions', () => {
  const menu: OverlayView = {
    title: 'SELECT DIFFICULTY', tone: 'win', lines: [],
    actions: [
      { label: 'EASY', onPress: () => {}, kind: 'secondary' },
      { label: 'MEDIUM', onPress: () => {}, kind: 'secondary' },
      { label: 'HARD', onPress: () => {}, kind: 'secondary' },
    ],
  };

  it('one button per action, addressed by index', () => {
    const html = overlayHtml(menu);
    // Match the <button class="settle-action prefix rather than a bare class="settle-action,
    // or the outer container's class="settle-actions" (plural) is counted too
    expect(html.match(/<button class="settle-action/g)!.length).toBe(3);
    for (const i of [0, 1, 2]) expect(html).toContain(`data-act="overlay:${i}"`);
    expect(html).toContain('>EASY<');
    expect(html).toContain('>HARD<');
  });

  it('kind picks primary/secondary styling, default primary', () => {
    expect(overlayHtml(menu)).toContain('settle-action settle-action-secondary');
    expect(overlayHtml({ ...menu, actions: [{ label: 'GO', onPress: () => {} }] }))
      .toContain('class="settle-action" data-act="overlay:0"');
  });

  it('quit: false omits QUIT TO HUB', () => {
    expect(overlayHtml({ ...menu, quit: false })).not.toContain('overlay-quit');
    expect(overlayHtml(menu)).toContain('overlay-quit');
  });
});

describe('escaping', () => {
  it('the game name in the cabinet is escaped', () => {
    expect(cabinetHtml({ id: 'x', name: '<b>PWN</b>', icon: 'x' }, false))
      .toContain('&lt;b&gt;PWN&lt;/b&gt;');
  });

  it('overlay title and score lines are escaped', () => {
    const html = overlayHtml({ ...settle, title: '<script>x</script>', lines: ['A & B'] });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('A &amp; B');
  });
});

describe('cabinetHtml optional pause', () => {
  it('renders the pause button by default', () => {
    expect(cabinetHtml(snake, false)).toContain('data-act="pause"');
  });

  it('pausable: false omits the pause button', () => {
    const html = cabinetHtml({ ...snake, pausable: false }, false);
    expect(html).not.toContain('data-act="pause"');
    expect(html).toContain('data-act="mute"'); // the mute button stays
  });
});

describe('cabinetHtml slots', () => {
  it('no side panel or pad by default', () => {
    const html = cabinetHtml(snake, false);
    expect(html).not.toContain('cab-side');
    expect(html).not.toContain('cab-pad');
  });

  it('side: true renders an empty side panel inside the screen well', () => {
    expect(cabinetHtml({ ...snake, side: true }, false)).toContain('<div class="cab-side"></div>');
  });

  it('pad: true renders an empty pad after the screen well', () => {
    expect(cabinetHtml({ ...snake, pad: true }, false)).toContain('<div class="cab-pad"></div>');
  });

  it('the pad comes before the hint bar', () => {
    const html = cabinetHtml({ ...snake, pad: true }, false);
    // Confirm both exist first: a missing one makes indexOf return -1 and the assertion meaningless
    const pad = html.indexOf('cab-pad');
    const hints = html.indexOf('cab-hints');
    expect(pad).toBeGreaterThan(-1);
    expect(hints).toBeGreaterThan(-1);
    expect(pad).toBeLessThan(hints);
  });

  it('the side panel sits inside the screen well, before the pad', () => {
    const html = cabinetHtml({ ...snake, side: true, pad: true }, false);
    const screen = html.indexOf('class="screen ');
    const side = html.indexOf('cab-side');
    const pad = html.indexOf('cab-pad');
    expect(screen).toBeGreaterThan(-1);
    expect(side).toBeGreaterThan(screen);
    expect(pad).toBeGreaterThan(side);
  });
});

describe('cabinetHtml head bar', () => {
  it('no head bar by default, but the stack is always there', () => {
    const html = cabinetHtml(snake, false);
    expect(html).not.toContain('cab-head');
    expect(html).toContain('class="cab-stack"');
  });

  it('head: true renders an empty head bar', () => {
    expect(cabinetHtml({ ...snake, head: true }, false)).toContain('<div class="cab-head"></div>');
  });

  it('the head bar comes before the screen and outside the side panel', () => {
    const html = cabinetHtml({ ...snake, head: true, side: true }, false);
    const head = html.indexOf('cab-head');
    const screen = html.indexOf('class="screen ');
    const side = html.indexOf('cab-side');
    expect(head).toBeGreaterThan(-1);
    expect(head).toBeLessThan(screen);
    expect(screen).toBeLessThan(side);
  });
});

describe('cabinetHtml tool buttons and pill', () => {
  const withTool = {
    ...snake,
    tools: [{ id: 'menu', label: '☰', aria: 'Difficulty menu' }],
  };

  it('tool buttons use the tool: prefix, clear of the back/pause/mute namespace', () => {
    const html = cabinetHtml(withTool, false);
    expect(html).toContain('data-act="tool:menu"');
    expect(html).toContain('>☰<');
  });

  it('tool buttons come before SND', () => {
    const html = cabinetHtml(withTool, false);
    expect(html.indexOf('tool:menu')).toBeLessThan(html.indexOf('data-act="mute"'));
  });

  it('no tool buttons by default; the pill renders hidden', () => {
    const html = cabinetHtml(snake, false);
    expect(html).not.toContain('data-act="tool:');
    // The pill is always rendered and toggled via hidden, so setPill never inserts a node
    expect(html).toMatch(/class="cab-pill"[^>]*\shidden/);
  });

  it('the pill renders after the game name, hidden at first (content only comes from ctx.setPill)', () => {
    const html = cabinetHtml(withTool, false);
    expect(html.indexOf('cab-name')).toBeLessThan(html.indexOf('cab-pill'));
    expect(html).toContain('hidden></span>');
  });

  it('tool buttons and pausable:false can coexist', () => {
    const html = cabinetHtml({ ...withTool, pausable: false }, false);
    expect(html).not.toContain('data-act="pause"');
    expect(html).toContain('data-act="tool:menu"');
    expect(html).toContain('data-act="mute"');
  });
});
