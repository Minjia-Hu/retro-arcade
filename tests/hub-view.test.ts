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
    footer: '8 GAMES LOADED · SOUND ON · © 2026 SUNSET ARCADE',
    ...patch,
  };
}

const count = (html: string, re: RegExp) => html.match(re)?.length ?? 0;

describe('导航属性的分工', () => {
  // e2e 用 page.click('[data-id="flappy"]')，Playwright 是 strict mode。
  // 若 hero 按钮也用 data-id，只在该游戏恰好被日期哈希选中的那 ~1/8 天才会撞车，
  // e2e 会变成按日期偶发失败。这里用不依赖日期、不依赖浏览器的断言钉死分工。
  it('data-id 只出现在网格卡片上', () => {
    const html = hubHtml(model());
    expect(count(html, /data-id=/g)).toBe(2); // 等于 cards 数量
    expect(count(html, /<button class="card /g)).toBe(2);
  });

  it('data-goto 只出现在 hero 的两个按钮上', () => {
    const html = hubHtml(model());
    expect(count(html, /data-goto=/g)).toBe(2);
    expect(html).toContain('class="btn-start" data-goto="tetris"');
    expect(html).toContain('class="btn-accept" data-goto="minesweeper"');
  });

  it('两组属性不会落在同一个元素上', () => {
    expect(hubHtml(model())).not.toMatch(/data-id="[^"]*"[^>]*data-goto=|data-goto="[^"]*"[^>]*data-id=/);
  });
});

describe('e2e 依赖的选择器', () => {
  it('保留 .hub-title 与 .card', () => {
    const html = hubHtml(model());
    expect(html).toContain('class="hub-title"');
    expect(count(html, /class="card accent-/g)).toBe(2);
  });

  it('卡片不带 disabled，八张都可进入', () => {
    expect(hubHtml(model())).not.toContain('disabled');
  });
});

describe('accent 以色调 class 下发，视图里没有 hex', () => {
  it('图标与药丸靠 class 取色，不写内联颜色', () => {
    const html = hubHtml(model());
    expect(html).toContain('class="card accent-teal"');
    expect(html).toContain('class="panel continue accent-magenta"');
    expect(html).not.toMatch(/style="(color|background):#/);
  });
});

describe('转义', () => {
  it('文案里的 HTML 元字符被转义，不会破坏结构', () => {
    const html = hubHtml(model({ footer: '<script>alert("x")</script> & co' }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co');
  });

  it('游戏名里的元字符同样被转义', () => {
    const html = hubHtml(model({
      cards: [{ id: 'x', name: '<b>PWN</b>', accent: 'teal', pill: 'NO RECORD', hasRecord: false }],
    }));
    expect(html).toContain('&lt;b&gt;PWN&lt;/b&gt;');
  });
});

describe('每日挑战文案拼接', () => {
  it('suffix 为空时不留多余空格', () => {
    const html = hubHtml(model({
      daily: { dateLabel: 'D', prefix: 'CLEAR 10 LINES IN', name: 'TETRIS', suffix: '', id: 'tetris' },
    }));
    expect(html).toContain('CLEAR 10 LINES IN <b>TETRIS</b></span>');
  });

  it('游戏名被 <b> 包住以便高亮', () => {
    expect(hubHtml(model())).toContain('CLEAR <b>MINES</b> IN UNDER 60 SECONDS');
  });
});

describe('色调名与样式表的对应', () => {
  // TS 只传色调名，色值全在 CSS。这条断言防止两边命名漂移——
  // 漂移的表现会很别扭：图标没颜色，药丸底色也丢了。
  it('每个 AccentTone 在 arcade.css 里都有对应的 class', () => {
    for (const tone of ['teal', 'magenta', 'orange', 'gold']) {
      // 只断言映射关系，不锁死同一条规则里还写了什么（机柜的 --glow 就写在这里）
      expect(css, `缺少 .accent-${tone}`).toMatch(
        new RegExp(`\\.accent-${tone}\\s*\\{[^}]*--accent:\\s*var\\(--${tone}\\)`),
      );
    }
  });

  it('每个 HallTone 在 arcade.css 里都有对应的 class', () => {
    for (const tone of ['gold', 'dim', 'faint']) {
      expect(css, `缺少 .hall-row-${tone}`).toMatch(new RegExp(`\\.hall-row-${tone}\\s*\\{`));
    }
  });
});
