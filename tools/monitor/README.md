# tools/monitor — W1 제도 개정 모니터링

크롤 diff → Jev(TypeSafe System One) 분류 → 사람 검수용 리포트. **rules 갱신은 하지 않는다**
(사람이 원문 대조 후 반영 — WORKFLOW.md W1 절대 규칙).

## 실행

```bash
node tools/monitor/run.mjs                      # 수집 + 분류 + reports/YYYY-MM-DD.md
node --test tools/monitor/test/monitor.test.mjs # 단위 테스트 (의존성 0, node:test)
node tools/monitor/backtest/run-backtest.mjs    # 한국어 라벨셋 24건 백테스트 (API 호출)
```

키: `TYPESAFE_API_KEY` (또는 `JEV_API_KEY`) — 로컬은 `apps/web/.env`, CI 는 GitHub Secret.
키가 없으면 분류 없이 "미분류(전건 확인)"로 리포트된다.

## 구조

| 파일 | 역할 |
|---|---|
| `sources.mjs` | 감시 URL 목록 (서버렌더 페이지 위주 — SPA 는 수집 실패로 노출됨) |
| `crawl.mjs` | fetch → 텍스트화 → `snapshots/` 대비 신규 문단 diff |
| `assumptions.mjs` | 분류 기준이 되는 계산 가정 17종 — **rules JSON 에서 값 보간** (SSOT 유지) |
| `jev.mjs` | 문단 1개당 요청 1개: 가정별 Noul 17 + 관련성 Noul + 도구 Choice (`jev-1.13.0` 고정) |
| `report.mjs` | 임계값(백테스트 튜닝)·트리아지·마크다운 리포트 |
| `backtest/` | 2025→2026 실제 개정 기반 라벨셋 + recall/오탐 측정 |

## fail-closed 불변식 (설계의 핵심)

1. diff 에 걸린 문단은 분류 확률과 무관하게 **전부** 리포트에 실린다 — 분류는 순서/라벨만.
2. 수집 실패·분류 실패는 "통과"가 아니라 **경고 섹션**으로 노출된다.
3. 알림(ALERT)·미분류 존재 시 종료코드 2 → CI 가 이슈 생성.

## 백테스트 근거 (2026-09-22, jev-1.13.0, 24케이스)

탐지 recall 100% (REVIEW=0.15) · top-1 가정 적중 100% · 알림 오탐 0% (ALERT=0.35, 음성 최고 0.24)
· 1회 전체 비용 ≈ $0.003. **모델 버전을 올리면 백테스트를 다시 돌려 임계를 재확인할 것.**
