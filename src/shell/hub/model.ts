import { GAMES } from '../../games/registry';
import type { GameEntry } from '../../games/registry';
import type { ArcadeStorage } from '../../core/storage';
import { accentAt } from '../accent';
import type { AccentTone } from '../accent';

export type { AccentTone };

/** Zero-pad a score to 6 digits; wider values are kept, never truncated */
export function padScore(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(6, '0');
}

/** Relative-time copy, upper-case to match the arcade style */
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

/** Local date key, the seed for the daily content */
export function dateKey(now: Date): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** djb2 variant returning a non-negative integer */
export function hashDate(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** Semantic tone of a row; the colours live in CSS (.hall-row-*) */
export type HallTone = 'gold' | 'dim' | 'faint';

export interface HallRow {
  rank: string;
  name: string;
  score: string;
  tone: HallTone;
}

/** Display name for the hub; falls back to `name` when displayName is missing */
function label(entry: GameEntry): string {
  return entry.meta.displayName ?? entry.meta.name;
}

/**
 * Read one game's best score. Legacy junk and a score of 0 both count as no record — every
 * game only persists when `score > best` and best starts at 0, so 0 should never have been
 * stored. One rule here keeps a card from showing BEST 000000 while the Hall of Fame excludes it.
 */
function bestOf(storage: ArcadeStorage, id: string): number | null {
  const raw = storage.get<unknown>(`best.${id}`, null);
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
}

export function buildHall(storage: ArcadeStorage): HallRow[] {
  const top = GAMES
    .map((entry, index) => ({ index, name: label(entry), best: bestOf(storage, entry.meta.id) }))
    .filter((e): e is { index: number; name: string; best: number } => e.best !== null)
    .sort((a, b) => b.best - a.best || a.index - b.index)
    .slice(0, 3);

  const rows: HallRow[] = top.map((e, i) => ({
    rank: String(i + 1),
    name: e.name,
    score: padScore(e.best),
    tone: i === 0 ? 'gold' : 'dim',
  }));

  while (rows.length < 3) {
    rows.push({
      rank: String(rows.length + 1),
      name: '— EMPTY —',
      score: '······',
      tone: 'faint',
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

/** Rendered as "prefix GAME suffix"; suffix may be empty */
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

export interface FeaturedModel {
  mode: 'continue' | 'newcomer';
  label: string;
  button: string;
  id: string;
  name: string;
  accent: AccentTone;
  meta: string;
}

export interface CardModel {
  id: string;
  name: string;
  accent: AccentTone;
  pill: string;
  hasRecord: boolean;
}

export const REPO_URL = 'https://github.com/Minjia-Hu/retro-arcade';

/**
 * Each footer part has one job: games is decoration, muted is a toggle (sound can be turned off
 * on the hub without entering a game to find SND), repoUrl is the exit (someone arriving from a
 * shared link has no other way to find the source). No star-count widget: it would load a
 * third-party script, and "Star 0" sells nothing.
 */
export interface FooterModel {
  games: string;
  muted: boolean;
  copyright: string;
  repoUrl: string;
}

export interface HubModel {
  featured: FeaturedModel;
  daily: DailyModel;
  hall: HallRow[];
  cards: CardModel[];
  footer: FooterModel;
}

interface LastPlayed { id: string; at: number }

/** Read the last-played record; anything malformed counts as never played */
function readLastPlayed(storage: ArcadeStorage): LastPlayed | null {
  const raw = storage.get<unknown>('lastPlayed', null);
  if (raw === null || typeof raw !== 'object') return null;
  const { id, at } = raw as Partial<LastPlayed>;
  if (typeof id !== 'string' || typeof at !== 'number' || !Number.isFinite(at)) return null;
  return GAMES.some((g) => g.meta.id === id) ? { id, at } : null;
}

export function buildFeatured(storage: ArcadeStorage, now: Date): FeaturedModel {
  const last = readLastPlayed(storage);
  if (last) {
    const index = GAMES.findIndex((g) => g.meta.id === last.id);
    const entry = GAMES[index];
    const best = bestOf(storage, entry.meta.id);
    const bestText = best === null ? 'NO RECORD YET' : `YOUR BEST ${padScore(best)}`;
    return {
      mode: 'continue',
      label: '◆ CONTINUE PLAYING ◆',
      button: 'PRESS START',
      id: entry.meta.id,
      name: label(entry),
      accent: accentAt(index),
      meta: `${bestText} · LAST PLAYED ${relativeTime(last.at, now.getTime())}`,
    };
  }
  // With no history, pick one by date: stable within a day, different across days
  const index = hashDate(`${dateKey(now)}:new`) % GAMES.length;
  const entry = GAMES[index];
  return {
    mode: 'newcomer',
    label: '◆ NEW CHALLENGER? ◆',
    button: 'INSERT COIN',
    id: entry.meta.id,
    name: label(entry),
    accent: accentAt(index),
    meta: 'NO RECORD YET · BE THE FIRST',
  };
}

export function buildCards(storage: ArcadeStorage): CardModel[] {
  return GAMES.map((entry, index) => {
    const best = bestOf(storage, entry.meta.id);
    return {
      id: entry.meta.id,
      name: label(entry),
      accent: accentAt(index),
      pill: best === null ? 'NO RECORD' : `BEST ${padScore(best)}`,
      hasRecord: best !== null,
    };
  });
}

export function buildHubModel(storage: ArcadeStorage, now: Date): HubModel {
  const muted = storage.get<boolean>('muted', false); // read the same way audio.ts does
  return {
    featured: buildFeatured(storage, now),
    daily: buildDaily(now),
    hall: buildHall(storage),
    cards: buildCards(storage),
    footer: {
      games: `${GAMES.length} GAMES LOADED`,
      muted,
      copyright: '© 2026 SUNSET ARCADE',
      repoUrl: REPO_URL,
    },
  };
}
