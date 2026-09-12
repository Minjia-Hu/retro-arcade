import { defineConfig } from 'vitest/config';

// base stays '/': local dev and e2e run at the root. GitHub Pages lives under /retro-arcade/,
// which .github/workflows/ci.yml passes via `vite build --base=/retro-arcade/` rather than hard-coding here
export default defineConfig({
  base: '/',
  // Limit unit tests to tests/ so Vitest doesn't pick up the Playwright specs in e2e/
  test: {
    include: ['tests/**/*.test.ts'],
    // Vitest stubs CSS imports to '' by default; the hub-view assertion that tone names map to
    // stylesheet rules needs the real content
    css: true,
  },
});
