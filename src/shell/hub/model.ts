import { SUNSET } from '../../core/theme';

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
