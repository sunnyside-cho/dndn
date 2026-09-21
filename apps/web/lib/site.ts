import type { ToolId } from "@contracts/shared-types";

// 사이트 전역 설정 — BUILD_BRIEF URL 설계(연도 없는 고정 URL)
export const SITE = {
  name: "든든노후",
  /** 도메인 확정 전 vercel.app — 확정 시 env 로 교체 */
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://dndn.vercel.app",
  /** 도메인 연결 전 색인 차단 (BUILD_BRIEF) — 연결 시 env 로 해제 */
  indexable: process.env.NEXT_PUBLIC_INDEXABLE === "true",
  description:
    "은퇴 전후의 돈 문제 — 기초연금·퇴직금 세금·건보 피부양자 — 를 올해 기준으로 계산해주는 무료 도구·해설 사이트",
} as const;

export interface ToolMeta {
  id: ToolId;
  path: string;
  name: string;
  /** 홈·GNB 짧은 설명 */
  short: string;
}

export const TOOLS: ToolMeta[] = [
  { id: "basic-pension", path: "/basic-pension/", name: "기초연금 모의계산", short: "나이·소득·재산으로 수급 가능성과 예상 금액 확인" },
  { id: "severance-tax", path: "/severance-tax/", name: "퇴직금 세금·IRP 절세", short: "퇴직소득세와 IRP로 받을 때 절세액 비교" },
  { id: "dependent-check", path: "/dependent-check/", name: "건보 피부양자 체크", short: "자격 유지·탈락 판정과 탈락 시 예상 보험료" },
  { id: "insurance-rate", path: "/insurance-rate/", name: "4대보험 인상분 계산", short: "올해와 내년 월급 공제액 차이 확인" },
  { id: "salary-senior", path: "/salary-senior/", name: "재취업 연봉 실수령", short: "은퇴 후 재취업·계약직 월급 실수령액" },
];

export function toolMeta(id: ToolId): ToolMeta {
  const t = TOOLS.find((t) => t.id === id);
  if (!t) throw new Error(`unknown tool: ${id}`);
  return t;
}
