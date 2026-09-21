# db-schema (SSOT)

> 계약서. 세션(오케스트레이터)이 사용자와 합의 후 작성·수정한다 — 구현(task-agent·세션)은 준수
> 대상이며 직접 수정하지 않는다(불일치는 완료 보고에 명시). 포맷·규율: `contract-authoring` 스킬.

## 1단계: DB 없음 (BUILD_BRIEF 확정)

1단계는 **정적 사이트(SSG)** 다. 관계형 DB 테이블은 존재하지 않는다:

- 입력값(소득·재산)은 **서버로 전송하지 않는다**(F-10) — 저장할 데이터 자체가 없다.
- `apps/web/prisma/` (Supabase PostgreSQL, provider="postgresql")는 **2단계 대비 휴면
  스캐폴딩**이다. 1단계 코드는 `lib/db.ts` 를 import 하지 않는다.
- 2단계에서 테이블이 생기면 이 문서에 표 형식(컬럼·타입·인덱스·제약)으로 계약을 추가하고
  `prisma/schema.prisma` 와 1:1 대응시킨다 (CI `contract-drift` 잡이 대조).

## 1단계 데이터 계약: rules 파일 (`apps/web/data/rules/`)

DB 를 대신하는 유일한 데이터 저장소. **모든 제도 숫자는 이 파일에만 존재한다**(코드 하드코딩
금지 — 개정 시 파일 교체만으로 도구 숫자가 바뀌어야 하며, 이를 검증하는 테스트가 DoD).

| 파일 | 도구 | 원본(기획 측 SSOT) |
|---|---|---|
| `basic-pension.{year}.json` | 기초연금 (F-01) | `02_data/rules/{year}.draft.json` |
| `severance.{year}.json` | 퇴직금 세금 (F-02) | `02_data/rules/{year}.severance.draft.json` |
| `dependent.{year}.json` | 건보 피부양자 (F-03) | `02_data/rules/{year}.dependent.draft.json` |
| `insurance.{year}.json` | 4대보험·재취업 연봉 (F-04·F-07) | `02_data/rules/{year}.insurance.draft.json` |

공통 구조 규약 (타입 정본은 `shared-types.ts` 의 `*Rules` 인터페이스):

- 최상위 `_meta`: `{ year, status: "draft"|"confirmed", asOf: "YYYY-MM-DD", ... }` 필수.
- 각 수치는 `SourcedValue` 형태: `{ value, verified: "official"|"check"|"todo", source?, note? }`.
  - `official` = 고시·법령 원문 확인 / `check` = 비공식 교차확인만(공개 전 재확인 필수) /
    `todo` = 미확보(해당 값을 쓰는 화면은 단정 표현 금지).
- `_meta.asOf` 가 화면의 SourceBadge("기준일 YYYY-MM-DD · 출처")에 그대로 노출된다.
- 연도 갱신 = 새 파일 추가 + `data/rules/index.ts` 의 활성 연도 전환 (URL 은 불변).
