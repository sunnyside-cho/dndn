import { defineConfig } from "@playwright/test";

// dndn 전용 포트 3001 (사용자 지정) — 3000 은 이 PC 의 다른 프로젝트(HTP검사 WAS)가 사용 중.
// reuseExistingServer 가 남의 서버를 재사용해 전 테스트가 오탐 실패한 전례로 포트를 고정한다.
const PORT = 3001;

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
