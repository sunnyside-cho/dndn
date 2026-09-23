"use client";
import { useCallback, useRef, useState, type ReactNode } from "react";
import type { ToolId } from "@contracts/shared-types";
import { track } from "@/lib/analytics";
import { SITE, toolMeta } from "@/lib/site";

// F-05 결과 카드 — 시점 배지 + 판정 헤드라인 + 내용 + 공유·이미지 저장·인쇄 (design-guide 고정 컴포넌트)
export function ResultCard({
  tool,
  headline,
  timeBadge,
  children,
}: {
  tool: ToolId;
  headline: string;
  /** 공통 신뢰 장치 ② (PERSONA_TIMING.md) — "2026년 기준" / 미래형 "현재 기준 가정 계산" 등.
   *  연도는 각 도구 rules `_meta.year` 에서 — 수기 연도 금지. */
  timeBadge: string;
  children: ReactNode;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const meta = toolMeta(tool);

  const share = useCallback(async () => {
    track({ name: "share_click", params: { tool, channel: "link" } });
    const url = `${SITE.baseUrl}${meta.path}`;
    // 모바일 공유 시트(카톡 포함). 미지원 브라우저는 링크 복사.
    if (navigator.share) {
      try {
        await navigator.share({ title: `${meta.name} — ${SITE.name}`, url });
        return;
      } catch {
        /* 사용자가 취소 — 무시 */
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [tool, meta]);

  const saveImage = useCallback(async () => {
    if (!captureRef.current) return;
    track({ name: "share_click", params: { tool, channel: "image" } });
    const { toPng } = await import("html-to-image");
    const surface = getComputedStyle(document.body).backgroundColor;
    const dataUrl = await toPng(captureRef.current, { backgroundColor: surface, pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${SITE.name}-${tool}.png`;
    a.click();
  }, [tool]);

  const print = useCallback(() => {
    track({ name: "print_click", params: { tool } });
    window.print();
  }, [tool]);

  return (
    <section aria-live="polite" className="mt-10">
      <div
        ref={captureRef}
        data-capture
        className="rounded-[var(--radius-lg)] border-2 border-[var(--border-strong)] p-6 sm:p-8"
      >
        <p className="t-label mb-3 mt-0">
          <span className="inline-block rounded-full border border-[var(--border)] px-3 py-1.5">
            {timeBadge}
          </span>
        </p>
        <h2 className="t-h2 mt-0">{headline}</h2>
        {children}
        <p className="t-caption mb-0 mt-4">{SITE.name} · {SITE.baseUrl.replace("https://", "")}{meta.path}</p>
      </div>
      <div className="no-print mt-4 grid grid-cols-3 gap-3">
        <button type="button" className="btn" onClick={share}>
          {copied ? "복사됨" : "공유하기"}
        </button>
        <button type="button" className="btn" onClick={saveImage}>
          이미지 저장
        </button>
        <button type="button" className="btn" onClick={print}>
          인쇄
        </button>
      </div>
    </section>
  );
}
