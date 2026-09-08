/** 分数补零。负数与小数先归一到非负整数，位数不够时保留原样、不截断 */
export function padScore(n: number, width: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(width, '0');
}

/** 难度 id → 顶栏药丸用的英文标签。logic 里的 name 是中文，顶栏按设计稿用英文 */
export const DIFF_LABEL: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'EASY', medium: 'MEDIUM', hard: 'HARD',
};
