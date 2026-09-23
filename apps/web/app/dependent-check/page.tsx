import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { AudienceLabel } from "@/components/AudienceLabel";
import { FaqBlock } from "@/components/FaqBlock";
import { SourceBadgeFromMeta } from "@/components/SourceBadge";
import { dependentRules as rules, ACTIVE_YEAR } from "@/data/rules";
import { checkDependent, estimateRegionalPremium } from "@/features/dependent-check/engine";
import { DependentCheckCalculator } from "@/features/dependent-check/components/Calculator";
import { won, wonKorean } from "@/lib/format";

export const metadata: Metadata = {
  title: `건강보험 피부양자 자격 체크 — ${ACTIVE_YEAR}년 기준`,
  description: `사업소득·연금·재산 몇 가지 문답으로 피부양자 유지·탈락 가능성과 탈락 시 예상 지역보험료를 바로 확인합니다. 가입 없음, 입력값 저장 안 함.`,
};

// citable shell 예시 — rules 로 빌드 시 재계산 (TOOL_SPEC DoD: 예시 수치는 rules 파일로 재계산).
// rules 교체 시 예시 문장의 판정·숫자도 자동 갱신된다.
const exampleBase = {
  hasBusinessRegistration: false,
  businessIncomeAnnual: 0,
  hasRentalIncome: false,
  annualIncome: 0,
  propertyTaxBase: 0,
  spouseMeetsIncome: null,
  relationship: "family",
} as const;

