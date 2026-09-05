import { describe, it, expect } from 'vitest';
import { THEME } from '../src/core/theme';
import { GAMES } from '../src/games/registry';
import { padScore, accentAt, relativeTime, dateKey, hashDate } from '../src/shell/hub/model';
import { ArcadeStorage, memoryBackend } from '../src/core/storage';
import { buildHall } from '../src/shell/hub/model';
import { buildDaily, CHALLENGES } from '../src/shell/hub/model';
import { buildFeatured, buildCards, buildHubModel } from '../src/shell/hub/model';

describe('THEME 守卫', () => {
  // THEME 被 8 个游戏的 canvas 渲染引用 163 次，首页重设计期间一个键都不许动
  it('不破坏游戏画布使用的 THEME', () => {
    expect(THEME).toEqual({
      bg: '#0d0d16',
      panel: '#16121f',
      text: '#e8e6ff',
      dim: '#665f7a',
      neonGreen: '#39ff14',
      neonPink: '#ff2fd6',
      neonCyan: '#00e5ff',
      neonYellow: '#ffe600',
      font: "'Courier New', ui-monospace, monospace",
    });
  });
});

describe('registry displayName', () => {
  it('八个游戏都有英文大写展示名', () => {
    expect(GAMES.map((g) => g.meta.displayName)).toEqual([
      'SNAKE', 'TETRIS', 'BREAKOUT', 'FLAPPY', '2048', 'MINES', 'SUDOKU', 'GOMOKU',
    ]);
  });
});

describe('padScore', () => {
  it('默认补到 6 位', () => {
    expect(padScore(0)).toBe('000000');
    expect(padScore(12750)).toBe('012750');
  });

  it('超过位数时不截断', () => {
    expect(padScore(1234567)).toBe('1234567');
  });

  it('负数和小数向下取整到非负整数', () => {
    expect(padScore(-5)).toBe('000000');
    expect(padScore(47.9)).toBe('000047');
  });
});

describe('accentAt', () => {
  it('四色调轮转', () => {
    expect(accentAt(0)).toBe('teal');
    expect(accentAt(1)).toBe('magenta');
    expect(accentAt(2)).toBe('orange');
    expect(accentAt(3)).toBe('gold');
    expect(accentAt(4)).toBe('teal');
    expect(accentAt(7)).toBe('gold');
  });
});

describe('relativeTime', () => {
  const M = 60_000, H = 3_600_000, D = 86_400_000;
  it('一分钟内是 JUST NOW', () => {
    expect(relativeTime(1000, 1000)).toBe('JUST NOW');
    expect(relativeTime(0, 59_999)).toBe('JUST NOW');
  });
  it('一小时内按分钟', () => {
    expect(relativeTime(0, M)).toBe('1M AGO');
    expect(relativeTime(0, 59 * M)).toBe('59M AGO');
  });
  it('一天内按小时', () => {
    expect(relativeTime(0, H)).toBe('1H AGO');
    expect(relativeTime(0, 2 * H)).toBe('2H AGO');
    expect(relativeTime(0, 23 * H)).toBe('23H AGO');
  });
  it('一周内按天', () => {
    expect(relativeTime(0, D)).toBe('1D AGO');
    expect(relativeTime(0, 6 * D)).toBe('6D AGO');
  });
  it('超过一周是 A WHILE AGO', () => {
    expect(relativeTime(0, 7 * D)).toBe('A WHILE AGO');
  });
  it('未来时间戳不产生负数', () => {
    expect(relativeTime(5000, 0)).toBe('JUST NOW');
  });
});

