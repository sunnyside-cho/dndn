import { expect, test } from "@playwright/test";

// 핵심 사용자 플로우 회귀 (playwright-e2e 규약)

test("홈: 히어로·도구 5종 링크가 보인다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /기초연금 모의계산/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /퇴직금 세금/ }).first()).toBeVisible();
});

test("기초연금 위저드: 예시1 입력 → 전액 349,700원 결과", async ({ page }) => {
  await page.goto("/basic-pension/");

  // 0. 출생연도 + 직역연금 아니요
  await page.getByLabel("출생연도").fill("1958");
  await page.getByRole("radio", { name: /아니요/ }).click();
  await page.getByRole("button", { name: "다음" }).click();

  // 1. 단독
  await page.getByRole("radio", { name: /혼자예요/ }).click();
  await page.getByRole("button", { name: "다음" }).click();

  // 2. 중소도시
  await page.getByRole("radio", { name: /중소도시/ }).click();
  await page.getByRole("button", { name: "다음" }).click();

  // 3. 근로소득 150만
  await page.getByLabel("근로소득 (월)").fill("150");
  await page.getByRole("button", { name: "다음" }).click();

  // 4. 연금·기타 없음 (기본 0)
  await page.getByRole("button", { name: "다음" }).click();

  // 5. 재산: 집 1.2억(12000만), 예금 3천만(3000만)
  await page.getByLabel("집·땅 등 재산 (시가표준액)").fill("12000");
  await page.getByLabel("예금 등 금융재산").fill("3000");
  await page.getByRole("button", { name: "다음" }).click();

  // 6. 추가 확인 기본값(아니요) → 결과
  await page.getByRole("button", { name: "결과 보기" }).click();

  // 결과: rules 수기 계산 앵커 (엔진 테스트 예시1과 동일)
  await expect(page.getByText(/월 349,700원/).first()).toBeVisible();
  await expect(page.getByText(/기준일 2026-09-21/)).toBeVisible();
});

test("가이드 글: JS 꺼도 본문이 읽힌다 (DoD)", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/guide/basic-pension-eligibility/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("기초연금 수급자격");
  await expect(page.getByText("소득인정액 = 소득평가액 + 재산의 소득환산액")).toBeVisible();
  await context.close();
});

test("도구 페이지: JS 꺼도 citable shell(산식·FAQ)이 읽힌다", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/basic-pension/");
  await expect(page.getByRole("heading", { name: "계산 방법 (산식)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "자주 묻는 질문" })).toBeVisible();
  await context.close();
});
