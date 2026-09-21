"use client";
import type { ToolId } from "@contracts/shared-types";
import { track } from "@/lib/analytics";

// F-11 제휴 슬롯 — 12월 플랫폼 승인 전까지 전 사이트 비활성 (도메인 규칙 7).
// 활성화 = 이 상수만 true 로. "광고" 라벨은 내장 — 라벨 없는 변형 금지 (금소법).
const AFFILIATE_ENABLED = false;

export interface AffiliateProps {
  tool: ToolId;
  campaign: string;
  href: string;
  /** 플랫폼 승인 문구만 — 직접 추천 표현 금지 */
  label: string;
}

export function AffiliateSlot({ tool, campaign, href, label }: AffiliateProps) {
  if (!AFFILIATE_ENABLED) return null;
  return (
    <a
      href={href}
      rel="nofollow sponsored noopener"
      target="_blank"
      className="btn mt-6 w-full justify-between no-print"
      onClick={() => track({ name: "affiliate_click", params: { tool, campaign } })}
    >
      <span>{label}</span>
      <span className="t-label rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-0.5">
        광고
      </span>
    </a>
  );
}
