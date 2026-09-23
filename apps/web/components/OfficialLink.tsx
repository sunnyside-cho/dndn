import type { ToolId } from "@contracts/shared-types";

// 공통 신뢰 장치 ③ (PERSONA_TIMING.md) — 결과에 공식 계산기 링크 병기.
// "문을 열어주는 것이 신뢰를 만든다" — 우리 결과를 공식 계산기로 재확인할 문을 항상 연다.
// 심층 링크는 기관 사이트 개편으로 깨지기 쉬워(404 감시 장치 없음) 메인 URL + 경로 안내로 적는다.
const OFFICIAL: Record<ToolId, { name: string; url: string; path: string }> = {
  "basic-pension": {
    name: "복지로 모의계산",
    url: "https://www.bokjiro.go.kr",
    path: "복지로 → 복지서비스 모의계산 → 기초연금",
  },
  "severance-tax": {
    name: "홈택스 모의계산",
    url: "https://www.hometax.go.kr",
    path: "홈택스 → 세금 모의계산 → 퇴직소득 세액",
  },
  "dependent-check": {
    name: "건강보험공단 모의계산",
    url: "https://www.nhis.or.kr",
    path: "공단 홈페이지 → 보험료 계산기",
  },
  "insurance-rate": {
    name: "4대사회보험 모의계산",
    url: "https://www.4insure.or.kr",
    path: "정보연계센터 → 4대보험료 모의계산",
  },
  "salary-senior": {
    name: "4대사회보험 모의계산",
    url: "https://www.4insure.or.kr",
    path: "정보연계센터 → 4대보험료 모의계산 · 소득세는 홈택스 간이세액표",
  },
};

export function OfficialLink({ tool }: { tool: ToolId }) {
  const o = OFFICIAL[tool];
  return (
    <p className="t-body mt-6 mb-0">
      정확한 금액은{" "}
      <a href={o.url} rel="noopener" target="_blank" className="underline">
        {o.name}
      </a>
      ({o.path})에서 한 번 더 확인해 보세요.
    </p>
  );
}
