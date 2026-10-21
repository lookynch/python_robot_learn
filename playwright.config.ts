import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const localChromium = '/opt/pw-browsers/chromium';
const executablePath = process.env.CI
  ? undefined
  : fs.existsSync(localChromium)
    ? localChromium
    : undefined;
const proxy = process.env.HTTPS_PROXY
  ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' }
  : undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 60_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: { executablePath },
    proxy,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'iphone',
      use: { ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium' },
    },
    {
      name: 'ipad',
      use: { ...devices['iPad (gen 7)'], browserName: 'chromium', defaultBrowserType: 'chromium' },
    },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
