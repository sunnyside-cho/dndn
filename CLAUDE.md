# dndn

> 소비 프로젝트의 `CLAUDE.md`. **PROJECT 섹션**(이 프로젝트 고유 — 포인터만) + **hcg-core
> 방법론 import** 로 구성된다.

## PROJECT (이 프로젝트 고유)

- **정체성·스택·경로·계약·도메인 스킬·UI 표준**: `.claude/project.md` 를 단일 출처로 한다
  (인스턴스 슬롯). 여기 값을 복제하지 말고 그 파일을 가리킨다.
- **주요 명령**(`apps/web` 에서): `npm run dev` / `npm run build`(SSG export) / `npm test`(Vitest) / `npm run test:e2e`(Playwright) / `npm run lint` / `npx tsc --noEmit`

## 공통 방법론 (hcg-core)

@.claude/CLAUDE-core.md
