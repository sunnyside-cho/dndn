import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "운영자·계산 근거 안내",
  description: `${SITE.name}의 운영 원칙, 계산 근거(법령·고시), 면책 안내`,
};

// YMYL 신뢰 신호 (SEO_AEO_GEO §1): 실명 운영자 페이지 — "전문가"가 아니라
// "공식 자료를 정리하는 운영자" 포지셔닝. 이름·연락처 확정 시 이 페이지에 추가.
export default function AboutPage() {
  return (
    <article className="mx-auto max-w-[var(--container-narrow)] py-12">
      <h1 className="t-h1">운영자·계산 근거 안내</h1>

      <h2 className="t-h2 mt-10">이 사이트는</h2>
      <p className="t-body-l">
        {SITE.name}는 은퇴 전후에 마주치는 돈 문제 — 기초연금, 퇴직금 세금, 건강보험
        피부양자, 4대보험 — 를 올해 기준으로 계산해 보는 <strong>민간 정보 서비스</strong>입니다.
        정부·공공기관과 관련이 없습니다.
      </p>

      <h2 className="t-h2 mt-10">계산 근거</h2>
      <p className="t-body-l">
        모든 계산은 법령·고시 원문(국가법령정보센터, 보건복지부 고시, 소득세법 등)을 확인해
        만든 기준 데이터로 수행합니다. 각 도구 페이지 하단에 기준일과 출처를 표기하며, 제도가
        개정되면 기준 데이터를 갱신합니다. 원문 확인이 끝나지 않은 값은 화면에 &ldquo;재확인
        중&rdquo;으로 표시하고 단정하지 않습니다.
      </p>

      <h2 className="t-h2 mt-10">개인정보</h2>
      <p className="t-body-l">
        가입·로그인이 없습니다. 계산기에 입력한 소득·재산 정보는 <strong>서버로 전송되지 않고</strong>{" "}
        브라우저 안에서만 계산됩니다.
      </p>

      <h2 className="t-h2 mt-10">면책</h2>
      <p className="t-body-l">
        본 사이트의 계산과 해설은 참고용이며 법적 효력이 없습니다. 실제 수급·부과·과세는 국민연금공단,
        국민건강보험공단, 국세청 등 해당 기관의 심사와 고지에 따릅니다. 금융상품을 추천하지 않으며,
        제휴 링크가 있는 경우 &ldquo;광고&rdquo;로 표기합니다.
      </p>
    </article>
  );
}
