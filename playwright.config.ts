import {defineConfig} from "@playwright/test";
import {existsSync} from "node:fs";
if(existsSync(".env")) process.loadEnvFile(".env");
const baseURL=process.env.PLAYWRIGHT_BASE_URL||"http://127.0.0.1:3000";
export default defineConfig({
  testDir:"tests/e2e",
  timeout:120_000,
  expect:{timeout:25_000},
  workers:1,
  use:{baseURL,trace:"retain-on-failure",launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}},
  webServer:process.env.PLAYWRIGHT_BASE_URL?undefined:{command:"pnpm dev --hostname 127.0.0.1",url:baseURL,reuseExistingServer:!process.env.CI,timeout:90_000},
});
