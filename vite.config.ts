import { defineConfig } from 'vitest/config';

// base 保持 '/'；部署 GitHub Pages 时（阶段 5）改为 '/retro-arcade/'
export default defineConfig({
  base: '/',
  // 限定单测目录，避免 Vitest 误收集 e2e/ 下的 Playwright 用例
  test: {
    include: ['tests/**/*.test.ts'],
    // 默认下 Vitest 把 CSS 导入桩成空串，hub-view 那条「色调名与样式表对应」的
    // 断言需要读到真实内容
    css: true,
  },
});