describe('dateKey / hashDate', () => {
  it('dateKey 按本地日期输出 YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 8, 5))).toBe('2026-09-05');
    expect(dateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
  it('hashDate 对同一输入稳定，且非负', () => {
    expect(hashDate('2026-09-05')).toBe(hashDate('2026-09-05'));
    expect(hashDate('2026-09-05')).toBeGreaterThanOrEqual(0);
  });
  it('hashDate 对不同输入给出不同结果', () => {
    expect(hashDate('2026-09-05')).not.toBe(hashDate('2026-09-06'));
    expect(hashDate('2026-09-05')).not.toBe(hashDate('2026-09-05:new'));
  });
});

function freshStorage(seed: Record<string, unknown> = {}): ArcadeStorage {
  const backend = memoryBackend();
  for (const [k, v] of Object.entries(seed)) backend.setItem(`arcade.${k}`, JSON.stringify(v));
  return new ArcadeStorage(backend);
}

describe('buildHall', () => {
  it('没有任何成绩时给出三行空位', () => {
    const rows = buildHall(freshStorage());
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.tone === 'faint')).toBe(true);
    expect(rows[0]).toEqual({ rank: '1', name: '— EMPTY —', score: '······', tone: 'faint' });
  });

  it('按分数降序取前三，并补齐到三行', () => {
    const rows = buildHall(freshStorage({ 'best.snake': 3840, 'best.tetris': 12750 }));
    expect(rows.map((r) => r.name)).toEqual(['TETRIS', 'SNAKE', '— EMPTY —']);
    expect(rows.map((r) => r.score)).toEqual(['012750', '003840', '······']);
    expect(rows[2].tone).toBe('faint');
  });

  it('第一名是 gold 色调，二三名是 dim 色调', () => {
    const rows = buildHall(freshStorage({ 'best.snake': 100, 'best.tetris': 200 }));
    expect(rows.map((r) => r.tone)).toEqual(['gold', 'dim', 'faint']);
  });

  it('只取前三名', () => {
    const rows = buildHall(freshStorage({
      'best.snake': 10, 'best.tetris': 20, 'best.breakout': 30, 'best.flappy': 40,
    }));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.name)).toEqual(['FLAPPY', 'BREAKOUT', 'TETRIS']);
  });

  it('同分时按 registry 顺序排', () => {
    const rows = buildHall(freshStorage({ 'best.tetris': 500, 'best.snake': 500 }));
    expect(rows.map((r) => r.name)).toEqual(['SNAKE', 'TETRIS', '— EMPTY —']);
  });

  it('忽略脏数据与 0 分', () => {
    const rows = buildHall(freshStorage({
      'best.snake': 'oops', 'best.tetris': null, 'best.breakout': 0, 'best.flappy': 47,
    }));
    expect(rows.map((r) => r.name)).toEqual(['FLAPPY', '— EMPTY —', '— EMPTY —']);
  });
});

describe('0 分的口径', () => {
  // 卡片和 Hall of Fame 必须用同一套「什么算有成绩」的规则
  it('0 分在两处都算没有成绩', () => {
    const s = freshStorage({ 'best.snake': 0 });
    expect(buildCards(s)[0]).toMatchObject({ pill: 'NO RECORD', hasRecord: false });
    expect(buildHall(s).every((r) => r.tone === 'faint')).toBe(true);
  });
});

describe('buildDaily', () => {
  it('八个游戏都有挑战文案', () => {
    for (const g of GAMES) {
      expect(CHALLENGES[g.meta.id], `缺少 ${g.meta.id} 的挑战文案`).toBeDefined();
      expect(CHALLENGES[g.meta.id].prefix.length).toBeGreaterThan(0);
    }
  });

  it('同一天两次调用结果完全相同', () => {
    const a = buildDaily(new Date(2026, 8, 5, 9, 0));
    const b = buildDaily(new Date(2026, 8, 5, 23, 30));
    expect(a).toEqual(b);
  });

  it('日期标签是 星期缩写 + 两位日', () => {
    // 2026-09-05 是星期六
    expect(buildDaily(new Date(2026, 8, 5)).dateLabel).toBe('DAILY CHALLENGE · SAT 05');
  });

  it('选中的游戏 id 一定在 registry 中', () => {
    for (let d = 1; d <= 28; d++) {
      const daily = buildDaily(new Date(2026, 8, d));
      expect(GAMES.some((g) => g.meta.id === daily.id)).toBe(true);
    }
  });

  it('一个月内不会永远是同一个游戏', () => {
    const ids = new Set<string>();
    for (let d = 1; d <= 28; d++) ids.add(buildDaily(new Date(2026, 8, d)).id);
    expect(ids.size).toBeGreaterThan(1);
  });

  it('轮到扫雷时文案与设计稿一致', () => {
    expect(CHALLENGES.minesweeper).toEqual({ prefix: 'CLEAR', suffix: 'IN UNDER 60 SECONDS' });
  });
});

