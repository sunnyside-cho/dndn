---
name: playwright-e2e
description: dndn의 Playwright E2E 테스트 규약. task-agent 가 spawn 시 로드하며 세션의 E2E 작업에도 적용.
---

# Playwright E2E 규약 (dndn)

- E2E 디렉터리: `apps/web/e2e/` · 설정: `apps/web/playwright.config.ts`
- 실행: `apps/web` 에서 `npm run test:e2e` (webServer 가 dev 서버 자동 기동)

## 규약

1. **셀렉터**: `getByRole`/`getByLabel` 우선 — a11y 마크업(라벨 연결·role)을 E2E 가 이중
   검증하게 한다. 텍스트 셀렉터는 정확한 한국어 문자열로. CSS 클래스 셀렉터 금지.
2. **인증 없음**: 사이트에 가입·로그인이 없다 — 세션 셋업 불필요.
3. **문답 위저드 진행 패턴**: 한 화면 한 질문 구조이므로 `선택/입력 → "다음" 클릭` 을 반복.
   숫자 입력(MoneyField)은 `type=text inputMode=numeric` — `fill()` 로 만원 단위 숫자 입력.
4. **핵심 플로우 검증값은 rules 기준 수기 계산값**으로 고정한다 (엔진 테스트와 같은 앵커 —
   예: 기초연금 예시1 → "349,700원"). rules 개정 시 E2E 기대값도 함께 갱신 대상.
5. **JS-off 검증 (DoD)**: 글(guide)·도구 페이지의 citable shell 은 `javaScriptEnabled: false`
   컨텍스트로 본문 텍스트 가시성을 검증한다 — "자바스크립트 꺼도 글 페이지 읽힘".
6. **플래키 방지**: Playwright 자동 대기만 사용 — `waitForTimeout` 금지. 애니메이션 의존 금지.
7. **GA·외부 요청**: GA 미설정(no-op) 상태로 돈다 — 외부 네트워크 모킹 불필요. 단 Pretendard
   CDN 은 로드 실패해도 테스트가 깨지면 안 된다(폰트 가시성 의존 금지).
