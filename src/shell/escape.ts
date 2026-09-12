const ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
};

/** Escape a string for insertion into HTML text or a double-quoted attribute */
export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESCAPES[c]);
}
