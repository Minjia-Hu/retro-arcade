import { defineConfig } from 'vitest/config';

// base 保持 '/'：本地开发与 e2e 都在根路径。GitHub Pages 挂在 /retro-arcade/ 子路径下，
// 由 .github/workflows/ci.yml 用 `vite build --base=/retro-arcade/` 传入，不在这里写死
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
