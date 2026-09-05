import { describe, it, expect } from 'vitest';
import { SUNSET, THEME } from '../src/core/theme';
import { GAMES } from '../src/games/registry';
import { padScore, accentAt, relativeTime, dateKey, hashDate } from '../src/shell/hub/model';
import { ArcadeStorage, memoryBackend } from '../src/core/storage';
import { buildHall } from '../src/shell/hub/model';
import { buildDaily, CHALLENGES } from '../src/shell/hub/model';

describe('SUNSET 令牌', () => {
  it('提供四个 accent 颜色，顺序为 teal/magenta/orange/gold', () => {
    expect(SUNSET.accents).toEqual(['#0b7285', '#d6336c', '#e8590c', '#e67700']);
  });

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
  it('四色轮转', () => {
    expect(accentAt(0)).toBe('#0b7285');
    expect(accentAt(1)).toBe('#d6336c');
    expect(accentAt(2)).toBe('#e8590c');
    expect(accentAt(3)).toBe('#e67700');
    expect(accentAt(4)).toBe('#0b7285');
    expect(accentAt(7)).toBe('#e67700');
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
    expect(rows.every((r) => r.empty)).toBe(true);
    expect(rows[0]).toEqual({ rank: '1', name: '— EMPTY —', score: '······', tone: 'faint', empty: true });
  });

  it('按分数降序取前三，并补齐到三行', () => {
    const rows = buildHall(freshStorage({ 'best.snake': 3840, 'best.tetris': 12750 }));
    expect(rows.map((r) => r.name)).toEqual(['TETRIS', 'SNAKE', '— EMPTY —']);
    expect(rows.map((r) => r.score)).toEqual(['012750', '003840', '······']);
    expect(rows[2].empty).toBe(true);
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
