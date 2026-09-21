# 프로젝트: dndn

> 하네스의 **유일한 인스턴스 슬롯**. task-agent 는 spawn 시 이 파일과 도메인 스킬을 Read 해
> 경로·스택·도메인 값을 주입받는다. 모든 `<...>` 를 프로젝트에 맞게 채운다.

## 정체성
<이 제품이 무엇인지 한두 줄>

## 스택
- 프레임워크: Next.js (App Router) + TypeScript(strict)
- 스타일: Tailwind CSS
- 서버 상태: TanStack Query · 전역 UI 상태: Zustand · 폼: React Hook Form · 검증: Zod
- 테스트: 단위/통합 Vitest · E2E Playwright
- DB: Supabase(PostgreSQL) · ORM: Prisma(`provider="postgresql"` · 어댑터 `@prisma/adapter-pg`)
  - 런타임은 Transaction pooler(6543, `DATABASE_URL`) · CLI/마이그레이션은 `DIRECT_URL`(5432)
- 운영 배포: Vercel (앱) + Supabase (DB)
- 복잡 로직 모듈(필요 시): Fastify(우선) / Express — `services/`
- 패키지 매니저: npm
- **추가 도입**: Supabase(PostgreSQL) — 표준 MariaDB 대체(사용자 결정) · 2026-09-21
                 Vercel — 운영 배포 플랫폼(사용자 결정) · 2026-09-21

## 운영 규모
- 규모: 500명 이상 — 여러 회사·그룹사 사용 (init 선택값 · 설계 기준치는 2,000명으로 잡음)
- 파생: 3년 누적 약 72만 건 · 피크 동시 약 120명 · 보존 3년(기본 가정)
  (계산: 2,000명 × 월 10건 × 36개월 = 720,000건 · 동시 접속률 6% ≈ 120명)
- 응답 목표: 목록·조회 1초 · 문서 생성·집계 5초 (통상 기준 — 프로젝트 사정에 맞게 조정)

## 경로
- db: `prisma/`(schema.prisma · migrations) + 기능별 `features/*/actions.ts`
- backend: `apps/web/app/api/*/route.ts`(얇게) → `features/*/actions.ts`
- frontend: `apps/web/features/*/(components|hooks)` + 공통 `apps/web/components/`

## 계약
- `contracts/{db-schema,api-spec,shared-types,design-guide}` — 문서 규약 SSOT
  (`contract-authoring` 스킬. 계약 변경은 사용자 합의 후 세션이 수행)

## 도메인 스킬
- `dndn-domain` — 프로젝트 불변 비즈니스 규칙 (`.claude/skills/` · task-agent 바인딩)

## 테스트 스킬
- 단위/통합: Vitest — `*-conventions` 스킬이 규정
- E2E: Playwright — `playwright-e2e` 스킬 (task-agent 바인딩)

## UI 표준
- `ax-wireframe` (HCG AX — 전사 표준. 세션에 없으면 설치를 요청하고 임의 디자인 금지).
  프로젝트별 구체값·오버라이드는 `contracts/design-guide.md` — 충돌 시 design-guide(사용자
  합의로 명시 기록된 오버라이드)가 우선한다.

## 환경변수
- `DATABASE_URL` — Supabase Transaction pooler(6543) 연결 문자열 (런타임)
- `DIRECT_URL` — Supabase Session pooler(5432) 연결 문자열 (prisma migrate 등 CLI)
- <이후 추가 키는 목록만, placeholder — 실값 금지> (예: `JWT_SECRET`, …)
