import { defineConfig } from 'vitest/config';

// base 保持 '/'；部署 GitHub Pages 时（阶段 5）改为 '/retro-arcade/'
export default defineConfig({
  base: '/',
  // 限定单测目录，避免 Vitest 误收集 e2e/ 下的 Playwright 用例
  test: { include: ['tests/**/*.test.ts'] },
});
