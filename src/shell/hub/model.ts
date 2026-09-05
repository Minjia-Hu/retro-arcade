import { SUNSET } from '../../core/theme';
import { GAMES } from '../../games/registry';
import type { GameEntry } from '../../games/registry';
import type { ArcadeStorage } from '../../core/storage';

/** 分数补零；位数不够时保留原样，不截断 */
export function padScore(n: number, width = 6): string {
  const safe = Math.max(0, Math.floor(n));
  return String(safe).padStart(width, '0');
}

/** 按 registry 下标轮转 accent 颜色 */
export function accentAt(index: number): string {
  return SUNSET.accents[index % SUNSET.accents.length];
}

/** 相对时间文案，全大写以配合街机风格 */
export function relativeTime(at: number, now: number): string {
  const ms = Math.max(0, now - at);
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'JUST NOW';
  if (min < 60) return `${min}M AGO`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}D AGO`;
  return 'A WHILE AGO';
}

/** 本地日期键，用作每日内容的种子 */
export function dateKey(now: Date): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** djb2 变体，返回非负整数 */
export function hashDate(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** 行的语义色调，具体颜色由 CSS 的 .hall-row-* 决定 */
export type HallTone = 'gold' | 'dim' | 'faint';

export interface HallRow {
  rank: string;
  name: string;
  score: string;
  tone: HallTone;
  empty: boolean;
}

/** 首页展示名，缺 displayName 时回退中文名 */
function label(entry: GameEntry): string {
  return entry.meta.displayName ?? entry.meta.name;
}

/** 读单个游戏最高分；存量脏数据一律当作没有成绩 */
function bestOf(storage: ArcadeStorage, id: string): number | null {
  const raw = storage.get<unknown>(`best.${id}`, null);
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

export function buildHall(storage: ArcadeStorage): HallRow[] {
  const top = GAMES
    .map((entry, index) => ({ index, name: label(entry), best: bestOf(storage, entry.meta.id) }))
    .filter((e): e is { index: number; name: string; best: number } => e.best !== null && e.best > 0)
    .sort((a, b) => b.best - a.best || a.index - b.index)
    .slice(0, 3);

  const rows: HallRow[] = top.map((e, i) => ({
    rank: String(i + 1),
    name: e.name,
    score: padScore(e.best),
    tone: i === 0 ? 'gold' : 'dim',
    empty: false,
  }));

  while (rows.length < 3) {
    rows.push({
      rank: String(rows.length + 1),
      name: '— EMPTY —',
      score: '······',
      tone: 'faint',
      empty: true,
    });
  }
  return rows;
}

export interface DailyModel {
  dateLabel: string;
  prefix: string;
  name: string;
  suffix: string;
  id: string;
}

/** 渲染为「prefix 游戏名 suffix」，suffix 可为空 */
export const CHALLENGES: Record<string, { prefix: string; suffix: string }> = {
  snake: { prefix: 'SURVIVE', suffix: 'FOR 20 APPLES STRAIGHT' },
  tetris: { prefix: 'CLEAR 10 LINES IN', suffix: '' },
  breakout: { prefix: 'BREAK 60 BRICKS IN', suffix: 'ON ONE LIFE' },
  flappy: { prefix: 'PASS 15 PIPES IN', suffix: 'WITHOUT A SCRATCH' },
  g2048: { prefix: 'REACH THE 512 TILE IN', suffix: '' },
  minesweeper: { prefix: 'CLEAR', suffix: 'IN UNDER 60 SECONDS' },
  sudoku: { prefix: 'FINISH', suffix: 'WITH ZERO MISTAKES' },
  gomoku: { prefix: 'BEAT THE AI AT', suffix: 'AS BLACK' },
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function buildDaily(now: Date): DailyModel {
  const entry = GAMES[hashDate(dateKey(now)) % GAMES.length];
  const copy = CHALLENGES[entry.meta.id] ?? { prefix: 'PLAY', suffix: 'TODAY' };
  const day = String(now.getDate()).padStart(2, '0');
  return {
    dateLabel: `DAILY CHALLENGE · ${WEEKDAYS[now.getDay()]} ${day}`,
    prefix: copy.prefix,
    name: label(entry),
    suffix: copy.suffix,
    id: entry.meta.id,
  };
}
