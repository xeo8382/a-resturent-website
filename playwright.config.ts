import "dotenv/config";
import { defineConfig } from "@playwright/test";
const origin = process.env.APP_ORIGIN || "http://localhost:3000";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: origin,
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run start -- --port ${new URL(origin).port || "3000"}`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
