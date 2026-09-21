import type { ReactNode } from "react";

// F-10 면책 — 모든 도구 결과·글 하단 공통. 도구별 추가 문구는 children.
export function Disclaimer({ children }: { children?: ReactNode }) {
  return (
    <div className="mt-8 rounded-[var(--radius-lg)] bg-[var(--surface-subtle)] p-5">
      <p className="t-body m-0">
        본 계산은 <strong>참고용</strong>이며 법적 효력이 없습니다.
        {children ? <> {children}</> : null}
      </p>
    </div>
  );
}
