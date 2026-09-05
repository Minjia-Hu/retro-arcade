const ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
};

/** 转义要插进 HTML 文本或双引号属性的字符串 */
export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESCAPES[c]);
}
