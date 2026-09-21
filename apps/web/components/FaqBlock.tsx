"use client";
import type { ToolId } from "@contracts/shared-types";
import { track } from "@/lib/analytics";

export interface FaqItem {
  q: string;
  a: string;
}

// F-08 — 질문형 H2 + 직답. 클라이언트 컴포넌트지만 내용은 SSR 로 HTML 에 포함된다(citable).
// 마크업 스키마는 넣지 않는다 (FAQ 리치결과 폐지 — SEO_AEO_GEO).
export function FaqBlock({ tool, items }: { tool: ToolId; items: FaqItem[] }) {
  return (
    <section className="mt-12">
      <h2 className="t-h2">자주 묻는 질문</h2>
      <div className="mt-4">
        {items.map((item) => (
          <details
            key={item.q}
            className="border-b border-[var(--divider)] py-1"
            onToggle={(e) => {
              if ((e.target as HTMLDetailsElement).open)
                track({ name: "faq_open", params: { tool, question: item.q } });
            }}
          >
            <summary className="t-h4 min-h-12 cursor-pointer list-none py-3 flex items-center justify-between">
              {item.q}
              <span aria-hidden className="t-caption shrink-0 pl-4">
                열기
              </span>
            </summary>
            <p className="t-body-l mt-0 pb-5 whitespace-pre-line">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
