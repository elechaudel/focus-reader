// Browser tests of <focus-reader> (test/browser), on the test pages in test/fixtures served by Vite.
//
// Locally they run in the Chrome installed on the machine (`channel: 'chrome'`), so nothing is downloaded: a
// desktop window and a phone (touch, coarse pointer). FR_BROWSERS=all adds Playwright's own Firefox and WebKit,
// which need `pnpm exec playwright install firefox webkit` once; in CI (CI=1) Playwright's Chromium is used
// in place of Chrome, and all of them run.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4179;
/** the Astro test site (test/astro), built then served */
const ASTRO_PORT = 4180;
const ci = !!process.env.CI;
const all = ci || process.env.FR_BROWSERS === 'all';
const chrome = ci ? {} : { channel: 'chrome' };
const TOUCH = /touch\.spec\.ts$/;
const ASTRO = /astro\.spec\.ts$/;

export default defineConfig({
  testDir: 'test/browser',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/test/fixtures/`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `vite --port ${PORT} --strictPort --logLevel warn`,
      url: `http://localhost:${PORT}/test/fixtures/reader.html`,
      reuseExistingServer: !ci,
    },
    {
      command: `astro build --root test/astro --silent && vite preview --outDir test/astro/dist --port ${ASTRO_PORT} --strictPort`,
      url: `http://localhost:${ASTRO_PORT}/`,
      reuseExistingServer: !ci,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'chrome', testIgnore: [TOUCH, ASTRO], use: { ...devices['Desktop Chrome'], ...chrome, viewport: { width: 1280, height: 800 } } },
    // touch and a coarse pointer: only the tests written for them
    { name: 'phone', testMatch: TOUCH, use: { ...devices['Pixel 7'], ...chrome } },
    // the integration and the <FocusReader> component, on the Astro test site
    { name: 'astro', testMatch: ASTRO, use: { ...devices['Desktop Chrome'], ...chrome, baseURL: `http://localhost:${ASTRO_PORT}/` } },
    ...(all
      ? [
          { name: 'firefox', testIgnore: [TOUCH, ASTRO], use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } } },
          { name: 'webkit', testIgnore: [TOUCH, ASTRO], use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } },
        ]
      : []),
  ],
});
