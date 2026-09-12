import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // A dedicated port so it doesn't collide with other Vite projects on this machine (one lives on 5173)
  use: { baseURL: 'http://localhost:5183' },
  webServer: {
    command: 'npm run dev -- --port 5183 --strictPort',
    url: 'http://localhost:5183',
    reuseExistingServer: true,
  },
});
