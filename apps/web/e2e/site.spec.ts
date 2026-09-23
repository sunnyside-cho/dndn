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

  // 결과: rules 수기 계산 앵커 (엔진 테스트 예시1과 동일) + 시점 배지(공통 신뢰 장치 ②)
  await expect(page.getByText(/월 349,700원/).first()).toBeVisible();
  await expect(page.getByText("2026년 기준", { exact: true })).toBeVisible();
  await expect(page.getByText(/기준일 2026-09-21/)).toBeVisible();
});

test("기초연금 예비 계산 모드: 65세 미만(1968년생)도 끝까지 계산 — 가정 프레임 + 도달연도 배지 (V-1)", async ({
  page,
}) => {
  await page.goto("/basic-pension/");

  // 0. 1968년생(2026 기준 58세) — 종료되지 않고 다음 단계로 진행돼야 한다
  await page.getByLabel("출생연도").fill("1968");
  await page.getByRole("radio", { name: /아니요/ }).click();
  await page.getByRole("button", { name: "다음" }).click();

  // 1~6. 예시1과 동일 입력
  await page.getByRole("radio", { name: /혼자예요/ }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("radio", { name: /중소도시/ }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByLabel("근로소득 (월)").fill("150");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByLabel("집·땅 등 재산 (시가표준액)").fill("12000");
  await page.getByLabel("예금 등 금융재산").fill("3000");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "결과 보기" }).click();

  // 결과: "지금 65세 가정" 헤드라인 (금액 앵커 동일) + 1968+65=2033년 도달 배지 (D-7년)
  await expect(page.getByText("현재 기준 가정 계산")).toBeVisible();
  await expect(page.getByText(/지금 만 65세라고 가정하면/).first()).toBeVisible();
  await expect(page.getByText(/월 349,700원 수준/).first()).toBeVisible();
  await expect(page.getByText(/2033년.*만 65세가 돼요/).first()).toBeVisible();
  await expect(page.getByText(/D-7년/).first()).toBeVisible();
  // 미래 금액 단정 금지 — 신청 안내(주민센터) 대신 재방문 고리가 보인다
  await expect(page.getByText(/2033년에 다시 계산해 보세요/)).toBeVisible();
});

test("피부양자 은퇴 후 모드: 시점 선택 → 입력 안내 전환 → '은퇴 후 가정 계산' 배지 (V-3)", async ({
  page,
}) => {
  await page.goto("/dependent-check/");

  // 0. 시점 선택 — 은퇴 후 기준
  await page.getByRole("radio", { name: /은퇴 후 기준으로 볼게요/ }).click();
  await page.getByRole("button", { name: "다음" }).click();

  // 1. 누구의 보험 — 문구가 은퇴 후 시점으로 전환됐는지 (기본값 자녀 유지)
  await expect(
    page.getByRole("heading", { name: "은퇴 후 누구의 건강보험에 피부양자로 들어가세요?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();

  // 2. 사업자등록 (은퇴 후 계획 기준, 기본 없어요)
  await expect(
    page.getByRole("heading", { name: "은퇴 후에도 사업자등록이 있을 예정인가요?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();

  // 3. 임대소득 (기본 없어요)
  await expect(
    page.getByRole("heading", { name: "은퇴 후 주택임대소득이 있을 예정인가요?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();

  // 4. 소득 — "지금 월급은 빼고" 안내 + 은퇴 후 예상 연금 1,200만원 (소득요건 2,000만 이하)
  await expect(page.getByText(/지금 받는 월급은 빼고/).first()).toBeVisible();
  await page.getByLabel("은퇴 후 근로·연금 소득 (연간 예상)").fill("1200");
  await page.getByRole("button", { name: "다음" }).click();

  // 5. 재산 1.5억 (과표 5.4억 이하)
  await page.getByLabel("재산세 과세표준 (본인 명의 합계)").fill("15000");
  await page.getByRole("button", { name: "다음" }).click();

  // 6. 배우자 없음(기본) → 결과
  await page.getByRole("button", { name: "결과 보기" }).click();

  // 결과: 유지 판정 (rules: 소득 1,200만≤2,000만 · 과표 1.5억≤5.4억) + 은퇴 후 가정 배지 + 공식 링크
  await expect(page.getByText("피부양자 자격을 유지할 수 있어요")).toBeVisible();
  await expect(page.getByText("은퇴 후 가정 계산")).toBeVisible();
  await expect(page.getByRole("link", { name: "건강보험공단 모의계산" })).toBeVisible();
});

test("퇴직금 예정 기준: 미래 퇴직예정일 → '예정 기준 시뮬레이션' 배지 + 55세 IRP 안내 (V-4)", async ({
  page,
}) => {
  await page.goto("/severance-tax/");

  // 0. 퇴직금 1억
  await page.getByLabel("예상 퇴직금 (세전)").fill("10000");
  await page.getByRole("button", { name: "다음" }).click();

  // 1. 입사일 과거, 퇴직일 미래 (미래 판정만 검증 — 세액 앵커는 엔진 테스트가 담당)
  await page.getByLabel("입사일").fill("2016-01-01");
  await page.getByLabel("퇴직일 (예정일)").fill("2035-12-31");
  await page.getByRole("button", { name: "다음" }).click();

  // 2. 수령 방식 기본(아직 모르겠어요) → 결과
  await page.getByRole("button", { name: "결과 보기" }).click();

  // 결과: 예정 기준 배지 + 55세 미만 IRP 의무이체·개시 제약 안내 + 공식 링크
  await expect(page.getByText("예정 기준 시뮬레이션")).toBeVisible();
  await expect(page.getByText(/만 55세 미만.*의무이체/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "홈택스 모의계산" })).toBeVisible();
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
