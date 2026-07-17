import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // 固定专用端口，避免与本机其他 Vite 项目（另一个常驻 5173 的本机项目）撞车
  use: { baseURL: 'http://localhost:5183' },
  webServer: {
    command: 'npm run dev -- --port 5183 --strictPort',
    url: 'http://localhost:5183',
    reuseExistingServer: true,
  },
});