describe('buildFeatured', () => {
  const now = new Date(2026, 8, 5, 12, 0);

  it('有合法 lastPlayed 时进入 continue 模式', () => {
    const at = now.getTime() - 2 * 3_600_000;
    const s = freshStorage({ lastPlayed: { id: 'tetris', at }, 'best.tetris': 12750 });
    expect(buildFeatured(s, now)).toEqual({
      mode: 'continue',
      label: '◆ CONTINUE PLAYING ◆',
      button: 'PRESS START',
      id: 'tetris',
      name: 'TETRIS',
      accent: 'magenta',
      meta: 'YOUR BEST 012750 · LAST PLAYED 2H AGO',
    });
  });

  it('玩过但没有成绩时元信息降级', () => {
    const s = freshStorage({ lastPlayed: { id: 'sudoku', at: now.getTime() } });
    expect(buildFeatured(s, now).meta).toBe('NO RECORD YET · LAST PLAYED JUST NOW');
  });

  it('从未玩过时进入 newcomer 模式', () => {
    const f = buildFeatured(freshStorage(), now);
    expect(f.mode).toBe('newcomer');
    expect(f.label).toBe('◆ NEW CHALLENGER? ◆');
    expect(f.button).toBe('INSERT COIN');
    expect(f.meta).toBe('NO RECORD YET · BE THE FIRST');
    expect(GAMES.some((g) => g.meta.id === f.id)).toBe(true);
  });

  it('newcomer 模式当天结果稳定', () => {
    const a = buildFeatured(freshStorage(), new Date(2026, 8, 5, 1, 0));
    const b = buildFeatured(freshStorage(), new Date(2026, 8, 5, 22, 0));
    expect(a).toEqual(b);
  });

  it('lastPlayed 脏数据一律退回 newcomer', () => {
    for (const bad of ['nope', 42, null, {}, { id: 'ghost', at: 1 }, { id: 'snake', at: 'x' }]) {
      expect(buildFeatured(freshStorage({ lastPlayed: bad }), now).mode).toBe('newcomer');
    }
  });
});

describe('buildCards', () => {
  it('八张卡片，accent 按下标轮转', () => {
    const cards = buildCards(freshStorage());
    expect(cards).toHaveLength(8);
    expect(cards.map((c) => c.accent)).toEqual([
      'teal', 'magenta', 'orange', 'gold', 'teal', 'magenta', 'orange', 'gold',
    ]);
  });

  it('无成绩显示 NO RECORD，有成绩显示补零分数', () => {
    const cards = buildCards(freshStorage({ 'best.snake': 3840 }));
    expect(cards[0]).toMatchObject({ id: 'snake', name: 'SNAKE', pill: 'BEST 003840', hasRecord: true });
    expect(cards[6]).toMatchObject({ id: 'sudoku', pill: 'NO RECORD', hasRecord: false });
  });
});

describe('buildHubModel', () => {
  it('footer 反映游戏数量与静音状态', () => {
    const on = buildHubModel(freshStorage(), new Date(2026, 8, 5));
    expect(on.footer).toBe('8 GAMES LOADED · SOUND ON · © 2026 SUNSET ARCADE');
    const off = buildHubModel(freshStorage({ muted: true }), new Date(2026, 8, 5));
    expect(off.footer).toBe('8 GAMES LOADED · SOUND OFF · © 2026 SUNSET ARCADE');
  });

  it('聚合四个区块', () => {
    const m = buildHubModel(freshStorage(), new Date(2026, 8, 5));
    expect(m.hall).toHaveLength(3);
    expect(m.cards).toHaveLength(8);
    expect(m.featured.mode).toBe('newcomer');
    expect(m.daily.dateLabel).toContain('DAILY CHALLENGE');
  });
});
