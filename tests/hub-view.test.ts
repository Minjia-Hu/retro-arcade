import { describe, it, expect } from 'vitest';
import css from '../src/styles/arcade.css?raw';
import { hubHtml } from '../src/shell/hub/view';
import type { HubModel } from '../src/shell/hub/model';

function model(patch: Partial<HubModel> = {}): HubModel {
  return {
    featured: {
      mode: 'continue', label: '◆ CONTINUE PLAYING ◆', button: 'PRESS START',
      id: 'tetris', name: 'TETRIS', accent: 'magenta', meta: 'YOUR BEST 012750 · LAST PLAYED 2H AGO',
    },
    daily: { dateLabel: 'DAILY CHALLENGE · SAT 05', prefix: 'CLEAR', name: 'MINES', suffix: 'IN UNDER 60 SECONDS', id: 'minesweeper' },
    hall: [
      { rank: '1', name: 'TETRIS', score: '012750', tone: 'gold' },
      { rank: '2', name: 'SNAKE', score: '003840', tone: 'dim' },
      { rank: '3', name: '— EMPTY —', score: '······', tone: 'faint' },
    ],
    cards: [
      { id: 'snake', name: 'SNAKE', accent: 'teal', pill: 'BEST 003840', hasRecord: true },
      { id: 'tetris', name: 'TETRIS', accent: 'magenta', pill: 'NO RECORD', hasRecord: false },
    ],
    footer: { games: '8 GAMES LOADED', muted: false, copyright: '© 2026 SUNSET ARCADE', repoUrl: 'https://example.com/repo' },
    ...patch,
  };
}

const count = (html: string, re: RegExp) => html.match(re)?.length ?? 0;

describe('navigation attribute split', () => {
  // e2e uses page.click('[data-id="flappy"]') and Playwright is in strict mode. If the hero
  // button also used data-id, it would collide only on the ~1/8 of days the date hash picks
  // that game — a flaky-by-date e2e. This pins the split without depending on date or browser.
  it('data-id appears only on grid cards', () => {
    const html = hubHtml(model());
    expect(count(html, /data-id=/g)).toBe(2); // equals the number of cards
    expect(count(html, /<button class="card /g)).toBe(2);
  });

  it('data-goto appears only on the two hero buttons', () => {
    const html = hubHtml(model());
    expect(count(html, /data-goto=/g)).toBe(2);
    expect(html).toContain('class="btn-start" data-goto="tetris"');
    expect(html).toContain('class="btn-accept" data-goto="minesweeper"');
  });

  it('the two attributes never land on the same element', () => {
    expect(hubHtml(model())).not.toMatch(/data-id="[^"]*"[^>]*data-goto=|data-goto="[^"]*"[^>]*data-id=/);
  });
});

describe('selectors e2e depends on', () => {
  it('keeps .hub-title and .card', () => {
    const html = hubHtml(model());
    expect(html).toContain('class="hub-title"');
    expect(count(html, /class="card accent-/g)).toBe(2);
  });

  it('cards are not disabled; all eight are enterable', () => {
    expect(hubHtml(model())).not.toContain('disabled');
  });
});

describe('accent is passed as a tone class; no hex in the view', () => {
  it('icons and pills take colour from a class, no inline colours', () => {
    const html = hubHtml(model());
    expect(html).toContain('class="card accent-teal"');
    expect(html).toContain('class="panel continue accent-magenta"');
    expect(html).not.toMatch(/style="(color|background):#/);
  });
});

describe('footer', () => {
  it('SOUND is a toggle button; label and aria-pressed follow muted', () => {
    const on = hubHtml(model());
    expect(on).toMatch(/<button class="hub-toggle" data-act="sound" aria-pressed="false">SOUND ON<\/button>/);
    const off = hubHtml(model({ footer: { games: '', muted: true, copyright: '', repoUrl: '' } }));
    expect(off).toMatch(/aria-pressed="true">SOUND OFF<\/button>/);
  });

  it('links to the repo in a new tab without leaking opener', () => {
    const html = hubHtml(model());
    expect(html).toMatch(/<a class="hub-link" href="https:\/\/example\.com\/repo" target="_blank" rel="noopener">SOURCE ON GITHUB/);
  });

  it('toggle and link styles exist in arcade.css', () => {
    expect(css).toMatch(/\.hub-toggle[^{]*\{/);
    expect(css).toMatch(/\.hub-link\s*\{[^}]*color:\s*var\(--orange\)/);
  });
});

describe('escaping', () => {
  it('HTML metacharacters in copy are escaped and cannot break structure', () => {
    const html = hubHtml(model({
      footer: { games: '<script>alert("x")</script> & co', muted: false, copyright: '', repoUrl: '' },
    }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co');
  });

  it('metacharacters in game names are escaped too', () => {
    const html = hubHtml(model({
      cards: [{ id: 'x', name: '<b>PWN</b>', accent: 'teal', pill: 'NO RECORD', hasRecord: false }],
    }));
    expect(html).toContain('&lt;b&gt;PWN&lt;/b&gt;');
  });
});

describe('daily challenge copy', () => {
  it('no stray space when suffix is empty', () => {
    const html = hubHtml(model({
      daily: { dateLabel: 'D', prefix: 'CLEAR 10 LINES IN', name: 'TETRIS', suffix: '', id: 'tetris' },
    }));
    expect(html).toContain('CLEAR 10 LINES IN <b>TETRIS</b></span>');
  });

  it('the game name is wrapped in <b> for highlighting', () => {
    expect(hubHtml(model())).toContain('CLEAR <b>MINES</b> IN UNDER 60 SECONDS');
  });
});

describe('tone names map to the stylesheet', () => {
  // TS passes tone names only; the values live in CSS. This guards against the two drifting
  // apart — the symptom is awkward: icons lose their colour and pills lose their fill.
  it('every AccentTone has a class in arcade.css', () => {
    for (const tone of ['teal', 'magenta', 'orange', 'gold']) {
      // Assert the mapping only, not whatever else the rule contains (the cabinet's --glow lives here)
      expect(css, `missing .accent-${tone}`).toMatch(
        new RegExp(`\\.accent-${tone}\\s*\\{[^}]*--accent:\\s*var\\(--${tone}\\)`),
      );
    }
  });

  it('every HallTone has a class in arcade.css', () => {
    for (const tone of ['gold', 'dim', 'faint']) {
      expect(css, `missing .hall-row-${tone}`).toMatch(new RegExp(`\\.hall-row-${tone}\\s*\\{`));
    }
  });
});
