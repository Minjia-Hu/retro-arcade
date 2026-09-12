/** Zero-pad a score. Negatives and fractions are normalised to a non-negative integer first; wider values are kept, never truncated */
export function padScore(n: number, width: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(width, '0');
}

/** Difficulty id → label for the top-bar pill. The `name` in logic is Chinese; the top bar uses English per the mockups */
export const DIFF_LABEL: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'EASY', medium: 'MEDIUM', hard: 'HARD',
};