export default function DependentCheckPage() {
  const incomeMax = rules.dependentEligibility.incomeMax.value;
  const tier1 = rules.dependentEligibility.assetMax.tier1.value;
  const tier2 = rules.dependentEligibility.assetMax.tier2.value;
  const sibling = rules.dependentEligibility.assetMax.sibling;
  const tier2IncomeMax = rules.dependentEligibility.assetMax.tier2IncomeMax.value;
  const unregisteredMax = rules.dependentEligibility.businessIncome.unregisteredMax.value;
  const rp = rules.regionalPremium;
  const healthRatePct = (rp.healthRate.value * 100).toFixed(2);

  const ex1 = checkDependent(
    { ...exampleBase, annualIncome: 12_000_000, propertyTaxBase: 150_000_000 },
    rules,
  );
  const ex2 = checkDependent(
    { ...exampleBase, annualIncome: 24_000_000, propertyTaxBase: 150_000_000 },
    rules,
  );
  const ex2Premium = estimateRegionalPremium(
    { annualWorkPensionIncome: 24_000_000, annualOtherIncome: 0, propertyTaxBase: 150_000_000 },
    rules,
  );
  const ex3 = checkDependent(
    { ...exampleBase, annualIncome: 12_000_000, propertyTaxBase: 600_000_000 },
    rules,
  );
  const ex3Premium = estimateRegionalPremium(
    { annualWorkPensionIncome: 12_000_000, annualOtherIncome: 0, propertyTaxBase: 600_000_000 },
    rules,
  );

  const verdictText = (v: "keep" | "lose") => (v === "keep" ? "유지" : "제외 가능성 높음");

  return (
    <div className="mx-auto max-w-[var(--container-narrow)] py-10">
      {/* ① 한 줄 정의 */}
      <h1 className="t-h1">건강보험 피부양자 자격 체크</h1>
      <p className="t-body-l mt-4">
        피부양자는 직장가입자(자녀·배우자 등)의 건강보험에 얹혀 <strong>보험료를 내지 않는
        가족</strong>입니다. 소득·재산이 일정 기준을 넘으면 자격을 잃고 지역가입자로 전환되어
        보험료가 새로 부과됩니다. 아래 문답에 답하면 유지·탈락 가능성과 탈락 시 예상 보험료를
        한 번에 확인할 수 있습니다.
      </p>
      <p className="t-body mt-2">
        입력하신 소득·재산은 서버로 전송되지 않고 이 화면 안에서만 계산됩니다. 아직 은퇴
        전이라면 첫 질문에서 &lsquo;은퇴 후 기준&rsquo;을 골라 예상 소득으로 미리 확인할 수
        있어요.
      </p>

      <AudienceLabel>
        부모님을 자녀 직장보험에 얹으려는 가족, 그리고 &lsquo;은퇴하면 얹힐 수 있을까&rsquo;
        미리 확인해 보려는 분께요.
      </AudienceLabel>

      {/* 계산기 (클라이언트) */}
      <div className="mt-8">
        <DependentCheckCalculator />
      </div>

      <AdSlot position="dependent-below-calc" />

      {/* ② 평문 요건 */}
      <section className="mt-14">
        <h2 className="t-h2">피부양자 요건 (평문)</h2>
        <ul className="t-body-l">
          <li>
            <strong>연간 소득 합계 {wonKorean(incomeMax)} 이하</strong> — 국민연금 등 공적연금은
            100% 반영돼요 (지역보험료 부과 때 50%와 달라요).
          </li>
          <li>
            <strong>사업소득</strong> — 사업자등록이 있으면 사업소득이 1원이라도 발생하는 즉시
            제외돼요 ({wonKorean(unregisteredMax)} 특례 없음). 등록이 없는 프리랜서 등은 연 {wonKorean(unregisteredMax)}까지 허용돼요.
          </li>
          <li>
            <strong>주택임대소득</strong> — 금액과 관계없이 있으면 제외돼요.
          </li>
          <li>
            <strong>재산세 과세표준 {wonKorean(tier1)} 이하</strong> — 넘더라도{" "}
            {wonKorean(tier2)} 이하이면서 연간 소득이 {wonKorean(tier2IncomeMax)} 이하면 유지돼요.{" "}
            {wonKorean(tier2)}을 넘으면 소득과 관계없이 제외돼요. 재산은 부부라도 각자 명의로
            판정해요.
          </li>
          <li>
            <strong>부부는 두 사람 모두</strong> 소득요건을 충족해야 해요 — 한 명이라도 넘으면 두
            사람 모두 제외돼요.
          </li>
        </ul>
      </section>

      {/* ③ 계산 예시 (rules 재계산 값) */}
      <section className="mt-12">
        <h2 className="t-h2">판정 예시</h2>
        <ul className="t-body-l">
          <li>
            연금 연 1,200만원, 재산세 과세표준 1억 5천만원: <strong>{verdictText(ex1.verdict)}</strong>{" "}
            — 소득 {wonKorean(incomeMax)} 이하, 재산 {wonKorean(tier1)} 이하로 요건을 충족해요.
          </li>
          <li>
            연금 연 2,400만원, 과세표준 1억 5천만원: <strong>{verdictText(ex2.verdict)}</strong> —
            소득 기준을 넘어요. 지역가입자가 되면 월 약{" "}
            <strong>{won(ex2Premium.monthlyTotal)}</strong>(건강 {won(ex2Premium.monthlyHealth)} +
            장기요양 {won(ex2Premium.monthlyLongTermCare)}) 수준으로 추정돼요.
          </li>
          <li>
            연금 연 1,200만원, 과세표준 6억원: <strong>{verdictText(ex3.verdict)}</strong> — 재산이{" "}
            {wonKorean(tier1)}~{wonKorean(tier2)} 구간이면 소득이 연 {wonKorean(tier2IncomeMax)} 이하여야 하는데 이를
            넘어요. 예상 보험료는 월 약 <strong>{won(ex3Premium.monthlyTotal)}</strong> 수준이에요.
          </li>
        </ul>
        <p className="t-caption mt-2">
          보험료는 간이 추정 값이며, 실제 고지 금액은 공단 산정에 따라 달라질 수 있어요.
        </p>
      </section>

      {/* ④ 기준 수치 표 + 출처 */}
      <section className="mt-12">
        <h2 className="t-h2">{ACTIVE_YEAR}년 기준 수치</h2>
        <table className="table mt-4">
          <thead>
            <tr>
              <th>항목</th>
              <th className="num">기준</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>소득요건 (연간 소득 합계)</td>
              <td className="num">{wonKorean(incomeMax)} 이하</td>
            </tr>
            <tr>
              <td>재산요건 1단계</td>
              <td className="num">과세표준 {wonKorean(tier1)} 이하</td>
            </tr>
            <tr>
              <td>재산요건 2단계</td>
              <td className="num">
                {wonKorean(tier1)}~{wonKorean(tier2)} + 연소득 {wonKorean(tier2IncomeMax)} 이하
              </td>
            </tr>
            {sibling ? (
              <tr>
                <td>형제자매 재산요건</td>
                <td className="num">과세표준 {wonKorean(sibling.value)} 이하</td>
              </tr>
            ) : null}
            <tr>
              <td>지역가입자 건강보험료율</td>
              <td className="num">{healthRatePct}%</td>
            </tr>
            <tr>
              <td>재산 기본공제</td>
              <td className="num">{wonKorean(rp.assetBasicDeduction.value)}</td>
            </tr>
            <tr>
              <td>재산 점수당 금액 (60등급표)</td>
              <td className="num">{rp.assetPointPrice.value}원</td>
            </tr>
            <tr>
              <td>장기요양보험료</td>
              <td className="num">{rp.longTermCareRate.formula ?? `요율 ${rp.longTermCareRate.value}`}</td>
            </tr>
            <tr>
              <td>지역보험료 하한 / 상한 (월)</td>
              <td className="num">
                {won(rp.monthlyMin.value)} / {won(rp.monthlyMax.value)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="t-caption mt-2">
          출처: {rules._meta.law}. 하한·상한은 고시 원문 대조 전 값으로, 간이 추정에만 사용해요.
        </p>
      </section>

      {/* ⑤ 결과 해석 가이드 */}
      <section className="mt-12">
        <h2 className="t-h2">결과를 어떻게 볼까요</h2>
        <p className="t-body-l">
          이 체크는 법령 요건을 그대로 따르지만, 실제 자격 판정은 건강보험공단이 국세청·지자체
          자료로 심사해 결정합니다. 탈락 가능성이 높게 나왔더라도 방법이 없는 것은 아니에요 —
          퇴직 직후라면 <strong>임의계속가입</strong>으로 한동안 직장 보험료 수준을 유지할 수 있는
          경우가 있고, 연금 수령 시기나 금융소득 실현 시점을 조정해 요건을 다시 충족하는 방법도
          있습니다. 반대로 지금은 유지로 나와도 연금 수령액이 늘거나 재산 과세표준이 오르면
          달라질 수 있으니 해마다 다시 확인해 보세요.
        </p>
      </section>

      {/* ⑥ FAQ (TOOL_SPEC 6문항) */}
      <FaqBlock
        tool="dependent-check"
        items={[
          {
            q: "연금을 받으면 피부양자에서 탈락하나요?",
            a: `연금만으로 무조건 탈락하는 건 아니에요. 국민연금 등 공적연금을 포함한 연간 소득 합계가 ${wonKorean(incomeMax)}(월로 나누면 약 ${won(Math.round(incomeMax / 12))})을 넘으면 탈락해요. 피부양자 판정에는 공적연금이 100% 반영되니, 보험료 부과 때의 50% 반영과 혼동하지 마세요.`,
          },
          {
            q: "사업자등록을 내면 어떻게 되나요?",
            a: `사업자등록이 있으면 사업소득이 1원이라도 발생하는 즉시 피부양자에서 제외돼요 — 연 ${wonKorean(unregisteredMax)} 특례가 없어요. 그 특례는 사업자등록이 없는 프리랜서 등에게만 적용돼요(연 ${wonKorean(unregisteredMax)} 이하 허용). 등록만 있고 소득이 전혀 없으면 유지될 수 있어요.`,
          },
          {
            q: "임대소득이 조금인데도 탈락하나요?",
            a: "네, 주택임대소득은 금액과 관계없이 있으면 탈락해요. 사업자등록 여부와도 무관해요. 월세를 조금만 받아도 소득 자료에 잡히면 제외 대상이 되니 주의하세요.",
          },
          {
            q: "부부 중 한 명만 소득요건을 초과하면 어떻게 되나요?",
            a: `부부는 두 분 모두 소득요건(연 ${wonKorean(incomeMax)} 이하 등)을 충족해야 해요. 한 분이라도 넘으면 두 분 모두 피부양자에서 제외돼요. 다만 재산요건은 각자 명의 재산으로 따로 판정해요 — 재산은 한 분만 초과하면 그분만 제외돼요.`,
          },
          {
            q: "탈락하면 보험료를 얼마나 내나요?",
            a: `지역가입자로 전환되어 소득(근로·연금은 50%, 이자·배당·사업 등은 100% 반영)에 ${healthRatePct}%를 곱한 금액과, 재산(과세표준에서 ${wonKorean(rp.assetBasicDeduction.value)} 공제 후 60등급 점수 × ${rp.assetPointPrice.value}원)에 대한 금액, 그리고 장기요양보험료를 합쳐 내게 돼요. 예를 들어 연금 연 2,400만원·과세표준 1억 5천만원이면 월 약 ${won(ex2Premium.monthlyTotal)} 수준으로 추정돼요. 위 계산기에서 본인 조건으로 확인해 보세요 — 간이 추정이므로 정확한 금액은 공단 모의계산에서 확인하는 게 좋아요.`,
          },
          {
            q: "언제 기준으로 판정하나요?",
            a: "공단은 국세청 소득 자료가 확정되는 매년 하반기(통상 11월경)에 전년도 소득으로 정기 재판정을 해요. 재산은 그 해 재산세 과세표준 기준이에요. 소득이 크게 늘면 정기 판정 전에 수시로 조정될 수도 있으니, 정확한 시점은 건강보험공단(1577-1000)에 확인해 주세요.",
          },
        ]}
      />

      <SourceBadgeFromMeta meta={rules._meta} />
    </div>
  );
}
