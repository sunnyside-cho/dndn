import type { ReactNode } from "react";

// 공통 신뢰 장치 ① (PERSONA_TIMING.md) — 첫 화면 "이 계산기는 이런 분께 맞아요" 대상 라벨 1줄.
// 서버렌더(citable shell 일부) — 전 도구 페이지 계산기 바로 위에 배치한다.
export function AudienceLabel({ children }: { children: ReactNode }) {
  return (
    <p className="t-body mt-6 mb-0 rounded-[var(--radius-lg)] bg-[var(--surface-subtle)] px-4 py-3">
      <strong>이런 분께 맞아요</strong> — {children}
    </p>
  );
}
