# 페르소나×시점 기획 변경 반영 보고 — 2026-09-23

구현 커밋: `3cf68a8` (17개 파일, +351/−39) · 작성: Claude 세션 (사용자 검수 대기 항목 하단 참조)

## 근거 기획 문서 (SSOT: `D:\99_Etc\100_dndn\01_plan\`)

| 문서 | 내용 |
|---|---|
| `PERSONA_TIMING.md` (신규, 2026-09-23 확정) | 원칙: **모든 도구는 개발 전에 사용 인물 2~3명×인생 시점을 명세하고, 질문 문구가 그 시점에 맞는지를 DoD에 포함.** 도구 5종 페르소나 명세표 + 전 도구 공통 신뢰 장치 3종. 앞으로 새 도구를 만들 때의 체크리스트 |
| `TOOL_SPEC_dependent-check.md` v1.1 | 0단계 "언제 기준으로 볼까요?" 시점 선택 신설 + 은퇴 후 모드 입력 안내 전환 |
| `REVIEW_2026-09-22.md` V-3·V-4 | V-3: 피부양자 시점 결함(은퇴 예정자가 현재 근로소득을 입력해 오탈락) / V-4: 퇴직금 예정 배지·55세 안내, 4대보험 대상 라벨, 공통 신뢰 장치 |

V-1(기초연금 예비 계산 모드, `cb37ddc`)·V-2(간이세액표 초과 산식, `78e7a6e`)는 이전 커밋에서 반영 완료 — 이번 범위 아님.

## 반영 내역

### 1. V-3 — 피부양자(F-03) 0단계 시점 선택

- 문답 6→7단계. 0단계 "언제 기준으로 볼까요?" — ① 지금 기준 ② 은퇴 후 기준(예정).
- **은퇴 후 모드**: 이후 모든 소득 질문의 제목·라벨·도움말이 "지금 받는 월급은 빼고, 은퇴 후 예상되는 소득(연금·임대 등)만 입력" 안내로 전환. 재산 단계는 "지금 금액 그대로" 안내. 결과에 **"은퇴 후 가정 계산" 배지** + 재확인 안내.
- **계산은 분기하지 않는다** (문구·배지만 전환) — retired 여도 엔진·보험료 입력이 current 와 동일하다는 불변식을 schema 단위 테스트로 고정 (`features/dependent-check/__tests__/schema.test.ts`).
- 변경 파일: `features/dependent-check/schema.ts`(basis 필드), `features/dependent-check/components/Calculator.tsx`, `app/dependent-check/page.tsx`(히어로에 은퇴 후 모드 소개 1문장).

### 2. V-4 — 퇴직금(F-02) 예정 기준 분기

- 퇴직예정일이 미래(로컬 KST 날짜 기준 판정)면 결과에 **"예정 기준 시뮬레이션" 배지** + 결과 카드 안에 안내 분기: "실제 세액은 퇴직하는 해의 법령으로 정산 / 퇴직 시점에 만 55세 미만이면 퇴직금은 IRP 등 연금계좌로 의무이체, 연금 개시는 만 55세부터".
- 날짜 입력 단계 도움말에 "아직 퇴직 전이면 예정일을 넣어 주세요" 추가. 미래 날짜 입력은 기존 스키마가 이미 허용(기존 구조로 흡수 — PERSONA_TIMING 명세대로 신규 질문 없음).
- 변경 파일: `features/severance-tax/components/Calculator.tsx`.

### 3. V-4 — 4대보험(F-04) 대상 라벨

- 첫 화면에 "매달 월급을 받는 **직장인용**" 라벨 + 은퇴자·지역가입자는 피부양자 체크(`/dependent-check/`)로 안내 링크.
- 변경 파일: `app/insurance-rate/page.tsx`.

### 4. 공통 신뢰 장치 3종 (전 도구 5종)

| 장치 | 구현 | 적용 |
|---|---|---|
| ① 대상 라벨 | `components/AudienceLabel.tsx` (신규) — "이런 분께 맞아요 — {페르소나 1줄}". 서버렌더(citable shell 일부), 계산기 바로 위 | 도구 페이지 5곳. 문안은 PERSONA_TIMING 명세표의 인물 A·B를 문장화 |
| ② 시점 배지 | `components/ResultCard.tsx` — `timeBadge` prop **필수화**. 기본 `{rules._meta.year}년 기준`(수기 연도 금지), 미래형 "현재 기준 가정 계산"(기초연금 preview) / "은퇴 후 가정 계산"(F-03 retired) / "예정 기준 시뮬레이션"(F-02 미래). 캡처 영역 안 — 공유 이미지에도 포함 | 결과 화면 5곳 |
| ③ 공식 계산기 링크 | `components/OfficialLink.tsx` (신규) — 복지로/홈택스/건보공단/4대사회보험 링크를 Disclaimer 위에 병기. 기관 심층 링크는 개편 시 404 위험(감시 장치 없음)이라 **메인 URL + 경로 안내** 방식 | 결과 화면 5곳 |

### 5. 계약(contracts) 변경

- `contracts/design-guide.md` 고정 컴포넌트 표에 `AudienceLabel`·`OfficialLink` 행 추가, `ResultCard` 에 timeBadge 규칙 기록. PERSONA_TIMING(합의된 기획)의 부기로서 세션이 수정 — 사용자 확인 대상.

## 검증 (verification-ladder)

| rung | 결과 |
|---|---|
| ① 단위 테스트 | vitest **96/96** (신규: basis 기본값 + retired=current 엔진 입력 동일 불변식 2건) |
| ② 타입/lint/빌드 | `tsc --noEmit` clean · lint **에러 0**(경고 5는 기존 — react-hook-form×React Compiler, 홈 미사용 import) · SSG export build green |
| ③ E2E 스모크 | Playwright **7/7** — 신규 2건: (a) 은퇴 후 모드 7단계 전체 플로우 → 문구 전환·유지 판정·배지·공식 링크 (b) 미래 퇴직예정일 → 예정 배지·55세 안내·공식 링크. 기존 기초연금 2건에 배지 검증 추가 |
| ④ 사람 검수 | ↓ 남은 항목 |

## 남은 사람 검수 (DoD — PERSONA_TIMING 원칙)

"각 질문 문구가 그 시점에서 자연스러운가"는 사람 검수 항목:

- [ ] F-03 은퇴 후 모드 전환 문구 7곳 (0단계 선택지, 누구의 보험·사업자등록·임대·소득 제목, 소득 라벨·도움말, 재산·배우자 도움말)
- [ ] 대상 라벨(AudienceLabel) 문안 5종
- [ ] F-02 예정 기준 안내 문구 (55세 의무이체·개시)
- [ ] `contracts/design-guide.md` 갱신분 승인

## Noticed, not changed

- F-03 계산기 도움말에 "연 500만원" 문자열 잔존 (rules 에는 `unregisteredMax` 구조화 완료, 페이지 쪽은 rules 참조 중) — REVIEW M-1 잔재, 별도 정리 대상.
- codex-review 7종 트리거 비해당 (엔진·세액 로직 무변경, UI 문구·프레임 변경) — 리뷰 미제안.
