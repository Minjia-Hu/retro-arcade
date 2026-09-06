/** 分数补零。负数与小数先归一到非负整数，位数不够时保留原样、不截断 */
export function padScore(n: number, width: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(width, '0');
}
