const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  outputDir: 'output/playwright/results',
  timeout: 30000,
  expect: { timeout: 7000 },
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'output/playwright/report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:8765', viewport: { width: 1440, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'npm run build && node tests/server.cjs', url: 'http://127.0.0.1:8765', reuseExistingServer: false }
});
