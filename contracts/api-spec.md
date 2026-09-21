# api-spec (SSOT)

> 계약서. 세션(오케스트레이터)이 사용자와 합의 후 작성·수정한다 — 구현(task-agent·세션)은 준수
> 대상이며 직접 수정하지 않는다(불일치는 완료 보고에 명시). 포맷·규율: `contract-authoring` 스킬.

## 1단계: HTTP API 없음 (BUILD_BRIEF 확정)

정적 사이트(SSG)이며 **입력값 서버 전송 금지**(F-10)가 제품 신뢰 포인트다. 따라서 1단계의 "API"
는 HTTP 엔드포인트가 아니라 **클라이언트 순수함수 계약**이다. Request/Response 타입의 정본은
`contracts/shared-types.ts` — 아래 시그니처는 그 타입을 그대로 import 해서 구현한다.

## 계산 엔진 계약 (features/*/engine.ts)

엔진은 **순수함수**다: 같은 (input, rules) → 항상 같은 result. DOM·전역·네트워크 접근 금지.
rules 는 항상 인자로 받는다(내부 import 금지 — rules 교체 테스트가 DoD).

| 도구 | 함수 | 시그니처 (shared-types) |
|---|---|---|
| F-01 | `computeBasicPension` | `(input: BasicPensionInput, rules: BasicPensionRules) => BasicPensionResult` |
| F-02 | `computeSeverance` | `(input: SeveranceInput, rules: SeveranceRules) => SeveranceResult` |
| F-03 | `checkDependent` | `(input: DependentInput, rules: DependentRules) => DependentResult` |
| F-03 | `estimateRegionalPremium` | `(input: RegionalPremiumInput, rules: DependentRules) => RegionalPremiumEstimate` |
| F-04 | `computeInsuranceDiff` | `(input: InsuranceRateInput, current: InsuranceRules, next: NextYearRates) => InsuranceRateResult` |
| F-07 | `computeSalarySenior` | `(input: SalarySeniorInput, rules: InsuranceRules, taxTable: SimplifiedTaxTable) => SalarySeniorResult` |

- 금액 반올림: 각 항목은 원 단위 반올림(Math.round). 공식 사이트 대조(DoD) 시 오차 원인을
  엔진 주석에 문서화한다.
- 입력 검증: 페이지 폼에서 Zod 로 검증 후 엔진 호출 — 엔진은 유효 입력을 전제(방어 분기 금지, §2).

## rules 로딩 계약

- `apps/web/data/rules/index.ts` 가 유일한 진입점: `getRules(toolId)` 가 활성 연도 파일을
  정적 import 로 반환. 페이지·엔진 테스트 외에는 rules JSON 직접 import 금지.
- 활성 연도 전환·파일 추가 = 데이터 개정 절차(W1) — 코드 변경 없이 이 파일만 손댄다.

## GA4 이벤트 (F-15)

`lib/analytics.ts` 의 `track(event: GaEvent)` 단일 함수만 사용 (gtag 직접 호출 금지).
이벤트 5종·파라미터는 `shared-types.ts` `GaEvent` 가 정본 (BUILD_BRIEF 명세와 1:1):
`calc_complete{tool}` · `share_click{tool,channel}` · `affiliate_click{tool,campaign}` ·
`faq_open{tool,question}` · `print_click{tool}`.
GA 측정 ID 는 `NEXT_PUBLIC_GA_ID` — 미설정이면 no-op (개발·프리뷰).

## 2단계 이후

HTTP API 가 생기면(예: 개정 알림 구독) 이 문서에 엔드포인트·Zod 스키마를 추가하고
Next.js Route Handler + Supabase 로 구현한다. 그 전까지 `app/api/` 디렉터리는 만들지 않는다.
